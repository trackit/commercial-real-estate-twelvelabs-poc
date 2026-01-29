import { describe, it, expect, vi } from 'vitest';
import { SynthesizeAudioUseCase } from './synthesizeAudio';
import { TextToSpeech } from '../../ports/textToSpeech';

describe('SynthesizeAudioUseCase', () => {
  it('should synthesize audio for each segment with voiceover', async () => {
    const mockTTS: TextToSpeech = {
      synthesize: vi.fn().mockResolvedValue('s3://bucket/audio.mp3'),
    };

    const useCase = new SynthesizeAudioUseCase(mockTTS);
    const result = await useCase.execute({
      segments: [
        {
          id: 0,
          title: 'Exterior',
          startTime: 0,
          endTime: 10,
          voiceover: 'Welcome to this property.',
        },
        {
          id: 1,
          title: 'Living Room',
          startTime: 10,
          endTime: 25,
          voiceover: 'The living room is spacious.',
        },
      ],
      outputBucket: 'test-bucket',
      outputPrefix: 'video-123/audio',
    });

    expect(result.segmentsWithAudio).toHaveLength(2);
    expect(result.segmentsWithAudio[0].audioS3Uri).toBe(
      's3://test-bucket/video-123/audio/audio_0.mp3',
    );
    expect(mockTTS.synthesize).toHaveBeenCalledTimes(2);
  });

  it('should skip audio synthesis for segments without voiceover', async () => {
    const mockTTS: TextToSpeech = {
      synthesize: vi.fn().mockResolvedValue('s3://bucket/audio.mp3'),
    };

    const useCase = new SynthesizeAudioUseCase(mockTTS);
    const result = await useCase.execute({
      segments: [
        {
          id: 0,
          title: 'Exterior',
          startTime: 0,
          endTime: 10,
          voiceover: 'Welcome.',
        },
        {
          id: 1,
          title: 'Hallway',
          startTime: 10,
          endTime: 15,
          voiceover: '',
        },
      ],
      outputBucket: 'test-bucket',
      outputPrefix: 'video-123/audio',
    });

    expect(result.segmentsWithAudio[1].audioS3Uri).toBe('');
    expect(mockTTS.synthesize).toHaveBeenCalledTimes(1);
  });

  it('should pass custom voice ID to TTS', async () => {
    const mockTTS: TextToSpeech = {
      synthesize: vi.fn().mockResolvedValue('s3://bucket/audio.mp3'),
    };

    const useCase = new SynthesizeAudioUseCase(mockTTS);
    await useCase.execute({
      segments: [
        {
          id: 0,
          title: 'Test',
          startTime: 0,
          endTime: 10,
          voiceover: 'Test text.',
        },
      ],
      outputBucket: 'bucket',
      outputPrefix: 'prefix',
      voiceId: 'Matthew',
    });

    expect(mockTTS.synthesize).toHaveBeenCalledWith(
      'Test text.',
      expect.any(String),
      { voiceId: 'Matthew' },
    );
  });
});
