import { env } from '../config/env'
import type { ApiResponse, ApiError } from '../types'

const STORAGE_KEY = 'cre-api-config'

function getApiHeaders(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const config = JSON.parse(stored)
      const headers: Record<string, string> = {}
      if (config.twelvelabs) headers['x-twelvelabs-key'] = config.twelvelabs
      if (config.gemini) headers['x-gemini-key'] = config.gemini
      if (config.elevenlabs) headers['x-elevenlabs-key'] = config.elevenlabs
      return headers
    }
  } catch {
    return {}
  }
  return {}
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders(),
          ...options.headers,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: {
            message: data.message || 'An error occurred',
            code: data.code,
            details: data.details,
          } as ApiError,
        }
      }

      return { data }
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR',
        },
      }
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async upload<T>(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ data })
          } else {
            resolve({
              error: {
                message: data.message || 'Upload failed',
                code: data.code,
              },
            })
          }
        } catch {
          resolve({
            error: {
              message: 'Failed to parse response',
              code: 'PARSE_ERROR',
            },
          })
        }
      })

      xhr.addEventListener('error', () => {
        resolve({
          error: {
            message: 'Network error during upload',
            code: 'NETWORK_ERROR',
          },
        })
      })

      xhr.open('POST', `${this.baseUrl}${endpoint}`)
      const apiHeaders = getApiHeaders()
      Object.entries(apiHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })
      xhr.send(formData)
    })
  }
}

export const api = new ApiClient(env.apiBaseUrl)
