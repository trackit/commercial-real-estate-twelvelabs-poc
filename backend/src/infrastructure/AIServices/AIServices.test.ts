import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIServices } from './AIServices'
import { Config } from '../Config/Config'

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  StartAsyncInvokeCommand: vi.fn(),
  InvokeModelCommand: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetObjectCommand: vi.fn(),
}))

describe('AIServices', () => {
  let aiServices: AIServices
  let config: Config

  beforeEach(() => {
    config = new Config({
      awsRegion: 'us-east-1',
      accountId: '123456789012',
    })
    aiServices = new AIServices(config)
  })

  describe('startAsyncEmbedding', () => {
    it('should return invocation ARN on success', async () => {
      const mockArn = 'arn:aws:bedrock:us-east-1:123456789012:async-invoke/abc123'

      const bedrockClient = (
        aiServices as unknown as {
          bedrockClient: { send: ReturnType<typeof vi.fn> }
        }
      ).bedrockClient
      bedrockClient.send = vi.fn().mockResolvedValue({ invocationArn: mockArn })

      const result = await aiServices.startAsyncEmbedding(
        's3://bucket/video.mp4',
        's3://bucket/output/'
      )

      expect(result).toBe(mockArn)
    })
  })

  describe('selectSegments', () => {
    it('should parse Nova response into SelectedSegments', async () => {
      const mockNovaResponse = {
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  segments: [
                    { id: 0, title: 'Exterior', start_time: 0, end_time: 10 },
                    {
                      id: 1,
                      title: 'Living Room',
                      start_time: 10,
                      end_time: 25,
                    },
                  ],
                }),
              },
            ],
          },
        },
      }

      const bedrockClient = (
        aiServices as unknown as {
          bedrockClient: { send: ReturnType<typeof vi.fn> }
        }
      ).bedrockClient
      bedrockClient.send = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockNovaResponse)),
      })

      const candidates = [
        {
          id: 0,
          startTime: 0,
          endTime: 10,
          duration: 10,
          roomType: 'Exterior' as const,
          title: 'Exterior',
          appealScore: 8,
          isHeroCandidate: true,
          isTransitionOnly: false,
        },
        {
          id: 1,
          startTime: 10,
          endTime: 25,
          duration: 15,
          roomType: 'Living' as const,
          title: 'Living Room',
          appealScore: 9,
          isHeroCandidate: true,
          isTransitionOnly: false,
        },
      ]

      const result = await aiServices.selectSegments(candidates)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(0)
      expect(result[0].title).toBe('Exterior')
      expect(result[1].id).toBe(1)
      expect(result[1].title).toBe('Living Room')
    })

    it('should handle Nova response with markdown code fences', async () => {
      const mockNovaResponse = {
        output: {
          message: {
            content: [
              {
                text: '```json\n{"segments": [{"id": 0, "title": "Kitchen", "start_time": 5, "end_time": 15}]}\n```',
              },
            ],
          },
        },
      }

      const bedrockClient = (
        aiServices as unknown as {
          bedrockClient: { send: ReturnType<typeof vi.fn> }
        }
      ).bedrockClient
      bedrockClient.send = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockNovaResponse)),
      })

      const result = await aiServices.selectSegments([])

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Kitchen')
    })
  })
})
