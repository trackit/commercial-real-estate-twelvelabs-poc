import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'
import type { PipelineConfig, PipelineJob } from '../types/index.js'
import { env } from '../config/env.js'

interface StepUpdate {
  type: 'step'
  step: {
    id: string
    status: 'running' | 'complete' | 'error'
    progress?: number
    detail?: string
  }
}


interface LogUpdate {
  type: 'log'
  message: string
}

interface CompleteUpdate {
  type: 'complete'
  outputPath: string
}

interface ErrorUpdate {
  type: 'error'
  error: string
}

export class ScriptRunner extends EventEmitter {
  private jobs: Map<string, PipelineJob> = new Map()
  private processes: Map<string, ChildProcess> = new Map()

  async startPipeline(
    jobId: string,
    config: PipelineConfig,
    apiConfig: { twelvelabs?: string; gemini?: string; elevenlabs?: string }
  ): Promise<void> {
    const job: PipelineJob = {
      id: jobId,
      status: 'running',
      config,
      startedAt: new Date(),
    }
    this.jobs.set(jobId, job)

    const scriptPath = path.resolve(process.cwd(), env.scriptPath)
    const scriptCwd = path.dirname(scriptPath)

    const resolvedVideoPath = path.resolve(config.videoPath)
    const resolvedOutputPath = path.resolve(config.outputPath)

    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
      TL_API_KEY: apiConfig.twelvelabs,
      TL_VIDEO_ID: config.videoId,
      TL_INDEX_ID: config.indexId,
      VIDEO_PATH: resolvedVideoPath,
      OUTPUT_PATH: resolvedOutputPath,
      GEMINI_API_KEY: apiConfig.gemini,
      TTS_PROVIDER: config.ttsProvider,
      ELEVENLABS_API_KEY: apiConfig.elevenlabs,
      ELEVENLABS_VOICE_ID: config.voiceId,
      LLM_PROVIDER: config.llmProvider || 'nova',
    }

    const child = spawn('bash', [scriptPath], {
      env: envVars,
      cwd: scriptCwd,
    })

    this.processes.set(jobId, child)

    let segmentCount = 0
    let annotationCount = 0

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')

      for (const line of lines) {
        if (!line.trim()) continue

        this.emit(`progress:${jobId}`, { type: 'log', message: line } as LogUpdate)

        if (line.includes('Retrieving Marengo scene segments')) {
          this.emitStep(jobId, 'retrieve', 'running')
        } else if (line.includes('Total segments:')) {
          const match = line.match(/Total segments: (\d+)/)
          if (match) {
            segmentCount = parseInt(match[1], 10)
            this.emitStep(jobId, 'retrieve', 'complete', undefined, `${segmentCount} segments`)
            this.emitStep(jobId, 'annotate', 'running')
          }
        } else if (line.includes('[ANN]')) {
          annotationCount++
          if (segmentCount > 0) {
            const progress = Math.round((annotationCount / segmentCount) * 100)
            this.emitStep(jobId, 'annotate', 'running', progress, `${annotationCount}/${segmentCount}`)
          }
        } else if (line.includes('Pegasus annotated')) {
          this.emitStep(jobId, 'annotate', 'complete')
          this.emitStep(jobId, 'filter', 'running')
        } else if (line.includes('candidates remain for LLM selection')) {
          const match = line.match(/(\d+) candidates/)
          this.emitStep(jobId, 'filter', 'complete', undefined, match ? `${match[1]} candidates` : undefined)
          this.emitStep(jobId, 'select', 'running')
        } else if (line.includes('Nova selected') || line.includes('Gemini selected')) {
          const match = line.match(/selected (\d+) segments/)
          this.emitStep(jobId, 'select', 'complete', undefined, match ? `${match[1]} segments` : undefined)
          this.emitStep(jobId, 'voiceover', 'running')
        } else if (line.includes('[VO]')) {
          const match = line.match(/\[VO\] (\d+): (.+?) \(/)
          if (match) {
            this.emitStep(jobId, 'voiceover', 'running', undefined, `Segment ${parseInt(match[1]) + 1}: ${match[2]}`)
          }
        } else if (line.includes('Cutting segments')) {
          this.emitStep(jobId, 'voiceover', 'complete')
          this.emitStep(jobId, 'audio', 'running')
        } else if (line.includes('[JOB')) {
          this.emitStep(jobId, 'audio', 'running')
          this.emitStep(jobId, 'render', 'running')
        } else if (line.includes('Concatenating segments')) {
          this.emitStep(jobId, 'render', 'complete')
          this.emitStep(jobId, 'concat', 'running')
        } else if (line.includes('Done. Final short video:')) {
          this.emitStep(jobId, 'concat', 'complete')
        }
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const message = data.toString()
      this.emit(`progress:${jobId}`, { type: 'log', message: `[ERROR] ${message}` } as LogUpdate)
    })

    child.on('close', (code) => {
      this.processes.delete(jobId)
      const job = this.jobs.get(jobId)

      if (job) {
        if (code === 0) {
          job.status = 'complete'
          job.completedAt = new Date()
          job.outputPath = config.outputPath
          this.emit(`progress:${jobId}`, {
            type: 'complete',
            outputPath: config.outputPath,
          } as CompleteUpdate)
        } else {
          job.status = 'error'
          job.error = `Process exited with code ${code}`
          this.emit(`progress:${jobId}`, {
            type: 'error',
            error: job.error,
          } as ErrorUpdate)
        }
      }
    })

    child.on('error', (error) => {
      this.processes.delete(jobId)
      const job = this.jobs.get(jobId)
      if (job) {
        job.status = 'error'
        job.error = error.message
        this.emit(`progress:${jobId}`, {
          type: 'error',
          error: error.message,
        } as ErrorUpdate)
      }
    })
  }

  private emitStep(
    jobId: string,
    stepId: string,
    status: 'running' | 'complete' | 'error',
    progress?: number,
    detail?: string
  ): void {
    this.emit(`progress:${jobId}`, {
      type: 'step',
      step: { id: stepId, status, progress, detail },
    } as StepUpdate)
  }

  cancelPipeline(jobId: string): void {
    const process = this.processes.get(jobId)
    if (process) {
      process.kill()
      this.processes.delete(jobId)
    }
    this.jobs.delete(jobId)
  }

  getJob(jobId: string): PipelineJob | undefined {
    return this.jobs.get(jobId)
  }
}

export const scriptRunner = new ScriptRunner()
