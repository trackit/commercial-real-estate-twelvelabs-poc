import type { TwelveLabsIndex, TwelveLabsVideo, VideoStatus } from '../types/index.js'
import fs from 'fs'
import path from 'path'

const TWELVELABS_API_URL = 'https://api.twelvelabs.io/v1.3'

export class TwelveLabsService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${TWELVELABS_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(error.message || `TwelveLabs API error: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async uploadVideoFile(indexId: string, filePath: string, videoName: string): Promise<string> {
    const formData = new FormData()
    formData.append('index_id', indexId)
    formData.append('video_file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath))
    formData.append('video_title', videoName)

    const response = await fetch(`${TWELVELABS_API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(error.message || `TwelveLabs API error: ${response.status}`)
    }

    const data = await response.json() as { _id: string }
    return data._id
  }

  async listIndexes(): Promise<TwelveLabsIndex[]> {
    const data = await this.request<{ data: Array<{
      _id: string
      index_name: string
      video_count: number
      created_at: string
    }> }>('/indexes')

    return data.data.map((idx) => ({
      id: idx._id,
      name: idx.index_name,
      videoCount: idx.video_count,
      createdAt: idx.created_at,
    }))
  }

  async createIndex(name: string): Promise<string> {
    const data = await this.request<{ _id: string }>('/indexes', {
      method: 'POST',
      body: JSON.stringify({
        index_name: name,
        engines: [
          {
            engine_name: 'marengo2.7',
            engine_options: ['visual', 'conversation', 'text_in_video', 'logo'],
          },
          {
            engine_name: 'pegasus1.2',
            engine_options: ['visual', 'conversation'],
          },
        ],
      }),
    })

    return data._id
  }

  async uploadVideo(indexId: string, videoUrl: string, videoName: string): Promise<string> {
    const data = await this.request<{ _id: string }>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        index_id: indexId,
        url: videoUrl,
        video_title: videoName,
      }),
    })

    return data._id
  }

  async getTaskStatus(taskId: string): Promise<VideoStatus> {
    const data = await this.request<{
      _id: string
      index_id: string
      status: string
      video_id?: string
      error?: { message: string }
    }>(`/tasks/${taskId}`)

    let status: VideoStatus['status'] = 'pending'
    if (data.status === 'ready') status = 'ready'
    else if (data.status === 'failed') status = 'failed'
    else if (data.status === 'indexing' || data.status === 'validating') status = 'indexing'

    return {
      id: data.video_id || data._id,
      indexId: data.index_id,
      status,
      error: data.error?.message,
    }
  }

  async getVideoStatus(indexId: string, videoId: string): Promise<VideoStatus> {
    const data = await this.request<{
      _id: string
      status: string
    }>(`/indexes/${indexId}/videos/${videoId}`)

    return {
      id: videoId,
      indexId,
      status: data.status === 'ready' ? 'ready' : 'indexing',
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listIndexes()
      return true
    } catch {
      return false
    }
  }

  async listVideos(indexId: string): Promise<TwelveLabsVideo[]> {
    const data = await this.request<{
      data: Array<{
        _id: string
        created_at: string
        system_metadata?: {
          filename?: string
          duration?: number
        }
        hls?: {
          video_url?: string
        }
      }>
      page_info: {
        total_results: number
      }
    }>(`/indexes/${indexId}/videos?page_limit=50`)

    return data.data.map((video) => ({
      id: video._id,
      filename: video.system_metadata?.filename || 'Untitled',
      duration: video.system_metadata?.duration || 0,
      createdAt: video.created_at,
      hlsUrl: video.hls?.video_url,
    }))
  }

  async getVideoDetails(indexId: string, videoId: string): Promise<TwelveLabsVideo> {
    const data = await this.request<{
      _id: string
      created_at: string
      metadata?: {
        filename?: string
        duration?: number
      }
      hls?: {
        video_url?: string
        status?: string
      }
    }>(`/indexes/${indexId}/videos/${videoId}`)

    return {
      id: data._id,
      filename: data.metadata?.filename || 'Untitled',
      duration: data.metadata?.duration || 0,
      createdAt: data.created_at,
      hlsUrl: data.hls?.video_url,
    }
  }
}
