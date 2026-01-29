import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioServices } from './AudioServices';
import { Config } from '../Config/Config';

vi.mock('@aws-sdk/client-polly', () => ({
  PollyClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  SynthesizeSpeechCommand: vi.fn(),
  Engine: { NEURAL: 'neural' },
  OutputFormat: { MP3: 'mp3', OGG_VORBIS: 'ogg_vorbis', PCM: 'pcm' },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
}));

describe('AudioServices', () => {
  let audioServices: AudioServices;
  let config: Config;

  beforeEach(() => {
    config = new Config({
      awsRegion: 'us-east-1',
      pollyVoiceId: 'Joanna',
    });
    audioServices = new AudioServices(config);
  });

  describe('synthesize', () => {
    it('should synthesize speech and upload to S3', async () => {
      const mockAudioBytes = new Uint8Array([1, 2, 3, 4, 5]);

      const pollyClient = (
        audioServices as unknown as {
          pollyClient: { send: ReturnType<typeof vi.fn> };
        }
      ).pollyClient;
      const s3Client = (
        audioServices as unknown as {
          s3Client: { send: ReturnType<typeof vi.fn> };
        }
      ).s3Client;

      pollyClient.send = vi.fn().mockResolvedValue({
        AudioStream: {
          transformToByteArray: vi.fn().mockResolvedValue(mockAudioBytes),
        },
      });
      s3Client.send = vi.fn().mockResolvedValue({});

      const result = await audioServices.synthesize(
        'Hello, welcome to the property tour.',
        's3://test-bucket/audio/segment1.mp3',
      );

      expect(result).toBe('s3://test-bucket/audio/segment1.mp3');
      expect(pollyClient.send).toHaveBeenCalledTimes(1);
      expect(s3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should throw AudioSynthesisError when Polly returns no audio', async () => {
      const pollyClient = (
        audioServices as unknown as {
          pollyClient: { send: ReturnType<typeof vi.fn> };
        }
      ).pollyClient;
      pollyClient.send = vi.fn().mockResolvedValue({});

      await expect(
        audioServices.synthesize('Test text', 's3://bucket/audio.mp3'),
      ).rejects.toThrow('Polly returned no audio stream');
    });

    it('should use custom voice ID when provided', async () => {
      const mockAudioBytes = new Uint8Array([1, 2, 3]);

      const pollyClient = (
        audioServices as unknown as {
          pollyClient: { send: ReturnType<typeof vi.fn> };
        }
      ).pollyClient;
      const s3Client = (
        audioServices as unknown as {
          s3Client: { send: ReturnType<typeof vi.fn> };
        }
      ).s3Client;

      pollyClient.send = vi.fn().mockResolvedValue({
        AudioStream: {
          transformToByteArray: vi.fn().mockResolvedValue(mockAudioBytes),
        },
      });
      s3Client.send = vi.fn().mockResolvedValue({});

      await audioServices.synthesize('Test', 's3://bucket/audio.mp3', {
        voiceId: 'Matthew',
      });

      expect(pollyClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
