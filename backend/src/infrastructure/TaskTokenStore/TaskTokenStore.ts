import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb'
import { TaskTokenStore, TaskTokenRecord } from '../../ports/taskTokenStore'
import { Config } from '../Config/Config'

export class DynamoTaskTokenStore implements TaskTokenStore {
  private client: DynamoDBClient
  private tableName: string

  constructor(config: Config) {
    this.client = new DynamoDBClient({ region: config.awsRegion })
    this.tableName = process.env.TASK_TOKEN_TABLE ?? ''
  }

  async storeTaskToken(record: TaskTokenRecord): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 3600
    const key = this.buildKey(record.outputS3Uri, record.type)

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          pk: { S: key },
          invocationArn: { S: record.invocationArn },
          taskToken: { S: record.taskToken },
          videoId: { S: record.videoId },
          outputS3Uri: { S: record.outputS3Uri },
          type: { S: record.type },
          ttl: { N: ttl.toString() },
        },
      })
    )
  }

  async getTaskTokenByOutputPath(
    outputS3Uri: string,
    type: TaskTokenRecord['type']
  ): Promise<TaskTokenRecord | null> {
    const key = this.buildKey(outputS3Uri, type)

    const response = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          pk: { S: key },
        },
      })
    )

    if (!response.Item) return null

    return {
      invocationArn: response.Item.invocationArn?.S ?? '',
      taskToken: response.Item.taskToken?.S ?? '',
      videoId: response.Item.videoId?.S ?? '',
      outputS3Uri: response.Item.outputS3Uri?.S ?? '',
      type: (response.Item.type?.S as TaskTokenRecord['type']) ?? 'marengo',
    }
  }

  async consumeTaskToken(
    outputS3Uri: string,
    type: TaskTokenRecord['type']
  ): Promise<TaskTokenRecord | null> {
    const record = await this.getTaskTokenByOutputPath(outputS3Uri, type)
    if (!record) return null

    const key = this.buildKey(outputS3Uri, type)
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: {
          pk: { S: key },
        },
      })
    )

    return record
  }

  private buildKey(outputS3Uri: string, type: TaskTokenRecord['type']): string {
    return `${type.toUpperCase()}#${outputS3Uri}`
  }
}
