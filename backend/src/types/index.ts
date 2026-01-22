import type { Request } from 'express'

export interface ApiConfig {
  twelvelabs?: string
  gemini?: string
  elevenlabs?: string
}

export function getApiConfigFromHeaders(req: Request): ApiConfig {
  return {
    twelvelabs: req.headers['x-twelvelabs-key'] as string | undefined,
    gemini: req.headers['x-gemini-key'] as string | undefined,
    elevenlabs: req.headers['x-elevenlabs-key'] as string | undefined,
  }
}

export interface TwelveLabsIndex {
  id: string
  name: string
  videoCount: number
  createdAt: string
}

export interface TwelveLabsVideo {
  id: string
  filename: string
  duration: number
  createdAt: string
  hlsUrl?: string
}

export interface ElevenLabsVoice {
  id: string
  name: string
  previewUrl?: string
  labels: {
    accent?: string
    gender?: string
    age?: string
    description?: string
  }
}

export interface VideoStatus {
  id: string
  indexId: string
  status: 'pending' | 'indexing' | 'ready' | 'failed'
  progress?: number
  error?: string
}

export interface PipelineConfig {
  videoId: string
  indexId: string
  videoPath: string
  outputPath: string
  ttsProvider: 'polly' | 'elevenlabs'
  voiceId: string
  llmProvider: 'nova' | 'gemini'
  agencyName?: string
  streetName?: string
}

export interface PipelineJob {
  id: string
  status: 'running' | 'complete' | 'error'
  config: PipelineConfig
  startedAt: Date
  completedAt?: Date
  error?: string
  outputPath?: string
}

export interface LocationInsights {
  address: string
  coordinates: {
    lat: number
    lng: number
  }
  walkScore: number
  walkLabel: string
  transitScore: number
  transitLabel: string
  bikeScore: number
  bikeLabel: string
  schools: School[]
}

export interface School {
  name: string
  rating: number | null
  distance: {
    km: number
    mi: number
  }
}
