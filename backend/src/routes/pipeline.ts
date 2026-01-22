import { Router, Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { scriptRunner } from '../services/scriptRunner.js'
import { TwelveLabsService } from '../services/twelvelabs.js'
import { createError } from '../middleware/errorHandler.js'
import { env } from '../config/env.js'
import type { PipelineConfig } from '../types/index.js'
import { getApiConfigFromHeaders } from '../types/index.js'

const router = Router()

if (!fs.existsSync(env.outputsDir)) {
  fs.mkdirSync(env.outputsDir, { recursive: true })
}

function findLocalVideoPath(videoId: string): string | null {
  const extensions = ['.mp4', '.mov', '.m4v']
  const absoluteUploadsDir = path.resolve(env.uploadsDir)
  for (const ext of extensions) {
    const videoPath = path.join(absoluteUploadsDir, `${videoId}${ext}`)
    if (fs.existsSync(videoPath)) {
      return videoPath
    }
  }
  return null
}

async function downloadVideoFromHls(hlsUrl: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', hlsUrl,
      '-c', 'copy',
      '-y',
      outputPath
    ])
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
    
    ffmpeg.on('error', (err) => {
      reject(err)
    })
  })
}

async function resolveVideoPath(service: TwelveLabsService, indexId: string, videoId: string): Promise<string> {
  let localPath = findLocalVideoPath(videoId)
  
  if (localPath) {
    return localPath
  }
  
  const videoDetails = await service.getVideoDetails(indexId, videoId)
  
  if (!videoDetails.hlsUrl) {
    throw new Error('Video does not have a streaming URL available')
  }
  
  const outputPath = path.resolve(env.uploadsDir, `${videoId}.mp4`)
  
  await downloadVideoFromHls(videoDetails.hlsUrl, outputPath)
  
  if (!fs.existsSync(outputPath)) {
    throw new Error('Failed to download video from TwelveLabs')
  }
  
  return outputPath
}

router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  const apiConfig = getApiConfigFromHeaders(req)

  if (!apiConfig?.twelvelabs) {
    next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  if (!apiConfig.gemini) {
    next(createError('Gemini API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  const { videoId, indexId, videoPath: providedVideoPath, ttsProvider, voiceId, agencyName, streetName } = req.body

  if (!videoId || !indexId) {
    next(createError('Missing required fields: videoId, indexId', 400, 'VALIDATION_ERROR'))
    return
  }

  if (!voiceId) {
    next(createError('Missing required field: voiceId', 400, 'VALIDATION_ERROR'))
    return
  }

  if (ttsProvider === 'elevenlabs' && !apiConfig.elevenlabs) {
    next(createError('ElevenLabs API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  let videoPath = providedVideoPath
  
  if (!videoPath) {
    try {
      const service = new TwelveLabsService(apiConfig.twelvelabs)
      videoPath = await resolveVideoPath(service, indexId, videoId)
    } catch (error) {
      next(createError(error instanceof Error ? error.message : 'Failed to resolve video path', 500))
      return
    }
  }

  const jobId = uuidv4()
  const outputPath = path.resolve(env.outputsDir, `${jobId}.mp4`)

  const config: PipelineConfig = {
    videoId,
    indexId,
    videoPath,
    outputPath,
    ttsProvider: ttsProvider || 'elevenlabs',
    voiceId,
    agencyName,
    streetName,
  }

  try {
    await scriptRunner.startPipeline(jobId, config, {
      twelvelabs: apiConfig.twelvelabs,
      gemini: apiConfig.gemini,
      elevenlabs: apiConfig.elevenlabs,
    })

    res.json({ jobId })
  } catch (error) {
    next(createError(error instanceof Error ? error.message : 'Failed to start pipeline', 500))
  }
})

router.get('/progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const listener = (update: unknown) => {
    res.write(`data: ${JSON.stringify(update)}\n\n`)
  }

  scriptRunner.on(`progress:${jobId}`, listener)

  req.on('close', () => {
    scriptRunner.off(`progress:${jobId}`, listener)
  })
})

router.get('/result/:jobId', (req: Request<{ jobId: string }>, res: Response, next: NextFunction) => {
  const { jobId } = req.params
  const job = scriptRunner.getJob(jobId)

  if (!job) {
    next(createError('Job not found', 404, 'NOT_FOUND'))
    return
  }

  if (job.status !== 'complete' || !job.outputPath) {
    next(createError('Job not complete', 400, 'JOB_INCOMPLETE'))
    return
  }

  res.json({
    status: job.status,
    outputPath: job.outputPath,
    downloadUrl: `/api/output/${path.basename(job.outputPath)}`,
  })
})

router.delete('/:jobId', (req: Request<{ jobId: string }>, res: Response) => {
  const { jobId } = req.params
  scriptRunner.cancelPipeline(jobId)
  res.json({ success: true })
})

export default router
