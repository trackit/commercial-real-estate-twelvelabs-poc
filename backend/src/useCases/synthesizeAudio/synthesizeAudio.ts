import { TextToSpeech } from '../../ports/textToSpeech';
import { SegmentWithVoiceover, SegmentWithAudio } from '../../models/segment';

export interface SynthesizeAudioInput {
  segments: SegmentWithVoiceover[];
  outputBucket: string;
  outputPrefix: string;
  voiceId?: string;
}

export interface SynthesizeAudioOutput {
  segmentsWithAudio: SegmentWithAudio[];
}

export class SynthesizeAudioUseCase {
  constructor(private textToSpeech: TextToSpeech) {}

  async execute(input: SynthesizeAudioInput): Promise<SynthesizeAudioOutput> {
    const segmentsWithAudio: SegmentWithAudio[] = [];

    for (const segment of input.segments) {
      if (!segment.voiceover) {
        segmentsWithAudio.push({
          ...segment,
          audioS3Uri: '',
        });
        continue;
      }

      const audioKey = `${input.outputPrefix}/audio_${segment.id}.mp3`;
      const audioS3Uri = `s3://${input.outputBucket}/${audioKey}`;

      await this.textToSpeech.synthesize(segment.voiceover, audioS3Uri, {
        voiceId: input.voiceId,
      });

      segmentsWithAudio.push({
        ...segment,
        audioS3Uri,
      });
    }

    return { segmentsWithAudio };
  }
}
