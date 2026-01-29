import { Handler } from 'aws-lambda';
import { WorkflowServices } from '../../infrastructure/WorkflowServices/WorkflowServices';
import { Config } from '../../infrastructure/Config/Config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoTaskTokenStore } from '../../infrastructure/TaskTokenStore/TaskTokenStore';
import { TaskTokenRecord } from '../../ports/taskTokenStore';

interface S3EventBridgeDetail {
  bucket: { name: string };
  object: { key: string };
}

interface EventBridgeS3Event {
  source: string;
  'detail-type': string;
  detail: S3EventBridgeDetail;
}

type TaskTokenType = 'marengo' | 'pegasus-analysis' | 'pegasus-voiceover';

export const handler: Handler<EventBridgeS3Event> = async (event) => {
  const config = new Config();
  const workflowServices = new WorkflowServices(config);
  const s3Client = new S3Client({ region: config.awsRegion });
  const taskTokenStore = new DynamoTaskTokenStore(config);

  const bucketName = event.detail.bucket.name;
  const objectKey = decodeURIComponent(
    event.detail.object.key.replace(/\+/g, ' '),
  );

  const typeInfo = determineTypeFromPath(objectKey);
  if (!typeInfo) {
    return;
  }

  const { type, outputS3Uri } = typeInfo;
  const tokenRecord = await taskTokenStore.consumeTaskToken(outputS3Uri, type);

  if (!tokenRecord) {
    return;
  }

  try {
    const result = await buildSuccessResult(
      s3Client,
      bucketName,
      objectKey,
      tokenRecord,
    );
    await workflowServices.sendTaskSuccess(tokenRecord.taskToken, result);
  } catch (error) {
    console.error('Error processing callback:', error);
    await workflowServices.sendTaskFailure(
      tokenRecord.taskToken,
      getErrorType(tokenRecord.type),
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
};

function determineTypeFromPath(
  objectKey: string,
): { type: TaskTokenType; outputS3Uri: string } | null {
  if (
    objectKey.startsWith('embeddings/') &&
    objectKey.endsWith('/output.json')
  ) {
    const match = objectKey.match(/^embeddings\/([^/]+)\//);
    if (match) {
      const videoId = match[1];
      const basePath = `embeddings/${videoId}/`;
      return {
        type: 'marengo',
        outputS3Uri: `s3://${process.env.S3_BUCKET_NAME}/${basePath}`,
      };
    }
  }

  if (objectKey.startsWith('analysis/') && objectKey.endsWith('.json')) {
    return {
      type: 'pegasus-analysis',
      outputS3Uri: `s3://${process.env.S3_BUCKET_NAME}/${objectKey}`,
    };
  }

  if (objectKey.startsWith('voiceover/') && objectKey.endsWith('.json')) {
    return {
      type: 'pegasus-voiceover',
      outputS3Uri: `s3://${process.env.S3_BUCKET_NAME}/${objectKey}`,
    };
  }

  return null;
}

async function buildSuccessResult(
  s3Client: S3Client,
  bucketName: string,
  objectKey: string,
  tokenRecord: TaskTokenRecord,
): Promise<unknown> {
  switch (tokenRecord.type) {
    case 'marengo':
      return {
        status: 'Completed',
        videoId: tokenRecord.videoId,
        outputS3Uri: `s3://${bucketName}/${objectKey}`,
      };

    case 'pegasus-analysis': {
      const analysisData = await readS3Output(s3Client, bucketName, objectKey);
      return {
        ...analysisData,
        segmentId: parseInt(tokenRecord.videoId, 10),
      };
    }

    case 'pegasus-voiceover': {
      const voiceoverData = await readS3Output(s3Client, bucketName, objectKey);
      return {
        segmentId: parseInt(tokenRecord.videoId, 10),
        voiceover: voiceoverData.voiceover ?? voiceoverData,
      };
    }

    default:
      return {
        status: 'Completed',
        outputS3Uri: `s3://${bucketName}/${objectKey}`,
      };
  }
}

async function readS3Output(
  s3Client: S3Client,
  bucket: string,
  key: string,
): Promise<Record<string, unknown>> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = await response.Body!.transformToString();
  const parsed = JSON.parse(body);

  if (parsed.data) {
    return typeof parsed.data === 'string'
      ? JSON.parse(parsed.data)
      : parsed.data;
  }
  return parsed;
}

function getErrorType(type: TaskTokenType): string {
  switch (type) {
    case 'marengo':
      return 'EmbeddingGenerationFailed';
    case 'pegasus-analysis':
      return 'SegmentAnalysisFailed';
    case 'pegasus-voiceover':
      return 'VoiceoverGenerationFailed';
    default:
      return 'BedrockInvocationFailed';
  }
}
