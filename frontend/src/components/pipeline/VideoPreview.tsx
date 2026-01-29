import { Download, Loader2, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { env } from '../../config/env'
import { Button, Card } from '../ui'

interface VideoPreviewProps {
  outputPath?: string
}

function extractVideoId(s3Uri: string): string | null {
  const match = s3Uri.match(/s3:\/\/[^/]+\/([^/]+)\/output\/final\.mp4/)
  return match ? match[1] : null
}

export function VideoPreview({ outputPath }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const videoId = outputPath ? extractVideoId(outputPath) : null

  useEffect(() => {
    if (!videoId) {
      setLoading(false)
      return
    }

    const fetchPresignedUrl = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`${env.apiBaseUrl}/output/${videoId}`)
        if (!response.ok) {
          throw new Error('Failed to get video URL')
        }
        const data = await response.json()
        setVideoUrl(data.downloadUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video')
      } finally {
        setLoading(false)
      }
    }

    fetchPresignedUrl()
  }, [videoId])

  if (!outputPath || !videoId) return null

  const handleDownload = () => {
    if (!videoUrl) return
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = 'final.mp4'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <Card variant="elevated" className="overflow-hidden">
        <div className="aspect-video bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-text-secondary animate-spin" />
        </div>
      </Card>
    )
  }

  if (error || !videoUrl) {
    return (
      <Card variant="elevated" className="overflow-hidden">
        <div className="aspect-video bg-black flex items-center justify-center">
          <p className="text-text-secondary">{error || 'Video not available'}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="relative aspect-video bg-black">
        {isPlaying ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <button
              onClick={() => setIsPlaying(true)}
              className="w-20 h-20 rounded-full bg-accent/90 hover:bg-accent flex items-center justify-center transition-all hover:scale-105"
            >
              <Play className="w-8 h-8 text-background ml-1" fill="currentColor" />
            </button>
            <p className="mt-4 text-text-secondary">final.mp4</p>
          </div>
        )}
      </div>
      <div className="p-4 flex justify-center gap-4">
        <Button onClick={handleDownload} leftIcon={<Download className="w-4 h-4" />}>
          Download MP4
        </Button>
      </div>
    </Card>
  )
}
