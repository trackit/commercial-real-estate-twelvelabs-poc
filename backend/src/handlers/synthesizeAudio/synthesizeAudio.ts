import { Handler } from 'aws-lambda'
import { AudioServices } from '../../infrastructure/AudioServices/AudioServices'
import { SynthesizeAudioUseCase } from '../../useCases/synthesizeAudio'
import { Config } from '../../infrastructure/Config/Config'
import { SegmentWithVoiceover, SegmentWithAudio } from '../../models/segment'

interface SynthesizeAudioEvent {
  segments: SegmentWithVoiceover[]
  videoId: string
  videoS3Uri: string
  voiceId?: string
}

interface SynthesizeAudioResult {
  segmentsWithAudio: SegmentWithAudio[]
  videoId: string
  videoS3Uri: string
}

export const handler: Handler<SynthesizeAudioEvent, SynthesizeAudioResult> = async (event) => {
  const config = new Config()
  const audioServices = new AudioServices(config)
  const useCase = new SynthesizeAudioUseCase(audioServices)

  const result = await useCase.execute({
    segments: event.segments,
    outputBucket: config.s3BucketName,
    outputPrefix: `${event.videoId}/audio`,
    voiceId: event.voiceId,
  })

  return {
    segmentsWithAudio: result.segmentsWithAudio,
    videoId: event.videoId,
    videoS3Uri: event.videoS3Uri,
  }
}
