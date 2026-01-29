import { useState, useCallback } from 'react'
import { api } from '../services/api'
import type { Video, PollyVoice } from '../types'

interface UsePipelineConfigReturn {
  videos: Video[]
  voices: PollyVoice[]
  isLoadingVideos: boolean
  isLoadingVoices: boolean
  fetchVideos: () => Promise<void>
  fetchVoices: () => Promise<void>
}

export function usePipelineConfig(): UsePipelineConfigReturn {
  const [videos, setVideos] = useState<Video[]>([])
  const [voices, setVoices] = useState<PollyVoice[]>([])
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)

  const fetchVideos = useCallback(async () => {
    setIsLoadingVideos(true)
    try {
      const response = await api.get<Video[]>('/videos')
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
      const response = await api.get<PollyVoice[]>('/voices')
      if (response.data) {
        setVoices(response.data)
      }
    } catch {
      setVoices([])
    } finally {
      setIsLoadingVoices(false)
    }
  }, [])

  return {
    videos,
    voices,
    isLoadingVideos,
    isLoadingVoices,
    fetchVideos,
    fetchVoices,
  }
}
