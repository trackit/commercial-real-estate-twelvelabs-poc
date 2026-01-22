import { Download, Play } from 'lucide-react'
import { useState } from 'react'
import { Card, Button } from '../ui'
import { env } from '../../config/env'

interface VideoPreviewProps {
  outputPath?: string
}

export function VideoPreview({ outputPath }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  if (!outputPath) return null

  const filename = outputPath.split('/').pop()
  const videoUrl = `${env.apiBaseUrl}/output/${filename}`

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = filename || 'processed-video.mp4'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
            <p className="mt-4 text-text-secondary">{filename}</p>
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
