import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSynthesize = vi.fn();

vi.mock('../../infrastructure/AudioServices/AudioServices', () => ({
  AudioServices: vi.fn().mockImplementation(() => ({
    synthesize: mockSynthesize,
  })),
}));

vi.mock('../../infrastructure/Config/Config', () => ({
  Config: vi.fn().mockImplementation(() => ({
    awsRegion: 'us-east-1',
    s3BucketName: 'test-bucket',
    pollyVoiceId: 'Joanna',
  })),
}));

describe('synthesizeAudio handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should synthesize audio for segments with voiceover', async () => {
    mockSynthesize.mockResolvedValue('s3://test-bucket/audio.mp3');

    const { handler } = await import('./synthesizeAudio');

    const event = {
      segments: [
        {
          id: 0,
          title: 'Exterior',
          startTime: 0,
          endTime: 10,
          voiceover: 'Welcome to this property.',
        },
      ],
      videoId: 'video-123',
      videoS3Uri: 's3://bucket/video.mp4',
    };

    const result = (await handler(event, {} as never, () => {})) as {
      segmentsWithAudio: Array<{ audioS3Uri: string }>;
    };

    expect(result.segmentsWithAudio).toHaveLength(1);
    expect(result.segmentsWithAudio[0].audioS3Uri).toBe(
      's3://test-bucket/video-123/audio/audio_0.mp3',
    );
  });
});
