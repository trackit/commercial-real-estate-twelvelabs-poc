import { useState, useCallback } from 'react'
import { api } from '../services/api'
import type { TwelveLabsIndex, VideoStatus } from '../types'

interface UploadState {
  status: 'idle' | 'uploading' | 'indexing' | 'ready' | 'error'
  progress: number
  videoId: string | null
  indexId: string | null
  error: string | null
}

interface UseVideoUploadReturn {
  state: UploadState
  indexes: TwelveLabsIndex[]
  isLoadingIndexes: boolean
  fetchIndexes: () => Promise<void>
  createIndex: (name: string) => Promise<string | null>
  uploadVideo: (file: File, indexId: string) => Promise<void>
  checkStatus: () => Promise<void>
  reset: () => void
}

export function useVideoUpload(): UseVideoUploadReturn {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    videoId: null,
    indexId: null,
    error: null,
  })
  const [indexes, setIndexes] = useState<TwelveLabsIndex[]>([])
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false)

  const fetchIndexes = useCallback(async () => {
    setIsLoadingIndexes(true)
    const response = await api.get<TwelveLabsIndex[]>('/indexes')
    if (response.data) {
      setIndexes(response.data)
    }
    setIsLoadingIndexes(false)
  }, [])

  const createIndex = useCallback(async (name: string): Promise<string | null> => {
    const response = await api.post<{ id: string }>('/indexes', { name })
    if (response.data) {
      await fetchIndexes()
      return response.data.id
    }
    return null
  }, [fetchIndexes])

  const uploadVideo = useCallback(async (file: File, indexId: string) => {
    setState((prev) => ({
      ...prev,
      status: 'uploading',
      progress: 0,
      indexId,
      error: null,
    }))

    const response = await api.upload<{ videoId: string }>(
      `/upload?indexId=${indexId}`,
      file,
      (progress) => {
        setState((prev) => ({ ...prev, progress }))
      }
    )

    if (response.error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: response.error?.message || 'Upload failed',
      }))
      return
    }

    if (response.data) {
      setState((prev) => ({
        ...prev,
        status: 'indexing',
        progress: 100,
        videoId: response.data!.videoId,
      }))
    }
  }, [])

  const checkStatus = useCallback(async () => {
    if (!state.videoId || !state.indexId) return

    const response = await api.get<VideoStatus>(
      `/videos/${state.indexId}/${state.videoId}/status`
    )

    if (response.data) {
      const { status, progress, error } = response.data
      setState((prev) => ({
        ...prev,
        status: status === 'ready' ? 'ready' : status === 'failed' ? 'error' : 'indexing',
        progress: progress ?? prev.progress,
        error: error ?? null,
      }))
    }
  }, [state.videoId, state.indexId])

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      videoId: null,
      indexId: null,
      error: null,
    })
  }, [])

  return {
    state,
    indexes,
    isLoadingIndexes,
    fetchIndexes,
    createIndex,
    uploadVideo,
    checkStatus,
    reset,
  }
}
