import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoProcessor } from './VideoProcessor'

vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation(() => {
    const mockProcess = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('Duration: 00:01:00.50, start: 0.000000'))
        }),
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') setTimeout(() => callback(0), 10)
      }),
    }
    return mockProcess
  }),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

describe('VideoProcessor', () => {
  let videoProcessor: VideoProcessor

  beforeEach(() => {
    videoProcessor = new VideoProcessor({
      fontPath: '/fonts/DejaVuSans-Bold.ttf',
      tempDir: '/tmp',
      enableTextOverlay: true,
    })
    vi.clearAllMocks()
  })

  describe('buildFilter', () => {
    it('should build basic room label filter', () => {
      const filter = (
        videoProcessor as unknown as { buildFilter: (title: string) => string }
      ).buildFilter('Living Room')

      expect(filter).toContain('LIVING ROOM')
      expect(filter).toContain('drawtext')
      expect(filter).toContain('fontcolor=white')
    })

    it('should build intro filter with agency and street', () => {
      const filter = (
        videoProcessor as unknown as {
          buildFilter: (
            title: string,
            isIntro?: boolean,
            agencyLabel?: string,
            streetLabel?: string
          ) => string
        }
      ).buildFilter('Exterior', true, 'Skyline Estates', '123 Main Street')

      expect(filter).toContain('Skyline Estates')
      expect(filter).toContain('123 Main Street')
      expect(filter).toContain('EXTERIOR')
    })
  })

  describe('sanitizeText', () => {
    it('should remove special characters', () => {
      const sanitize = (videoProcessor as unknown as { sanitizeText: (text: string) => string })
        .sanitizeText

      expect(sanitize.call(videoProcessor, "Living Room's")).toBe('Living Rooms')
      expect(sanitize.call(videoProcessor, 'Kitchen: Modern')).toBe('Kitchen- Modern')
      expect(sanitize.call(videoProcessor, '"Bathroom"')).toBe('Bathroom')
    })
  })

  describe('getVideoDuration', () => {
    it('should return video duration in seconds', async () => {
      const duration = await videoProcessor.getVideoDuration('/path/to/video.mp4')

      expect(duration).toBe(60.5)
    })
  })

  describe('concatenateSegments', () => {
    it('should throw error when no segments provided', async () => {
      await expect(videoProcessor.concatenateSegments([], '/output.mp4')).rejects.toThrow(
        'No segments to concatenate'
      )
    })
  })
})
