export interface ApiError {
  message: string
  code?: string
  details?: Record<string, unknown>
}

export interface ApiResponse<T> {
  data?: T
  error?: ApiError
}

export interface ConfigStatus {
  twelvelabs: boolean
  gemini: boolean
  elevenlabs: boolean
  aws: boolean
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

export type PipelineStepStatus = 'pending' | 'running' | 'complete' | 'error'

export interface PipelineStep {
  id: string
  name: string
  status: PipelineStepStatus
  progress?: number
  detail?: string
}

export interface Segment {
  id: number
  title: string
  roomType: string
  startTime: number
  endTime: number
  appealScore: number
  voiceover?: string
}

export interface PipelineState {
  jobId: string
  status: 'idle' | 'running' | 'complete' | 'error'
  steps: PipelineStep[]
  segments: Segment[]
  outputPath?: string
  error?: string
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
