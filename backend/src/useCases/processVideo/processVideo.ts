import { VideoStorage } from '../../ports/videoStorage'
import {
  VideoProcessor,
  SegmentProcessingInput,
} from '../../infrastructure/VideoProcessor/VideoProcessor'
import { SegmentWithAudio } from '../../models/segment'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface ProcessVideoInput {
  videoS3Uri: string
  segments: SegmentWithAudio[]
  outputS3Uri: string
  agencyLabel?: string
  streetLabel?: string
}

export interface ProcessVideoOutput {
  finalVideoS3Uri: string
  totalDuration: number
  segmentCount: number
}

export class ProcessVideoUseCase {
  constructor(
    private videoStorage: VideoStorage,
    private videoProcessor: VideoProcessor
  ) {}

  async execute(input: ProcessVideoInput): Promise<ProcessVideoOutput> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-process-'))
    const localVideoPath = path.join(tempDir, 'source.mp4')
    const segmentPaths: string[] = []

    try {
      await this.videoStorage.downloadVideo(input.videoS3Uri, localVideoPath)

      const introIndex = this.findIntroIndex(input.segments)

      for (let i = 0; i < input.segments.length; i++) {
        const segment = input.segments[i]
        const segmentOutputPath = path.join(tempDir, `segment_${i}.mp4`)

        let audioPath: string | undefined
        if (segment.audioS3Uri) {
          audioPath = path.join(tempDir, `audio_${i}.mp3`)
          await this.videoStorage.downloadVideo(segment.audioS3Uri, audioPath)
        }

        const processingInput: SegmentProcessingInput = {
          videoPath: localVideoPath,
          startTime: segment.startTime,
          endTime: segment.endTime,
          title: segment.title,
          audioPath,
          isIntro: i === introIndex,
          agencyLabel: input.agencyLabel,
          streetLabel: input.streetLabel,
        }

        await this.videoProcessor.processSegment(processingInput, segmentOutputPath)
        segmentPaths.push(segmentOutputPath)
      }

      const finalLocalPath = path.join(tempDir, 'final.mp4')
      await this.videoProcessor.concatenateSegments(segmentPaths, finalLocalPath)

      const finalVideoData = fs.readFileSync(finalLocalPath)
      const { bucket, key } = this.parseS3Uri(input.outputS3Uri)
      await this.videoStorage.putObject(bucket, key, finalVideoData, 'video/mp4')

      const totalDuration = await this.videoProcessor.getVideoDuration(finalLocalPath)

      return {
        finalVideoS3Uri: input.outputS3Uri,
        totalDuration,
        segmentCount: input.segments.length,
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  private findIntroIndex(segments: SegmentWithAudio[]): number {
    const introPatterns = [/exterior/i, /front/i, /outdoor/i]

    for (let i = 0; i < segments.length; i++) {
      if (introPatterns.some((pattern) => pattern.test(segments[i].title))) {
        return i
      }
    }

    return 0
  }

  private parseS3Uri(s3Uri: string): { bucket: string; key: string } {
    const match = s3Uri.match(/^s3:\/\/([^/]+)\/(.+)$/)
    if (!match) throw new Error(`Invalid S3 URI: ${s3Uri}`)
    return { bucket: match[1], key: match[2] }
  }
}
