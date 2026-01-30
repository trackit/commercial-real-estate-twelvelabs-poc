import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessVideoUseCase } from './processVideo'
import { VideoStorage } from '../../ports/videoStorage'
import { VideoProcessor } from '../../infrastructure/VideoProcessor/VideoProcessor'

vi.mock('fs', () => ({
  mkdtempSync: vi.fn().mockReturnValue('/tmp/video-process-123'),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('video data')),
  rmSync: vi.fn(),
}))

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}))

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}))

describe('ProcessVideoUseCase', () => {
  let mockStorage: VideoStorage
  let mockProcessor: VideoProcessor
  let useCase: ProcessVideoUseCase

  beforeEach(() => {
    mockStorage = {
      downloadVideo: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockResolvedValue('s3://bucket/output.mp4'),
    }

    mockProcessor = {
      processSegment: vi.fn().mockResolvedValue('/tmp/segment.mp4'),
      concatenateSegments: vi.fn().mockResolvedValue('/tmp/final.mp4'),
      getVideoDuration: vi.fn().mockResolvedValue(60.5),
    } as unknown as VideoProcessor

    useCase = new ProcessVideoUseCase(mockStorage, mockProcessor)
  })

  it('should process all segments and concatenate', async () => {
    const result = await useCase.execute({
      videoS3Uri: 's3://bucket/source.mp4',
      segments: [
        {
          id: 0,
          title: 'Exterior',
          startTime: 0,
          endTime: 10,
          voiceover: 'Welcome.',
          audioS3Uri: 's3://bucket/audio_0.mp3',
        },
        {
          id: 1,
          title: 'Living Room',
          startTime: 10,
          endTime: 25,
          voiceover: 'Spacious living.',
          audioS3Uri: 's3://bucket/audio_1.mp3',
        },
      ],
      outputS3Uri: 's3://bucket/output/final.mp4',
    })

    expect(result.finalVideoS3Uri).toBe('s3://bucket/output/final.mp4')
    expect(result.segmentCount).toBe(2)
    expect(result.totalDuration).toBe(60.5)
    expect(mockProcessor.processSegment).toHaveBeenCalledTimes(2)
    expect(mockProcessor.concatenateSegments).toHaveBeenCalledTimes(1)
  })

  it('should identify intro segment by title pattern', async () => {
    await useCase.execute({
      videoS3Uri: 's3://bucket/source.mp4',
      segments: [
        {
          id: 0,
          title: 'Living Room',
          startTime: 0,
          endTime: 10,
          voiceover: '',
          audioS3Uri: '',
        },
        {
          id: 1,
          title: 'Front Entrance',
          startTime: 10,
          endTime: 20,
          voiceover: '',
          audioS3Uri: '',
        },
      ],
      outputS3Uri: 's3://bucket/output.mp4',
      agencyLabel: 'Test Agency',
      streetLabel: '123 Main St',
    })

    expect(mockProcessor.processSegment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ isIntro: false }),
      expect.any(String)
    )
    expect(mockProcessor.processSegment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ isIntro: true }),
      expect.any(String)
    )
  })

  it('should handle segments without audio', async () => {
    await useCase.execute({
      videoS3Uri: 's3://bucket/source.mp4',
      segments: [
        {
          id: 0,
          title: 'Test',
          startTime: 0,
          endTime: 10,
          voiceover: '',
          audioS3Uri: '',
        },
      ],
      outputS3Uri: 's3://bucket/output.mp4',
    })

    expect(mockStorage.downloadVideo).toHaveBeenCalledTimes(1)
    expect(mockProcessor.processSegment).toHaveBeenCalledWith(
      expect.objectContaining({ audioPath: undefined }),
      expect.any(String)
    )
  })
})
