import { useState, useCallback, useRef } from 'react'
import { api } from '../services/api'
import { createSSEConnection, SSEConnection } from '../services/sse'
import type { PipelineConfig, PipelineState, PipelineStep, Segment } from '../types'

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

interface SSEUpdate {
  type: 'step' | 'segment' | 'complete' | 'error' | 'log'
  step?: {
    id: string
    status: 'running' | 'complete' | 'error'
    progress?: number
    detail?: string
  }
  segment?: Segment
  outputPath?: string
  error?: string
  message?: string
}

interface UsePipelineReturn {
  state: PipelineState
  logs: string[]
  startPipeline: (config: PipelineConfig) => Promise<void>
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
  const sseConnection = useRef<SSEConnection | null>(null)

  const startPipeline = useCallback(async (config: PipelineConfig) => {
    const response = await api.post<{ jobId: string }>('/pipeline/start', config)

    if (response.error || !response.data) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: response.error?.message || 'Failed to start pipeline',
      }))
      return
    }

    const { jobId } = response.data
    setState((prev) => ({
      ...prev,
      jobId,
      status: 'running',
      steps: initialSteps.map((s) => ({ ...s, status: 'pending' })),
      segments: [],
      error: undefined,
    }))
    setLogs([])

    sseConnection.current = createSSEConnection<SSEUpdate>(
      `/pipeline/progress/${jobId}`,
      (update) => {
        if (update.type === 'step' && update.step) {
          setState((prev) => ({
            ...prev,
            steps: prev.steps.map((s) =>
              s.id === update.step!.id
                ? {
                    ...s,
                    status: update.step!.status,
                    progress: update.step!.progress,
                    detail: update.step!.detail,
                  }
                : s
            ),
          }))
        } else if (update.type === 'segment' && update.segment) {
          setState((prev) => ({
            ...prev,
            segments: [...prev.segments, update.segment!],
          }))
        } else if (update.type === 'complete') {
          setState((prev) => ({
            ...prev,
            status: 'complete',
            outputPath: update.outputPath,
          }))
        } else if (update.type === 'error') {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: update.error,
          }))
        } else if (update.type === 'log' && update.message) {
          setLogs((prev) => [...prev, update.message!])
        }
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message,
        }))
      },
      () => {
        sseConnection.current = null
      }
    )
  }, [])

  const cancelPipeline = useCallback(() => {
    if (sseConnection.current) {
      sseConnection.current.close()
      sseConnection.current = null
    }
    setState((prev) => ({
      ...prev,
      status: 'idle',
    }))
  }, [])

  const reset = useCallback(() => {
    if (sseConnection.current) {
      sseConnection.current.close()
      sseConnection.current = null
    }
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
