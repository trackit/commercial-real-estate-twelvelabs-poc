import { AlertCircle, Loader2, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiConfig } from '../../hooks/useApiConfig'
import { usePipeline } from '../../hooks/usePipeline'
import { usePipelineConfig } from '../../hooks/usePipelineConfig'
import { Button, Card, CardHeader, CardTitle, Input, Progress, Select } from '../ui'
import { LocationInsights } from './LocationInsights'
import { PipelineSteps } from './PipelineSteps'
import { SegmentCard } from './SegmentCard'
import { VideoPreview } from './VideoPreview'

export function PipelineView() {
  const navigate = useNavigate()
  const { status: configStatus } = useApiConfig()
  const { state, startPipeline, reset } = usePipeline()
  const { videos, voices, isLoadingVideos, isLoadingVoices, fetchVideos, fetchVoices } =
    usePipelineConfig()

  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('Joanna')
  const [agencyName, setAgencyName] = useState('Skyline Estates')
  const [streetAddress, setStreetAddress] = useState('12 Oakwood Lane')
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    if (configStatus.aws) {
      fetchVideos()
      fetchVoices()
    }
  }, [configStatus.aws, fetchVideos, fetchVoices])

  const handleStart = async () => {
    if (!selectedVideoId) return

    setIsStarting(true)
    setStartError(null)
    try {
      await startPipeline({
        videoId: selectedVideoId,
        voiceId: selectedVoiceId,
        agencyName,
        streetAddress,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start pipeline'
      setStartError(errorMessage)
    } finally {
      setIsStarting(false)
    }
  }

  const completedSteps = state.steps.filter((s) => s.status === 'complete').length
  const totalSteps = state.steps.length
  const overallProgress = Math.round((completedSteps / totalSteps) * 100)

  if (!configStatus.aws) {
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
          <h3 className="text-lg font-semibold text-text-primary mb-2">API Not Connected</h3>
          <p className="text-text-secondary mb-4">
            Unable to connect to the backend API. Please check that the API is deployed and
            configured.
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
                <label className="block text-sm font-medium text-text-primary">Select Video</label>
                {isLoadingVideos ? (
                  <div className="flex items-center gap-2 h-[42px] px-4 text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading videos...</span>
                  </div>
                ) : videos.length === 0 ? (
                  <div className="flex items-center gap-2 h-[42px] px-4 text-text-muted">
                    <span className="text-sm">No videos uploaded yet.</span>
                    <Button variant="ghost" onClick={() => navigate('/upload')}>
                      Upload a video
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={selectedVideoId}
                    onChange={(e) => setSelectedVideoId(e.target.value)}
                    placeholder="Select a video..."
                    options={videos.map((video) => ({
                      value: video.id,
                      label: video.filename,
                    }))}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Voice</label>
                {isLoadingVoices ? (
                  <div className="flex items-center gap-2 h-[42px] px-4 text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading voices...</span>
                  </div>
                ) : (
                  <Select
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    options={voices.map((voice) => ({
                      value: voice.id,
                      label: `${voice.name} (${voice.gender}, ${voice.accent})`,
                    }))}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Agency Name"
                placeholder="Your Agency Name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
              />
              <Input
                label="Street Address"
                placeholder="Property Address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
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
                disabled={!selectedVideoId || isStarting}
                isLoading={isStarting}
                leftIcon={!isStarting ? <Play className="w-4 h-4" /> : undefined}
                size="lg"
              >
                {isStarting ? 'Starting...' : 'Start Processing'}
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
          <p className="text-text-secondary mt-1">Your video tour is ready.</p>
        </div>

        <VideoPreview outputPath={state.outputPath} />

        {state.streetAddress && <LocationInsights streetAddress={state.streetAddress} />}

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
          <p className="text-text-secondary mt-1">An error occurred during video processing.</p>
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
    </div>
  )
}
