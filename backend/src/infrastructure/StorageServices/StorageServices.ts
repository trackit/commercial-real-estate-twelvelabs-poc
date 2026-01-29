import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { VectorStore, SegmentEmbeddingInput } from '../../ports/vectorStore';
import { VideoStorage } from '../../ports/videoStorage';
import { Config } from '../Config/Config';
import { parseS3Uri, buildS3Uri } from '../../shared/utils';
import { StorageError } from '../../shared/errors';

export class StorageServices implements VectorStore, VideoStorage {
  private s3Client: S3Client;

  constructor(
    private config: Config,
    private indexName: string,
  ) {
    this.s3Client = new S3Client({ region: config.awsRegion });
  }

  async storeEmbeddings(
    videoId: string,
    segments: SegmentEmbeddingInput[],
  ): Promise<void> {
    try {
      const data = {
        videoId,
        segments: segments.map((seg) => ({
          key: `${videoId}_${seg.startTime}_${seg.endTime}`,
          startTime: seg.startTime,
          endTime: seg.endTime,
          embedding: seg.embedding,
        })),
      };

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.s3BucketName,
          Key: `embeddings/${this.indexName}/${videoId}.json`,
          Body: JSON.stringify(data),
          ContentType: 'application/json',
        }),
      );
    } catch (error) {
      throw new StorageError(
        'storeEmbeddings',
        videoId,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async downloadVideo(s3Uri: string, localPath: string): Promise<void> {
    try {
      const { bucket, key } = parseS3Uri(s3Uri);
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );

      const writeStream = fs.createWriteStream(localPath);
      const body = response.Body as NodeJS.ReadableStream;
      body.pipe(writeStream);

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error) {
      throw new StorageError(
        'downloadVideo',
        s3Uri,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async putObject(
    bucket: string,
    key: string,
    data: Buffer,
    contentType?: string,
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return buildS3Uri(bucket, key);
  }
}
