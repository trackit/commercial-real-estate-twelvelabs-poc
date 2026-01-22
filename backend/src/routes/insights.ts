import { Router, Request, Response, NextFunction } from 'express'
import { InsightsService } from '../services/insights.js'
import { createError } from '../middleware/errorHandler.js'
import { getApiConfigFromHeaders } from '../types/index.js'

const router = Router()

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = getApiConfigFromHeaders(req).gemini

  if (!apiKey) {
    next(createError('Google Cloud API key not configured', 401, 'NOT_CONFIGURED'))
    return
  }

  const { address } = req.body

  if (!address || typeof address !== 'string' || address.trim().length < 5) {
    next(createError('Valid address is required', 400, 'VALIDATION_ERROR'))
    return
  }

  try {
    const service = new InsightsService(apiKey)
    const insights = await service.getInsights(address)
    res.json(insights)
  } catch (error) {
    next(createError(error instanceof Error ? error.message : 'Failed to get insights', 500))
  }
})

export default router
