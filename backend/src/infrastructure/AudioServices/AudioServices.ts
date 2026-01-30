import {
  PollyClient,
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId,
} from '@aws-sdk/client-polly'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { TextToSpeech, TextToSpeechOptions } from '../../ports/textToSpeech'
import { Config } from '../Config/Config'
import { parseS3Uri } from '../../shared/utils'
import { AudioSynthesisError } from '../../shared/errors'

export class AudioServices implements TextToSpeech {
  private pollyClient: PollyClient
  private s3Client: S3Client

  constructor(private config: Config) {
    this.pollyClient = new PollyClient({ region: config.awsRegion })
    this.s3Client = new S3Client({ region: config.awsRegion })
  }

  async synthesize(
    text: string,
    outputS3Uri: string,
    options: TextToSpeechOptions = {}
  ): Promise<string> {
    try {
      const voiceId = (options.voiceId ?? this.config.pollyVoiceId) as VoiceId
      const outputFormat = this.mapOutputFormat(options.outputFormat ?? 'mp3')

      const response = await this.pollyClient.send(
        new SynthesizeSpeechCommand({
          Text: text,
          VoiceId: voiceId,
          OutputFormat: outputFormat,
          Engine: Engine.NEURAL,
        })
      )

      if (!response.AudioStream) {
        throw new AudioSynthesisError('Polly returned no audio stream')
      }

      const audioBytes = await response.AudioStream.transformToByteArray()
      const { bucket, key } = parseS3Uri(outputS3Uri)

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: audioBytes,
          ContentType: this.getContentType(options.outputFormat ?? 'mp3'),
        })
      )

      return outputS3Uri
    } catch (error) {
      if (error instanceof AudioSynthesisError) throw error
      throw new AudioSynthesisError(
        `Failed to synthesize speech: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  private mapOutputFormat(format: 'mp3' | 'ogg_vorbis' | 'pcm'): OutputFormat {
    switch (format) {
      case 'mp3':
        return OutputFormat.MP3
      case 'ogg_vorbis':
        return OutputFormat.OGG_VORBIS
      case 'pcm':
        return OutputFormat.PCM
      default:
        return OutputFormat.MP3
    }
  }

  private getContentType(format: 'mp3' | 'ogg_vorbis' | 'pcm'): string {
    switch (format) {
      case 'mp3':
        return 'audio/mpeg'
      case 'ogg_vorbis':
        return 'audio/ogg'
      case 'pcm':
        return 'audio/pcm'
      default:
        return 'audio/mpeg'
    }
  }
}
