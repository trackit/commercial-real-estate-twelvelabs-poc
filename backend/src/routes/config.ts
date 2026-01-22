import { Router, Request, Response } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import { TwelveLabsService } from '../services/twelvelabs.js'

const execAsync = promisify(exec)

const router = Router()

router.post('/test', async (req: Request, res: Response) => {
  const { provider, apiKey } = req.body

  if (!provider) {
    res.status(400).json({ valid: false, error: 'Missing provider' })
    return
  }

  if (provider !== 'aws' && !apiKey) {
    res.status(400).json({ valid: false, error: 'No API key provided' })
    return
  }

  let valid = false
  let errorMessage = ''

  try {
    switch (provider) {
      case 'twelvelabs': {
        const service = new TwelveLabsService(apiKey)
        valid = await service.testConnection()
        break
      }
      case 'gemini': {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        )
        valid = response.ok
        if (!valid) {
          const data = await response.json().catch(() => ({}))
          errorMessage = (data as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`
        }
        break
      }
      case 'elevenlabs': {
        valid = typeof apiKey === 'string' && apiKey.length >= 20
        if (!valid) {
          errorMessage = 'API key appears invalid (too short)'
        }
        break
      }
      case 'aws': {
        try {
          await execAsync('aws sts get-caller-identity')
          valid = true
        } catch (err) {
          valid = false
          errorMessage = 'AWS CLI not configured or not available'
        }
        break
      }
      default:
        res.status(400).json({ valid: false, error: 'Unknown provider' })
        return
    }
  } catch (err) {
    valid = false
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`API test error for ${provider}:`, err)
  }

  res.json({ valid, error: errorMessage || undefined })
})

export default router
