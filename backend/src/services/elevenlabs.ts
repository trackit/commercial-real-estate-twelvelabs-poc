import type { ElevenLabsVoice } from '../types/index.js'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io'

export class ElevenLabsService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${ELEVENLABS_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { detail?: { message?: string } }
      throw new Error(error.detail?.message || `ElevenLabs API error: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async listVoices(): Promise<ElevenLabsVoice[]> {
    const data = await this.request<{
      voices: Array<{
        voice_id: string
        name: string
        preview_url?: string
        labels?: {
          accent?: string
          gender?: string
          age?: string
          description?: string
        }
      }>
    }>('/v1/voices')

    return data.voices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      previewUrl: voice.preview_url,
      labels: {
        accent: voice.labels?.accent,
        gender: voice.labels?.gender,
        age: voice.labels?.age,
        description: voice.labels?.description,
      },
    }))
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listVoices()
      return true
    } catch {
      return false
    }
  }
}
