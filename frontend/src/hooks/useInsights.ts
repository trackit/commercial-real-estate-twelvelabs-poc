import { useState, useCallback } from 'react'
import { api } from '../services/api'
import type { LocationInsights } from '../types'

interface UseInsightsReturn {
  insights: LocationInsights | null
  isLoading: boolean
  error: string | null
  fetchInsights: (address: string) => Promise<void>
  reset: () => void
}

export function useInsights(): UseInsightsReturn {
  const [insights, setInsights] = useState<LocationInsights | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = useCallback(async (address: string) => {
    setIsLoading(true)
    setError(null)

    const response = await api.post<LocationInsights>('/insights', { address })

    if (response.error) {
      setError(response.error.message)
      setInsights(null)
    } else if (response.data) {
      setInsights(response.data)
    }

    setIsLoading(false)
  }, [])

  const reset = useCallback(() => {
    setInsights(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    insights,
    isLoading,
    error,
    fetchInsights,
    reset,
  }
}
