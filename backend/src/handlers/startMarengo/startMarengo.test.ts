import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../infrastructure/AIServices/AIServices', () => ({
  AIServices: vi.fn().mockImplementation(() => ({
    startAsyncEmbedding: vi.fn().mockResolvedValue('arn:aws:bedrock:...'),
    getEmbeddingResult: vi.fn(),
  })),
}));

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
    accountId: '123456789012',
    getMarengoModelId: () => 'twelvelabs.marengo-embed-3-0-v1:0',
    getPegasusModelId: () => 'global.twelvelabs.pegasus-1-2-v1:0',
    getNovaModelId: () => 'us.amazon.nova-pro-v1:0',
  })),
}));

describe('startMarengo handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start Marengo embedding and return result', async () => {
    const { handler } = await import('./startMarengo');

    const event = {
      taskToken: 'task-token-123',
      videoS3Uri: 's3://bucket/video.mp4',
      outputS3Uri: 's3://bucket/embeddings/',
      videoId: 'video-123',
    };

    const result = await handler(event, {} as never, () => {});

    expect(result).toEqual({
      invocationArn: 'arn:aws:bedrock:...',
      videoId: 'video-123',
      taskToken: 'task-token-123',
    });
  });
});
