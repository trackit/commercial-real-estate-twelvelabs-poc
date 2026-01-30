import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendTaskSuccess = vi.fn()
const mockSendTaskFailure = vi.fn()
const mockDynamoSend = vi.fn()
const mockS3Send = vi.fn()

vi.mock('../../infrastructure/WorkflowServices/WorkflowServices', () => ({
  WorkflowServices: vi.fn().mockImplementation(() => ({
    sendTaskSuccess: mockSendTaskSuccess,
    sendTaskFailure: mockSendTaskFailure,
  })),
}))

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
  })),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: mockDynamoSend,
  })),
  GetItemCommand: vi.fn(),
  DeleteItemCommand: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  GetObjectCommand: vi.fn(),
}))

describe('marengoCallback handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TASK_TOKEN_TABLE = 'task-tokens'
    mockS3Send.mockResolvedValue({})
  })

  it('should send task success on completed status', async () => {
    process.env.S3_BUCKET_NAME = 'test-bucket'
    mockDynamoSend.mockResolvedValue({
      Item: {
        taskToken: { S: 'task-token-123' },
        videoId: { S: 'video-123' },
        type: { S: 'marengo' },
      },
    })

    const { handler } = await import('./marengoCallback')

    const event = {
      detail: {
        bucket: {
          name: 'test-bucket',
        },
        object: {
          key: 'embeddings/video-123/output.json',
        },
      },
    }

    await handler(event as never, {} as never, () => {})

    expect(mockSendTaskSuccess).toHaveBeenCalledWith('task-token-123', {
      status: 'Completed',
      videoId: 'video-123',
      outputS3Uri: 's3://test-bucket/embeddings/video-123/output.json',
    })
  })

  it('should send task failure on failed status', async () => {
    process.env.S3_BUCKET_NAME = 'test-bucket'

    mockDynamoSend.mockResolvedValue({
      Item: {
        taskToken: { S: 'task-token-123' },
        videoId: { S: '5' },
        type: { S: 'pegasus-analysis' },
      },
    })

    mockS3Send.mockRejectedValue(new Error('S3 error'))

    const { handler } = await import('./marengoCallback')

    const event = {
      detail: {
        bucket: {
          name: 'test-bucket',
        },
        object: {
          key: 'analysis/segment-5.json',
        },
      },
    }

    await handler(event as never, {} as never, () => {})

    expect(mockSendTaskFailure).toHaveBeenCalledWith(
      'task-token-123',
      'SegmentAnalysisFailed',
      'S3 error'
    )
  })

  it('should handle missing task token gracefully', async () => {
    process.env.S3_BUCKET_NAME = 'test-bucket'
    mockDynamoSend.mockResolvedValue({ Item: null })

    const { handler } = await import('./marengoCallback')

    const event = {
      detail: {
        bucket: {
          name: 'test-bucket',
        },
        object: {
          key: 'embeddings/video-123/output.json',
        },
      },
    }

    await handler(event as never, {} as never, () => {})

    expect(mockSendTaskSuccess).not.toHaveBeenCalled()
  })
})
