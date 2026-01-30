import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageServices } from './StorageServices'
import { Config } from '../Config/Config'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
}))

vi.mock('fs', () => ({
  createReadStream: vi.fn(),
  createWriteStream: vi.fn().mockReturnValue({
    on: vi.fn((event, callback) => {
      if (event === 'finish') callback()
    }),
  }),
}))

describe('StorageServices', () => {
  let storageServices: StorageServices
  let config: Config

  beforeEach(() => {
    config = new Config({
      awsRegion: 'us-east-1',
      s3BucketName: 'test-bucket',
    })
    storageServices = new StorageServices(config, 'test-index')
  })

  describe('storeEmbeddings', () => {
    it('should store embeddings in S3', async () => {
      const s3Client = (
        storageServices as unknown as {
          s3Client: { send: ReturnType<typeof vi.fn> }
        }
      ).s3Client
      s3Client.send = vi.fn().mockResolvedValue({})

      const segments = [
        { startTime: 0, endTime: 10, embedding: [0.1, 0.2, 0.3] },
        { startTime: 10, endTime: 20, embedding: [0.4, 0.5, 0.6] },
      ]

      await storageServices.storeEmbeddings('video-123', segments)

      expect(s3Client.send).toHaveBeenCalledTimes(1)
    })
  })

  describe('putObject', () => {
    it('should upload object to S3 and return S3 URI', async () => {
      const s3Client = (
        storageServices as unknown as {
          s3Client: { send: ReturnType<typeof vi.fn> }
        }
      ).s3Client
      s3Client.send = vi.fn().mockResolvedValue({})

      const result = await storageServices.putObject(
        'test-bucket',
        'test-key',
        Buffer.from('data'),
        'audio/mpeg'
      )

      expect(result).toBe('s3://test-bucket/test-key')
      expect(s3Client.send).toHaveBeenCalledTimes(1)
    })
  })
})
