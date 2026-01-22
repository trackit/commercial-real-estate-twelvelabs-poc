import { Router, Request, Response, NextFunction } from 'express'
import { ElevenLabsService } from '../services/elevenlabs.js'
import { createError } from '../middleware/errorHandler.js'
import { getApiConfigFromHeaders } from '../types/index.js'

const router = Router()

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = getApiConfigFromHeaders(req).elevenlabs

  if (!apiKey) {
    next(createError('ElevenLabs API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  try {
    const service = new ElevenLabsService(apiKey)
    const voices = await service.listVoices()
    res.json(voices)
  } catch (error) {
    next(createError(error instanceof Error ? error.message : 'Failed to list voices', 500))
  }
})

export default router
