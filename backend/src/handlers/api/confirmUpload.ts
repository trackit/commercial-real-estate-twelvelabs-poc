import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { videoId, filename, s3Uri } = body;

    if (!videoId || !filename || !s3Uri) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'videoId, filename, and s3Uri are required' }),
      };
    }

    const s3Match = s3Uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!s3Match) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid s3Uri format' }),
      };
    }

    const [, bucket, key] = s3Match;
    const headResponse = await s3Client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );

    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await dynamoClient.send(
      new PutItemCommand({
        TableName: process.env.VIDEOS_TABLE,
        Item: {
          id: { S: videoId },
          filename: { S: filename },
          s3Uri: { S: s3Uri },
          size: { N: (headResponse.ContentLength || 0).toString() },
          contentType: { S: headResponse.ContentType || 'video/mp4' },
          status: { S: 'ready' },
          createdAt: { S: now },
          updatedAt: { S: now },
          ttl: { N: ttl.toString() },
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        id: videoId,
        filename,
        s3Uri,
        size: headResponse.ContentLength,
        status: 'ready',
        createdAt: now,
      }),
    };
  } catch (error) {
    console.error('Error confirming upload:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Failed to confirm upload' }),
    };
  }
};
