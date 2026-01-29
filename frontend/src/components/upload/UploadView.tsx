import { clsx } from 'clsx'
import { AlertCircle, CheckCircle, FileVideo, Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiConfig } from '../../hooks/useApiConfig'
import { useVideoUpload } from '../../hooks/useVideoUpload'
import { formatFileSize } from '../../utils/format'
import { isValidVideoFile } from '../../utils/validation'
import { Badge, Button, Card, CardHeader, CardTitle, Progress } from '../ui'

export function UploadView() {
  const navigate = useNavigate()
  const { status: configStatus } = useApiConfig()
  const { state, uploadVideo, reset } = useVideoUpload()

  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const handleFileSelect = useCallback((file: File) => {
    const validation = isValidVideoFile(file)
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file')
      setSelectedFile(null)
      return
    }
    setFileError(null)
    setSelectedFile(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleUpload = async () => {
    if (!selectedFile) return
    await uploadVideo(selectedFile)
  }

  const handleReset = () => {
    reset()
    setSelectedFile(null)
    setFileError(null)
  }

  if (!configStatus.aws) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Upload Property Video</h2>
          <p className="text-text-secondary mt-1">
            Upload a video to process with the AI pipeline.
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Upload Property Video</h2>
        <p className="text-text-secondary mt-1">Upload a video to process with the AI pipeline.</p>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Upload Video</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          {state.status === 'idle' && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={clsx(
                  'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer',
                  dragOver
                    ? 'border-accent bg-accent/5'
                    : selectedFile
                      ? 'border-success bg-success/5'
                      : 'border-border hover:border-accent/50'
                )}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-m4v,video/x-matroska,.mp4,.mov,.m4v,.mkv"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-3">
                    <FileVideo className="w-12 h-12 text-success mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-text-primary">{selectedFile.name}</p>
                      <p className="text-sm text-text-muted">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Badge variant="success">Ready to upload</Badge>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload
                      className={clsx(
                        'w-12 h-12 mx-auto transition-colors',
                        dragOver ? 'text-accent' : 'text-text-muted'
                      )}
                    />
                    <div>
                      <p className="text-lg font-medium text-text-primary">Drop your video here</p>
                      <p className="text-sm text-text-muted">or click to browse</p>
                    </div>
                    <p className="text-xs text-text-muted">MP4, MOV, MKV up to 2GB</p>
                  </div>
                )}
              </div>

              {fileError && (
                <p className="mt-2 text-sm text-error flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {fileError}
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Upload Video
                </Button>
              </div>
            </>
          )}

          {(state.status === 'uploading' || state.status === 'confirming') && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <FileVideo className="w-10 h-10 text-accent" />
                <div className="flex-1">
                  <p className="font-medium text-text-primary">{selectedFile?.name}</p>
                  <p className="text-sm text-text-muted">
                    {state.status === 'uploading' ? 'Uploading to S3...' : 'Confirming upload...'}
                  </p>
                </div>
              </div>

              <Progress value={state.progress} showLabel animated />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {state.progress >= 100 ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  )}
                  <span
                    className={clsx(
                      'text-sm',
                      state.progress >= 100 ? 'text-text-primary' : 'text-text-muted'
                    )}
                  >
                    Upload to S3
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {state.status === 'confirming' ? (
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-text-muted" />
                  )}
                  <span
                    className={clsx(
                      'text-sm',
                      state.status === 'confirming' ? 'text-text-primary' : 'text-text-muted'
                    )}
                  >
                    Confirming upload...
                  </span>
                </div>
              </div>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-success mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Video Ready!</h3>
                <p className="text-text-secondary">
                  Your video has been uploaded and is ready for processing.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={handleReset}>
                  Upload Another
                </Button>
                <Button onClick={() => navigate('/pipeline')}>Go to Pipeline</Button>
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-error mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Upload Failed</h3>
                <p className="text-text-secondary">{state.error}</p>
              </div>
              <Button onClick={handleReset}>Try Again</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
