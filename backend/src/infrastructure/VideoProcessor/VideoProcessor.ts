import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { VideoProcessingError } from '../../shared/errors'

export interface VideoProcessorOptions {
  fontPath?: string
  tempDir?: string
  enableTextOverlay?: boolean
  ffmpegPath?: string
}

export interface SegmentProcessingInput {
  videoPath: string
  startTime: number
  endTime: number
  title: string
  audioPath?: string
  isIntro?: boolean
  agencyLabel?: string
  streetLabel?: string
}

export class VideoProcessor {
  private fontPath: string
  private tempDir: string
  private enableTextOverlay: boolean
  private ffmpegPath: string

  constructor(options: VideoProcessorOptions = {}) {
    this.fontPath = options.fontPath ?? '/opt/fonts/DejaVuSans-Bold.ttf'
    this.tempDir = options.tempDir ?? os.tmpdir()
    this.enableTextOverlay = options.enableTextOverlay ?? false
    this.ffmpegPath = options.ffmpegPath ?? '/opt/bin/ffmpeg'
  }

  async processSegment(input: SegmentProcessingInput, outputPath: string): Promise<string> {
    const { videoPath, startTime, endTime, title, audioPath, isIntro, agencyLabel, streetLabel } =
      input

    const videoNoAudio = path.join(this.tempDir, `segment_${Date.now()}_video.mp4`)

    try {
      const filter = this.buildFilter(title, isIntro, agencyLabel, streetLabel)

      const ffmpegArgs = ['-ss', startTime.toString(), '-to', endTime.toString(), '-i', videoPath]

      if (filter) {
        ffmpegArgs.push('-vf', filter)
      }

      ffmpegArgs.push(
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-movflags',
        '+faststart',
        '-y',
        videoNoAudio
      )

      await this.runFfmpeg(ffmpegArgs)

      if (audioPath && fs.existsSync(audioPath)) {
        await this.runFfmpeg([
          '-i',
          videoNoAudio,
          '-i',
          audioPath,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-shortest',
          '-movflags',
          '+faststart',
          '-y',
          outputPath,
        ])
        fs.unlinkSync(videoNoAudio)
      } else {
        fs.renameSync(videoNoAudio, outputPath)
      }

      return outputPath
    } catch (error) {
      if (fs.existsSync(videoNoAudio)) {
        fs.unlinkSync(videoNoAudio)
      }
      throw new VideoProcessingError(
        `Failed to process segment: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  async concatenateSegments(segmentPaths: string[], outputPath: string): Promise<string> {
    if (segmentPaths.length === 0) {
      throw new VideoProcessingError('No segments to concatenate')
    }

    const listFile = path.join(this.tempDir, `concat_${Date.now()}.txt`)

    try {
      const listContent = segmentPaths.map((p) => `file '${p}'`).join('\n')
      fs.writeFileSync(listFile, listContent)

      await this.runFfmpeg([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-y',
        outputPath,
      ])

      return outputPath
    } finally {
      if (fs.existsSync(listFile)) {
        fs.unlinkSync(listFile)
      }
    }
  }

  async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, ['-i', videoPath, '-f', 'null', '-'])

      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ffmpeg.on('close', () => {
        const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
        if (match) {
          const hours = parseInt(match[1], 10)
          const minutes = parseInt(match[2], 10)
          const seconds = parseInt(match[3], 10)
          const centiseconds = parseInt(match[4], 10)
          const duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100
          resolve(duration)
        } else {
          reject(new VideoProcessingError(`Could not parse duration from ffmpeg output`))
        }
      })

      ffmpeg.on('error', (err) => {
        reject(new VideoProcessingError(`ffmpeg error: ${err.message}`))
      })
    })
  }

  private buildFilter(
    title: string,
    isIntro?: boolean,
    agencyLabel?: string,
    streetLabel?: string
  ): string | null {
    if (!this.enableTextOverlay) {
      return null
    }

    const sanitizedTitle = this.sanitizeText(title).toUpperCase()

    const roomTextFilter = `drawbox=x=w-iw:y=h-200:w=iw:h=200:color=black@0.75:t=fill,drawtext=fontfile=${this.fontPath}:text='${sanitizedTitle}':x=w-text_w-50:y=h-text_h-50:fontsize=140:fontcolor=white:bordercolor=black:borderw=8:shadowx=5:shadowy=5`

    if (isIntro && agencyLabel && streetLabel) {
      const sanitizedAgency = this.sanitizeText(agencyLabel)
      const sanitizedStreet = this.sanitizeText(streetLabel)

      const agencyFilter = `drawtext=fontfile=${this.fontPath}:text='${sanitizedAgency}':x=(w-text_w)/2:y=h*0.15-60:fontsize=64:fontcolor=white:bordercolor=black:borderw=5:shadowx=3:shadowy=3`
      const streetFilter = `drawtext=fontfile=${this.fontPath}:text='${sanitizedStreet}':x=(w-text_w)/2:y=h*0.15:fontsize=48:fontcolor=white:bordercolor=black:borderw=4:shadowx=3:shadowy=3`

      return `${agencyFilter},${streetFilter},${roomTextFilter}`
    }

    return roomTextFilter
  }

  private sanitizeText(text: string): string {
    return text.replace(/'/g, '').replace(/:/g, '-').replace(/"/g, '').trim()
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, ['-nostdin', '-loglevel', 'error', ...args])

      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new VideoProcessingError(`ffmpeg exited with code ${code}: ${stderr}`))
        }
      })

      ffmpeg.on('error', (err) => {
        reject(new VideoProcessingError(`ffmpeg error: ${err.message}`))
      })
    })
  }
}
