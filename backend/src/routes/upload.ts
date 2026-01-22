import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { TwelveLabsService } from '../services/twelvelabs.js'
import { createError } from '../middleware/errorHandler.js'
import { env } from '../config/env.js'
import { getApiConfigFromHeaders } from '../types/index.js'

const router = Router()

if (!fs.existsSync(env.uploadsDir)) {
  fs.mkdirSync(env.uploadsDir, { recursive: true })
}

const uploadMappingFile = path.join(env.uploadsDir, '.upload-mapping.json')

interface UploadMapping {
  [taskId: string]: {
    originalPath: string
    renamed: boolean
  }
}

function loadUploadMapping(): UploadMapping {
  try {
    if (fs.existsSync(uploadMappingFile)) {
      return JSON.parse(fs.readFileSync(uploadMappingFile, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveUploadMapping(mapping: UploadMapping): void {
  fs.writeFileSync(uploadMappingFile, JSON.stringify(mapping, null, 2))
}

function renameToVideoId(taskId: string, videoId: string): string | null {
  const mapping = loadUploadMapping()
  const entry = mapping[taskId]
  
  if (!entry || entry.renamed) {
    return null
  }

  const originalPath = entry.originalPath
  if (!fs.existsSync(originalPath)) {
    return null
  }

  const ext = path.extname(originalPath)
  const newPath = path.join(env.uploadsDir, `${videoId}${ext}`)
  
  if (fs.existsSync(newPath)) {
    return newPath
  }

  fs.renameSync(originalPath, newPath)
  
  mapping[taskId] = { ...entry, renamed: true }
  saveUploadMapping(mapping)
  
  return newPath
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.uploadsDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only MP4 and MOV files are allowed.'))
    }
  },
})

router.get('/indexes', async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = getApiConfigFromHeaders(req).twelvelabs

  if (!apiKey) {
    next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  try {
    const service = new TwelveLabsService(apiKey)
    const indexes = await service.listIndexes()
    res.json(indexes)
  } catch (error) {
    next(createError(error instanceof Error ? error.message : 'Failed to list indexes', 500))
  }
})

router.post('/indexes', async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = getApiConfigFromHeaders(req).twelvelabs

  if (!apiKey) {
    next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  const { name } = req.body

  if (!name) {
    next(createError('Index name is required', 400, 'VALIDATION_ERROR'))
    return
  }

  try {
    const service = new TwelveLabsService(apiKey)
    const id = await service.createIndex(name)
    res.json({ id })
  } catch (error) {
    next(createError(error instanceof Error ? error.message : 'Failed to create index', 500))
  }
})

router.get('/indexes/:indexId/videos', async (req: Request<{ indexId: string }>, res: Response, next: NextFunction) => {
  const apiKey = getApiConfigFromHeaders(req).twelvelabs

  if (!apiKey) {
    next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  const { indexId } = req.params

  try {
    const service = new TwelveLabsService(apiKey)
    const videos = await service.listVideos(indexId)
    res.json(videos)
  } catch (error) {
    next(createError(error instanceof Error ? error.message : 'Failed to list videos', 500))
  }
})

router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = getApiConfigFromHeaders(req).twelvelabs

    if (!apiKey) {
      next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
      return
    }

    const { indexId } = req.query

    if (!indexId || typeof indexId !== 'string') {
      next(createError('Index ID is required', 400, 'VALIDATION_ERROR'))
      return
    }

    if (!req.file) {
      next(createError('No file uploaded', 400, 'VALIDATION_ERROR'))
      return
    }

    try {
      const filePath = path.resolve(req.file.path)
      const originalName = req.file.originalname

      const service = new TwelveLabsService(apiKey)
      const taskId = await service.uploadVideoFile(indexId, filePath, originalName)
      
      const mapping = loadUploadMapping()
      mapping[taskId] = { originalPath: filePath, renamed: false }
      saveUploadMapping(mapping)
      
      res.json({
        videoId: taskId,
        filePath,
        message: 'Video uploaded to TwelveLabs successfully.',
      })
    } catch (error) {
      next(createError(error instanceof Error ? error.message : 'Failed to upload video', 500))
    }
  }
)

router.get(
  '/videos/:indexId/:videoId/status',
  async (req: Request<{ indexId: string; videoId: string }>, res: Response, next: NextFunction) => {
    const apiKey = getApiConfigFromHeaders(req).twelvelabs

    if (!apiKey) {
      next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
      return
    }

    const { videoId: taskId } = req.params

    try {
      const service = new TwelveLabsService(apiKey)
      const status = await service.getTaskStatus(taskId)
      
      if (status.status === 'ready' && status.id) {
        renameToVideoId(taskId, status.id)
      }
      
      res.json(status)
    } catch (error) {
      next(createError(error instanceof Error ? error.message : 'Failed to get status', 500))
    }
  }
)

function findLocalVideoPath(videoId: string): string | null {
  const extensions = ['.mp4', '.mov', '.m4v']
  for (const ext of extensions) {
    const videoPath = path.join(env.uploadsDir, `${videoId}${ext}`)
    if (fs.existsSync(videoPath)) {
      return videoPath
    }
  }
  return null
}

async function downloadVideoFromHls(hlsUrl: string, outputPath: string): Promise<void> {
  const { spawn } = await import('child_process')
  
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
    
    ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('ffmpeg is not installed. Please install ffmpeg to process videos from TwelveLabs. Run: brew install ffmpeg'))
      } else {
        reject(err)
      }
    })
  })
}

router.get(
  '/videos/:indexId/:videoId/path',
  async (req: Request<{ indexId: string; videoId: string }>, res: Response, next: NextFunction) => {
    const apiKey = getApiConfigFromHeaders(req).twelvelabs

    if (!apiKey) {
      next(createError('TwelveLabs API key not configured', 401, 'NOT_CONFIGURED'))
      return
    }

    const { indexId, videoId } = req.params

    try {
      let localPath = findLocalVideoPath(videoId)
      
      if (localPath) {
        res.json({ path: localPath, source: 'local' })
        return
      }
      
      const service = new TwelveLabsService(apiKey)
      const videoDetails = await service.getVideoDetails(indexId, videoId)
      
      if (!videoDetails.hlsUrl) {
        next(createError('Video does not have a streaming URL available', 404, 'NO_HLS_URL'))
        return
      }
      
      const outputPath = path.join(env.uploadsDir, `${videoId}.mp4`)
      
      await downloadVideoFromHls(videoDetails.hlsUrl, outputPath)
      
      if (!fs.existsSync(outputPath)) {
        next(createError('Failed to download video from TwelveLabs', 500, 'DOWNLOAD_FAILED'))
        return
      }
      
      res.json({ path: outputPath, source: 'downloaded' })
    } catch (error) {
      next(createError(error instanceof Error ? error.message : 'Failed to resolve video path', 500))
    }
  }
)

export default router
