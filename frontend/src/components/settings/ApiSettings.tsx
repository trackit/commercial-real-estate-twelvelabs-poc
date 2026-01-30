import { CheckCircle, Cloud, Key, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useApiConfig } from '../../hooks/useApiConfig'
import { Badge, Button, Card, CardContent, Input } from '../ui'

interface ApiKeyFieldProps {
  label: string
  value: string
  isConfigured: boolean
  testResult: boolean | null
  hint?: string
  onChange: (value: string) => void
  onClearTestResult: () => void
  onTest: () => Promise<boolean>
}

function ApiKeyField({
  label,
  value,
  isConfigured,
  testResult,
  hint,
  onChange,
  onClearTestResult,
  onTest,
}: ApiKeyFieldProps) {
  const [isTesting, setIsTesting] = useState(false)

  const handleTest = async () => {
    setIsTesting(true)
    await onTest()
    setIsTesting(false)
  }

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-medium text-text-primary">{label}</h4>
              <div className="flex items-center gap-2 mt-1">
                {testResult === false ? (
                  <Badge variant="error" size="sm">
                    <XCircle className="w-3 h-3 mr-1" />
                    Connection failed
                  </Badge>
                ) : testResult === true ? (
                  <Badge variant="success" size="sm">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : isConfigured ? (
                  <Badge variant="warning" size="sm">
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Not configured
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                type="password"
                isPassword
                placeholder={`Enter your ${label}`}
                value={value}
                onChange={(e) => {
                  onChange(e.target.value)
                  onClearTestResult()
                }}
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleTest}
              disabled={!value || isTesting}
              className="shrink-0"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : testResult === true ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : testResult === false ? (
                <XCircle className="w-4 h-4 text-error" />
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {hint && <p className="text-sm text-text-muted">{hint}</p>}
        </div>
      </div>
    </Card>
  )
}

export function ApiSettings() {
  const { config, status, testResults, updateConfig, saveConfig, testConnection, setTestResult } =
    useApiConfig()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    const success = await saveConfig()
    setSaveSuccess(success)
    setIsSaving(false)

    if (success) {
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">API Configuration</h2>
        <p className="text-text-secondary mt-1">
          Configure your API settings for video processing.
        </p>
      </div>

      <div className="space-y-4">
        <Card variant="elevated" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">Backend API</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {testResults.aws === false ? (
                      <Badge variant="error" size="sm">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not connected
                      </Badge>
                    ) : testResults.aws === true ? (
                      <Badge variant="success" size="sm">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        Checking...
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-text-muted">
                AWS-powered backend with Marengo/Pegasus video analysis and Nova Pro LLM. Set{' '}
                <code className="bg-surface-secondary px-1 rounded">VITE_API_BASE_URL</code> in your
                environment.
              </p>
            </div>
          </div>
        </Card>

        <ApiKeyField
          label="ElevenLabs API Key"
          value={config.elevenlabs}
          isConfigured={status.elevenlabs}
          testResult={testResults.elevenlabs}
          hint="Optional: For premium voice synthesis. AWS Polly is used as fallback."
          onChange={(value) => updateConfig('elevenlabs', value)}
          onClearTestResult={() => setTestResult('elevenlabs', null)}
          onTest={() => testConnection('elevenlabs', config.elevenlabs)}
        />

        <ApiKeyField
          label="Google Cloud API Key"
          value={config.gemini}
          isConfigured={status.gemini}
          testResult={testResults.gemini}
          hint="Required for Location Insights. Enable Geocoding API and Places API in Google Cloud Console."
          onChange={(value) => updateConfig('gemini', value)}
          onClearTestResult={() => setTestResult('gemini', null)}
          onTest={() => testConnection('gemini', config.gemini)}
        />
      </div>

      <Card variant="glass" className="p-4">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">
                Your API keys are stored in your browser's local storage and persist across
                sessions.
              </p>
            </div>
            <Button onClick={handleSave} isLoading={isSaving} className="ml-4">
              {saveSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
