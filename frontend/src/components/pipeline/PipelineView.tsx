import { AlertCircle, Loader2, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiConfig } from '../../hooks/useApiConfig'
import { usePipeline } from '../../hooks/usePipeline'
import { usePipelineConfig } from '../../hooks/usePipelineConfig'
import { Button, Card, CardHeader, CardTitle, Input, Progress, Select } from '../ui'
import { LiveLog } from './LiveLog'
import { PipelineSteps } from './PipelineSteps'
import { SegmentCard } from './SegmentCard'
import { VideoPreview } from './VideoPreview'

export function PipelineView() {
  const navigate = useNavigate()
  const { status: configStatus } = useApiConfig()
  const { state, logs, startPipeline, reset } = usePipeline()
  const {
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
  } = usePipelineConfig()

  const [config, setConfig] = useState({
    videoId: '',
    indexId: '',
    ttsProvider: 'elevenlabs' as const,
    voiceId: '',
    llmProvider: 'nova' as const,
    agencyName: 'Skyline Estates',
    streetName: '12 Oakwood Lane',
  })
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    if (configStatus.twelvelabs) {
      fetchIndexes()
    }
  }, [configStatus.twelvelabs, fetchIndexes])

  useEffect(() => {
    if (config.indexId) {
      fetchVideos(config.indexId)
      setConfig((prev) => ({ ...prev, videoId: '' }))
    }
  }, [config.indexId, fetchVideos])

  useEffect(() => {
    if (config.ttsProvider === 'elevenlabs' && configStatus.elevenlabs) {
      fetchVoices()
    }
  }, [config.ttsProvider, configStatus.elevenlabs, fetchVoices])

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const [startError, setStartError] = useState<string | null>(null)

  const handleStart = async () => {
    setIsStarting(true)
    setStartError(null)
    try {
      const result = await resolveVideoPath(config.indexId, config.videoId)
      if (!result.path) {
        throw new Error(result.error || 'Could not resolve video path')
      }
      startPipeline({
        ...config,
        videoPath: result.path,
        outputPath: '',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start pipeline'
      setStartError(errorMessage)
      console.error('Failed to start pipeline:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const completedSteps = state.steps.filter((s) => s.status === 'complete').length
  const totalSteps = state.steps.length
  const overallProgress = Math.round((completedSteps / totalSteps) * 100)

  if (!configStatus.twelvelabs) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Video Processing Pipeline</h2>
          <p className="text-text-secondary mt-1">
            Transform your property video into a polished ~60s tour.
          </p>
        </div>

        <Card variant="elevated" className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">API Keys Required</h3>
          <p className="text-text-secondary mb-4">
            Please configure your TwelveLabs API key in Settings to use the pipeline.
            Gemini API key is only required if using Google Gemini as the LLM provider.
          </p>
          <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
        </Card>
      </div>
    )
  }

  if (state.status === 'idle') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Video Processing Pipeline</h2>
          <p className="text-text-secondary mt-1">
            Transform your property video into a polished ~60s tour.
          </p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Pipeline Configuration</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Index</label>
                {isLoadingIndexes ? (
                  <div className="flex items-center gap-2 h-[42px] px-4 text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading indexes...</span>
                  </div>
                ) : (
                  <Select
                    value={config.indexId}
                    onChange={(e) => updateConfig('indexId', e.target.value)}
                    placeholder="Select an index..."
                    options={indexes.map((idx) => ({
                      value: idx.id,
                      label: `${idx.name} (${idx.videoCount} videos)`,
                    }))}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Video</label>
                {isLoadingVideos ? (
                  <div className="flex items-center gap-2 h-[42px] px-4 text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading videos...</span>
                  </div>
                ) : (
                  <Select
                    value={config.videoId}
                    onChange={(e) => updateConfig('videoId', e.target.value)}
                    placeholder={config.indexId ? 'Select a video...' : 'Select an index first'}
                    disabled={!config.indexId || videos.length === 0}
                    options={videos.map((video) => ({
                      value: video.id,
                      label: `${video.filename} (${Math.round(video.duration)}s)`,
                    }))}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="LLM Provider"
                value={config.llmProvider}
                onChange={(e) => updateConfig('llmProvider', e.target.value)}
                options={[
                  { value: 'nova', label: 'Amazon Nova Pro' },
                  { value: 'gemini', label: 'Google Gemini' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="TTS Provider"
                value={config.ttsProvider}
                onChange={(e) => updateConfig('ttsProvider', e.target.value)}
                options={[
                  { value: 'elevenlabs', label: 'ElevenLabs' },
                  { value: 'polly', label: 'AWS Polly' },
                ]}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Voice</label>
                {config.ttsProvider === 'elevenlabs' ? (
                  isLoadingVoices ? (
                    <div className="flex items-center gap-2 h-[42px] px-4 text-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading voices...</span>
                    </div>
                  ) : (
                    <Select
                      value={config.voiceId}
                      onChange={(e) => updateConfig('voiceId', e.target.value)}
                      placeholder="Select a voice..."
                      options={voices.map((voice) => ({
                        value: voice.id,
                        label: `${voice.name}${voice.labels.accent ? ` (${voice.labels.accent})` : ''}`,
                      }))}
                    />
                  )
                ) : (
                  <Input
                    placeholder="AWS Polly Voice ID (e.g., Joanna)"
                    value={config.voiceId}
                    onChange={(e) => updateConfig('voiceId', e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Agency Name"
                placeholder="Your Agency Name"
                value={config.agencyName}
                onChange={(e) => updateConfig('agencyName', e.target.value)}
              />
              <Input
                label="Street Address"
                placeholder="Property Address"
                value={config.streetName}
                onChange={(e) => updateConfig('streetName', e.target.value)}
              />
            </div>

            <div className="pt-4 flex flex-col items-end gap-2">
              {startError && (
                <div className="w-full flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{startError}</span>
                </div>
              )}
              <Button
                onClick={handleStart}
                disabled={!config.videoId || !config.indexId || !config.voiceId || isStarting}
                isLoading={isStarting}
                leftIcon={!isStarting ? <Play className="w-4 h-4" /> : undefined}
                size="lg"
              >
                {isStarting ? 'Preparing...' : 'Start Processing'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (state.status === 'complete') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            Processing Complete!
            <span className="text-success">✓</span>
          </h2>
          <p className="text-text-secondary mt-1">
            Your video tour is ready.
          </p>
        </div>

        <VideoPreview outputPath={state.outputPath} />

        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={reset} leftIcon={<RotateCcw className="w-4 h-4" />}>
            Process Another
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Processing Failed</h2>
          <p className="text-text-secondary mt-1">
            An error occurred during video processing.
          </p>
        </div>

        <Card variant="elevated" className="border-error">
          <div className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Error Details</h3>
            <p className="text-text-secondary mb-4">{state.error}</p>
            <Button onClick={reset} leftIcon={<RotateCcw className="w-4 h-4" />}>
              Try Again
            </Button>
          </div>
        </Card>

        <LiveLog logs={logs} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Processing Pipeline</h2>
        <p className="text-text-secondary mt-1">
          Your video is being processed. This may take a few minutes.
        </p>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Pipeline Progress</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6 space-y-6">
          <PipelineSteps steps={state.steps} />
          <Progress value={overallProgress} showLabel size="lg" />
        </div>
      </Card>

      {state.segments.length > 0 && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Selected Segments Preview</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-4 gap-3">
              {state.segments.slice(0, 8).map((segment) => (
                <SegmentCard key={segment.id} segment={segment} />
              ))}
            </div>
          </div>
        </Card>
      )}

      <LiveLog logs={logs} />
    </div>
  )
}
