import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '../services/api'
import type { PipelineState, PipelineStep } from '../types'

const initialSteps: PipelineStep[] = [
  { id: 'retrieve', name: 'Retrieve Marengo segments', status: 'pending' },
  { id: 'annotate', name: 'Annotate with Pegasus', status: 'pending' },
  { id: 'filter', name: 'Filter candidates', status: 'pending' },
  { id: 'select', name: 'LLM segment selection', status: 'pending' },
  { id: 'voiceover', name: 'Generate voiceover scripts', status: 'pending' },
  { id: 'audio', name: 'Synthesize audio', status: 'pending' },
  { id: 'render', name: 'Render video segments', status: 'pending' },
  { id: 'concat', name: 'Concatenate final video', status: 'pending' },
]

interface PipelineStatusResponse {
  executionId: string
  status: 'running' | 'complete' | 'error' | 'idle'
  steps: PipelineStep[]
  outputPath?: string
  error?: string
}

interface StartPipelineResponse {
  executionId: string
  videoId: string
  status: string
}

interface PipelineStartConfig {
  videoId: string
  voiceId: string
  agencyName: string
  streetAddress: string
}

interface UsePipelineReturn {
  state: PipelineState
  logs: string[]
  startPipeline: (config: PipelineStartConfig) => Promise<void>
  cancelPipeline: () => void
  reset: () => void
}

export function usePipeline(): UsePipelineReturn {
  const [state, setState] = useState<PipelineState>({
    jobId: '',
    status: 'idle',
    steps: initialSteps,
    segments: [],
  })
  const [logs, setLogs] = useState<string[]>([])
  const pollingIntervalRef = useRef<number | null>(null)
  const executionIdRef = useRef<string | null>(null)

  const pollStatus = useCallback(async () => {
    if (!executionIdRef.current) return

    try {
      const response = await api.get<PipelineStatusResponse>(
        `/pipeline/status/${encodeURIComponent(executionIdRef.current)}`
      )

      if (response.error || !response.data) {
        return
      }

      const { status, steps, outputPath, error } = response.data

      setState((prev) => ({
        ...prev,
        status,
        steps: steps || prev.steps,
        outputPath,
        error,
        streetAddress: prev.streetAddress,
      }))

      if (status === 'complete' || status === 'error') {
        if (pollingIntervalRef.current) {
          window.clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    } catch (err) {}
  }, [])

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const startPipeline = useCallback(
    async (config: PipelineStartConfig) => {
      const response = await api.post<StartPipelineResponse>('/pipeline/start', {
        videoId: config.videoId,
        voiceId: config.voiceId,
        agencyName: config.agencyName,
        streetAddress: config.streetAddress,
      })

      if (response.error || !response.data) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: response.error?.message || 'Failed to start pipeline',
        }))
        return
      }

      const { executionId } = response.data
      executionIdRef.current = executionId

      setState({
        jobId: executionId,
        status: 'running',
        steps: initialSteps.map((s) => ({ ...s, status: 'pending' })),
        segments: [],
        error: undefined,
        streetAddress: config.streetAddress,
      })
      setLogs([`Pipeline started: ${executionId}`])

      pollingIntervalRef.current = window.setInterval(pollStatus, 3000)
      pollStatus()
    },
    [pollStatus]
  )

  const cancelPipeline = useCallback(() => {
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    executionIdRef.current = null
    setState((prev) => ({
      ...prev,
      status: 'idle',
    }))
  }, [])

  const reset = useCallback(() => {
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    executionIdRef.current = null
    setState({
      jobId: '',
      status: 'idle',
      steps: initialSteps,
      segments: [],
    })
    setLogs([])
  }, [])

  return {
    state,
    logs,
    startPipeline,
    cancelPipeline,
    reset,
  }
}
