import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import type { ConfigStatus } from '../types'

interface ApiConfig {
  twelvelabs: string
  gemini: string
  elevenlabs: string
}

type TestResults = {
  twelvelabs: boolean | null
  gemini: boolean | null
  elevenlabs: boolean | null
  aws: boolean | null
}

interface ApiConfigContextType {
  config: ApiConfig
  status: ConfigStatus
  testResults: TestResults
  isLoading: boolean
  updateConfig: (key: keyof ApiConfig, value: string) => void
  saveConfig: () => Promise<boolean>
  testConnection: (key: keyof ApiConfig, apiKey?: string) => Promise<boolean>
  setTestResult: (key: keyof ApiConfig, result: boolean | null) => void
  refreshStatus: () => Promise<void>
}

const ApiConfigContext = createContext<ApiConfigContextType | null>(null)

const STORAGE_KEY = 'cre-api-config'

const defaultTestResults: TestResults = {
  twelvelabs: null,
  gemini: null,
  elevenlabs: null,
  aws: null,
}

function loadFromStorage(): ApiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        twelvelabs: parsed.twelvelabs || '',
        gemini: parsed.gemini || '',
        elevenlabs: parsed.elevenlabs || '',
      }
    }
  } catch {}
  return { twelvelabs: '', gemini: '', elevenlabs: '' }
}

function saveToStorage(config: ApiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function computeStatus(config: ApiConfig, awsStatus: boolean = false): ConfigStatus {
  return {
    twelvelabs: !!config.twelvelabs,
    gemini: !!config.gemini,
    elevenlabs: !!config.elevenlabs,
    aws: awsStatus,
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ApiConfig>(loadFromStorage)
  const [status, setStatus] = useState<ConfigStatus>(() => computeStatus(loadFromStorage()))
  const [testResults, setTestResults] = useState<TestResults>(defaultTestResults)
  const [isLoading, setIsLoading] = useState(true)

  const testConnection = useCallback(
    async (key: keyof ApiConfig | 'aws', apiKey?: string): Promise<boolean> => {
      const response = await api.post<{ valid: boolean }>('/config/test', {
        provider: key,
        apiKey: key === 'aws' ? undefined : apiKey,
      })
      const result = response.data?.valid ?? false
      setTestResults((prev) => ({ ...prev, [key]: result }))
      if (key === 'aws') {
        setStatus((prev) => ({ ...prev, aws: result }))
      }
      return result
    },
    []
  )

  const refreshStatus = useCallback(async () => {
    const stored = loadFromStorage()
    setConfig(stored)
    const awsResult = await testConnection('aws')
    setStatus(computeStatus(stored, awsResult))
    setIsLoading(false)
  }, [testConnection])

  useEffect(() => {
    const init = async () => {
      const stored = loadFromStorage()
      setConfig(stored)
      const currentStatus = computeStatus(stored)
      setStatus(currentStatus)
      
      const providers: (keyof ApiConfig)[] = ['twelvelabs', 'gemini', 'elevenlabs']
      const toTest = providers.filter((p) => currentStatus[p])
      await Promise.all([
        ...toTest.map((p) => testConnection(p, stored[p])),
        testConnection('aws'),
      ])
      
      setIsLoading(false)
    }
    init()
  }, [testConnection])

  const updateConfig = useCallback((key: keyof ApiConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setTestResult = useCallback((key: keyof ApiConfig, result: boolean | null) => {
    setTestResults((prev) => ({ ...prev, [key]: result }))
  }, [])

  const saveConfig = useCallback(async (): Promise<boolean> => {
    saveToStorage(config)
    setStatus((prev) => ({ ...computeStatus(config), aws: prev.aws }))
    return true
  }, [config])

  return (
    <ApiConfigContext.Provider
      value={{
        config,
        status,
        testResults,
        isLoading,
        updateConfig,
        saveConfig,
        testConnection,
        setTestResult,
        refreshStatus,
      }}
    >
      {children}
    </ApiConfigContext.Provider>
  )
}

export function useApiConfig(): ApiConfigContextType {
  const context = useContext(ApiConfigContext)
  if (!context) {
    throw new Error('useApiConfig must be used within a ConfigProvider')
  }
  return context
}
