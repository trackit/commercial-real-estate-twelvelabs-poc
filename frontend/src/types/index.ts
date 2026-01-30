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
  aws: boolean
  elevenlabs: boolean
  gemini: boolean
}

export interface Video {
  id: string
  filename: string
  s3Uri: string
  size: number
  status: 'ready' | 'processing' | 'error'
  createdAt: string
  duration?: number
}

export interface PollyVoice {
  id: string
  name: string
  gender: 'Male' | 'Female'
  accent: string
}

export interface PipelineConfig {
  videoId: string
  voiceId: string
  agencyName: string
  streetAddress: string
}

export type PipelineStepStatus = 'pending' | 'running' | 'complete' | 'error'

export interface MapProgress {
  total: number
  succeeded: number
  inProgress: number
  queued: number
  failed: number
}

export interface PipelineStep {
  id: string
  name: string
  status: PipelineStepStatus
  progress?: number
  detail?: string
  mapProgress?: MapProgress
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
  streetAddress?: string
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
