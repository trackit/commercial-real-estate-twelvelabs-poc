import { describe, it, expect, vi } from 'vitest';
import { GenerateEmbeddingsUseCase } from './generateEmbeddings';
import { EmbeddingGenerator } from '../../ports/embeddingGenerator';

describe('GenerateEmbeddingsUseCase', () => {
  it('should start async embedding and return invocation ARN', async () => {
    const mockEmbeddingGenerator: EmbeddingGenerator = {
      startAsyncEmbedding: vi.fn().mockResolvedValue('arn:aws:bedrock:...'),
      getEmbeddingResult: vi.fn(),
    };

    const useCase = new GenerateEmbeddingsUseCase(mockEmbeddingGenerator);
    const result = await useCase.execute({
      videoId: 'video-123',
      videoS3Uri: 's3://bucket/video.mp4',
      outputS3Uri: 's3://bucket/embeddings/',
    });

    expect(result.invocationArn).toBe('arn:aws:bedrock:...');
    expect(result.videoId).toBe('video-123');
    expect(mockEmbeddingGenerator.startAsyncEmbedding).toHaveBeenCalledWith(
      's3://bucket/video.mp4',
      's3://bucket/embeddings/',
    );
  });

  it('should pass through task token when provided', async () => {
    const mockEmbeddingGenerator: EmbeddingGenerator = {
      startAsyncEmbedding: vi.fn().mockResolvedValue('arn:aws:bedrock:...'),
      getEmbeddingResult: vi.fn(),
    };

    const useCase = new GenerateEmbeddingsUseCase(mockEmbeddingGenerator);
    const result = await useCase.execute({
      videoId: 'video-123',
      videoS3Uri: 's3://bucket/video.mp4',
      outputS3Uri: 's3://bucket/embeddings/',
      taskToken: 'task-token-abc',
    });

    expect(result.taskToken).toBe('task-token-abc');
  });
});
