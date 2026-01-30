import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelectSegments = vi.fn()

vi.mock('../../infrastructure/AIServices/AIServices', () => ({
  AIServices: vi.fn().mockImplementation(() => ({
    selectSegments: mockSelectSegments,
  })),
}))

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
    getNovaModelId: () => 'us.amazon.nova-pro-v1:0',
  })),
}))

describe('selectSegments handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should select segments and return results', async () => {
    mockSelectSegments.mockResolvedValue([
      { id: 0, title: 'Exterior', startTime: 0, endTime: 10 },
      { id: 2, title: 'Living Room', startTime: 20, endTime: 35 },
    ])

    const { handler } = await import('./selectSegments')

    const event = {
      analyses: [
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
          id: 2,
          startTime: 20,
          endTime: 35,
          duration: 15,
          roomType: 'Living' as const,
          title: 'Living Room',
          appealScore: 9,
          isHeroCandidate: true,
          isTransitionOnly: false,
        },
      ],
      videoS3Uri: 's3://bucket/video.mp4',
    }

    const result = (await handler(event, {} as never, () => {})) as {
      selectedSegments: unknown[]
      totalDuration: number
      videoS3Uri: string
    }

    expect(result.selectedSegments).toHaveLength(2)
    expect(result.totalDuration).toBe(25)
    expect(result.videoS3Uri).toBe('s3://bucket/video.mp4')
  })
})
