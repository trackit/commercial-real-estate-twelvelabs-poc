import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEmbeddingResult = vi.fn()
const mockStoreEmbeddings = vi.fn()

vi.mock('../../infrastructure/AIServices/AIServices', () => ({
  AIServices: vi.fn().mockImplementation(() => ({
    getEmbeddingResult: mockGetEmbeddingResult,
  })),
}))

vi.mock('../../infrastructure/StorageServices/StorageServices', () => ({
  StorageServices: vi.fn().mockImplementation(() => ({
    storeEmbeddings: mockStoreEmbeddings,
  })),
}))

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
    vectorIndexName: 'test-index',
  })),
}))

describe('storeEmbeddings handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should store embeddings and return segments', async () => {
    mockGetEmbeddingResult.mockResolvedValue({
      data: [
        {
          startSec: 0,
          endSec: 10,
          embedding: [0.1, 0.2],
          embeddingScope: 'clip',
        },
        {
          startSec: 10,
          endSec: 25,
          embedding: [0.3, 0.4],
          embeddingScope: 'clip',
        },
      ],
    })
    mockStoreEmbeddings.mockResolvedValue(undefined)

    const { handler } = await import('./storeEmbeddings')

    const event = {
      videoId: 'video-123',
      embeddingsS3Uri: 's3://bucket/embeddings/output.json',
    }

    const result = (await handler(event, {} as never, () => {})) as {
      segments: Array<{
        id: number
        startTime: number
        endTime: number
        duration: number
      }>
    }

    expect(result.segments).toHaveLength(2)
    expect(result.segments[0]).toEqual({
      id: 0,
      startTime: 0,
      endTime: 10,
      duration: 10,
    })
    expect(result.segments[1]).toEqual({
      id: 1,
      startTime: 10,
      endTime: 25,
      duration: 15,
    } as { id: number; startTime: number; endTime: number; duration: number })
    expect(mockStoreEmbeddings).toHaveBeenCalledWith('video-123', expect.any(Array))
  })
})
