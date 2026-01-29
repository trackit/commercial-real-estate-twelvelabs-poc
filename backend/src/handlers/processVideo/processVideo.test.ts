import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDownloadVideo = vi.fn();
const mockPutObject = vi.fn();
const mockProcessSegment = vi.fn();
const mockConcatenateSegments = vi.fn();
const mockGetVideoDuration = vi.fn();

vi.mock('../../infrastructure/StorageServices/StorageServices', () => ({
  StorageServices: vi.fn().mockImplementation(() => ({
    downloadVideo: mockDownloadVideo,
    putObject: mockPutObject,
  })),
}));

vi.mock('../../infrastructure/VideoProcessor/VideoProcessor', () => ({
  VideoProcessor: vi.fn().mockImplementation(() => ({
    processSegment: mockProcessSegment,
    concatenateSegments: mockConcatenateSegments,
    getVideoDuration: mockGetVideoDuration,
  })),
}));

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
    s3BucketName: 'test-bucket',
    vectorIndexName: 'test-index',
  })),
}));

vi.mock('fs', () => ({
  mkdtempSync: vi.fn().mockReturnValue('/tmp/video-process-123'),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('video data')),
  rmSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}));

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}));

describe('processVideo handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadVideo.mockResolvedValue(undefined);
    mockPutObject.mockResolvedValue('s3://test-bucket/output.mp4');
    mockProcessSegment.mockResolvedValue('/tmp/segment.mp4');
    mockConcatenateSegments.mockResolvedValue('/tmp/final.mp4');
    mockGetVideoDuration.mockResolvedValue(58.5);
  });

  it('should process video and return result', async () => {
    const { handler } = await import('./processVideo');

    const event = {
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
      ],
      videoId: 'video-123',
      agencyLabel: 'Test Agency',
      streetLabel: '123 Main St',
    };

    const result = (await handler(event, {} as never, () => {})) as {
      finalVideoS3Uri: string;
      segmentCount: number;
      totalDuration: number;
      videoId: string;
    };

    expect(result.finalVideoS3Uri).toBe(
      's3://test-bucket/video-123/output/final.mp4',
    );
    expect(result.segmentCount).toBe(1);
    expect(result.totalDuration).toBe(58.5);
    expect(result.videoId).toBe('video-123');
  });
});
