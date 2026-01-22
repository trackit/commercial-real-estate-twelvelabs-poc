import { useState, useCallback } from 'react'
import { api } from '../services/api'
import type { TwelveLabsIndex, TwelveLabsVideo, ElevenLabsVoice } from '../types'

interface UsePipelineConfigReturn {
  indexes: TwelveLabsIndex[]
  videos: TwelveLabsVideo[]
  voices: ElevenLabsVoice[]
  isLoadingIndexes: boolean
  isLoadingVideos: boolean
  isLoadingVoices: boolean
  fetchIndexes: () => Promise<void>
  fetchVideos: (indexId: string) => Promise<void>
  fetchVoices: () => Promise<void>
  resolveVideoPath: (indexId: string, videoId: string) => Promise<{ path: string | null; error?: string }>
}

export function usePipelineConfig(): UsePipelineConfigReturn {
  const [indexes, setIndexes] = useState<TwelveLabsIndex[]>([])
  const [videos, setVideos] = useState<TwelveLabsVideo[]>([])
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false)
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)

  const fetchIndexes = useCallback(async () => {
    setIsLoadingIndexes(true)
    try {
      const response = await api.get<TwelveLabsIndex[]>('/indexes')
      if (response.data) {
        setIndexes(response.data)
      }
    } finally {
      setIsLoadingIndexes(false)
    }
  }, [])

  const fetchVideos = useCallback(async (indexId: string) => {
    setIsLoadingVideos(true)
    setVideos([])
    try {
      const response = await api.get<TwelveLabsVideo[]>(`/indexes/${indexId}/videos`)
      if (response.data) {
        setVideos(response.data)
      }
    } finally {
      setIsLoadingVideos(false)
    }
  }, [])

  const fetchVoices = useCallback(async () => {
    setIsLoadingVoices(true)
    try {
      const response = await api.get<ElevenLabsVoice[]>('/voices')
      if (response.data) {
        setVoices(response.data)
      }
    } finally {
      setIsLoadingVoices(false)
    }
  }, [])

  const resolveVideoPath = useCallback(async (indexId: string, videoId: string): Promise<{ path: string | null; error?: string }> => {
    const response = await api.get<{ path: string; source: string }>(`/videos/${indexId}/${videoId}/path`)
    if (response.data) {
      return { path: response.data.path }
    }
    return { path: null, error: response.error?.message }
  }, [])

  return {
    indexes,
    videos,
    voices,
    isLoadingIndexes,
    isLoadingVideos,
    isLoadingVoices,
    fetchIndexes,
    fetchVideos,
    fetchVoices,
    resolveVideoPath,
  }
}
