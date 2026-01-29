import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendTaskSuccess = vi.fn();
const mockSendTaskFailure = vi.fn();
const mockDynamoSend = vi.fn();

vi.mock('../../infrastructure/WorkflowServices/WorkflowServices', () => ({
  WorkflowServices: vi.fn().mockImplementation(() => ({
    sendTaskSuccess: mockSendTaskSuccess,
    sendTaskFailure: mockSendTaskFailure,
  })),
}));

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
  })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: mockDynamoSend,
  })),
  GetItemCommand: vi.fn(),
}));

describe('marengoCallback handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TASK_TOKEN_TABLE = 'task-tokens';
  });

  it('should send task success on completed status', async () => {
    mockDynamoSend.mockResolvedValue({
      Item: {
        invocationArn: { S: 'arn:aws:bedrock:...' },
        taskToken: { S: 'task-token-123' },
        videoId: { S: 'video-123' },
        outputS3Uri: { S: 's3://bucket/embeddings/' },
      },
    });

    const { handler } = await import('./marengoCallback');

    const event = {
      detail: {
        invocationArn: 'arn:aws:bedrock:...',
        status: 'Completed' as const,
        outputDataConfig: {
          s3OutputDataConfig: {
            s3Uri: 's3://bucket/output/embeddings.json',
          },
        },
      },
    };

    await handler(event as never, {} as never, () => {});

    expect(mockSendTaskSuccess).toHaveBeenCalledWith('task-token-123', {
      status: 'Completed',
      videoId: 'video-123',
      outputS3Uri: 's3://bucket/output/embeddings.json',
    });
  });

  it('should send task failure on failed status', async () => {
    mockDynamoSend.mockResolvedValue({
      Item: {
        invocationArn: { S: 'arn:aws:bedrock:...' },
        taskToken: { S: 'task-token-123' },
        videoId: { S: 'video-123' },
        outputS3Uri: { S: 's3://bucket/embeddings/' },
      },
    });

    const { handler } = await import('./marengoCallback');

    const event = {
      detail: {
        invocationArn: 'arn:aws:bedrock:...',
        status: 'Failed' as const,
        failureMessage: 'Processing error',
      },
    };

    await handler(event as never, {} as never, () => {});

    expect(mockSendTaskFailure).toHaveBeenCalledWith(
      'task-token-123',
      'EmbeddingGenerationFailed',
      'Processing error'
    );
  });

  it('should handle missing task token gracefully', async () => {
    mockDynamoSend.mockResolvedValue({ Item: null });

    const { handler } = await import('./marengoCallback');

    const event = {
      detail: {
        invocationArn: 'arn:unknown',
        status: 'Completed' as const,
      },
    };

    await handler(event as never, {} as never, () => {});

    expect(mockSendTaskSuccess).not.toHaveBeenCalled();
  });
});
