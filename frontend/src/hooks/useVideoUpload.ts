import { useState, useCallback } from 'react'
import { api } from '../services/api'

interface UploadState {
  status: 'idle' | 'uploading' | 'confirming' | 'ready' | 'error'
  progress: number
  videoId: string | null
  error: string | null
}

interface PresignedUrlResponse {
  videoId: string
  uploadUrl: string
  s3Uri: string
}

interface UseVideoUploadReturn {
  state: UploadState
  uploadVideo: (file: File) => Promise<void>
  reset: () => void
}

export function useVideoUpload(): UseVideoUploadReturn {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    videoId: null,
    error: null,
  })

  const uploadVideo = useCallback(async (file: File) => {
    setState({
      status: 'uploading',
      progress: 0,
      videoId: null,
      error: null,
    })

    try {
      const presignedResponse = await api.post<PresignedUrlResponse>('/upload/presigned', {
        filename: file.name,
        contentType: file.type || 'video/mp4',
      })

      if (presignedResponse.error || !presignedResponse.data) {
        throw new Error(presignedResponse.error?.message || 'Failed to get upload URL')
      }

      const { videoId, uploadUrl, s3Uri } = presignedResponse.data

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setState((prev) => ({ ...prev, progress }))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        xhr.send(file)
      })

      setState((prev) => ({
        ...prev,
        status: 'confirming',
        progress: 100,
      }))

      const confirmResponse = await api.post('/upload/confirm', {
        videoId,
        filename: file.name,
        s3Uri,
      })

      if (confirmResponse.error) {
        throw new Error(confirmResponse.error.message || 'Failed to confirm upload')
      }

      setState({
        status: 'ready',
        progress: 100,
        videoId,
        error: null,
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      videoId: null,
      error: null,
    })
  }, [])

  return {
    state,
    uploadVideo,
    reset,
  }
}
