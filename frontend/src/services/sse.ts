import { env } from '../config/env'

export type SSEHandler<T> = (data: T) => void

export interface SSEConnection {
  close: () => void
}

export function createSSEConnection<T>(
  endpoint: string,
  onMessage: SSEHandler<T>,
  onError?: (error: Error) => void,
  onComplete?: () => void
): SSEConnection {
  const url = `${env.apiBaseUrl}${endpoint}`
  const eventSource = new EventSource(url)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as T
      onMessage(data)
    } catch (error) {
      console.error('Failed to parse SSE message:', error)
    }
  }

  eventSource.addEventListener('complete', () => {
    eventSource.close()
    onComplete?.()
  })

  eventSource.onerror = (event) => {
    console.error('SSE error:', event)
    eventSource.close()
    onError?.(new Error('SSE connection failed'))
  }

  return {
    close: () => eventSource.close(),
  }
}
