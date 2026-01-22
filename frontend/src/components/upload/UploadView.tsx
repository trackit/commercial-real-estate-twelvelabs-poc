import { useState, useEffect, useCallback } from 'react'
import { Upload, FolderPlus, CheckCircle, AlertCircle, FileVideo } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, Button, Input, Select, Progress, Badge } from '../ui'
import { useVideoUpload } from '../../hooks/useVideoUpload'
import { useApiConfig } from '../../hooks/useApiConfig'
import { formatFileSize } from '../../utils/format'
import { isValidVideoFile } from '../../utils/validation'
import { clsx } from 'clsx'

export function UploadView() {
  const navigate = useNavigate()
  const { status: configStatus } = useApiConfig()
  const {
    state,
    indexes,
    fetchIndexes,
    createIndex,
    uploadVideo,
    checkStatus,
  } = useVideoUpload()

  const [selectedIndex, setSelectedIndex] = useState('')
  const [newIndexName, setNewIndexName] = useState('')
  const [isCreatingIndex, setIsCreatingIndex] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (configStatus.twelvelabs) {
      fetchIndexes()
    }
  }, [configStatus.twelvelabs, fetchIndexes])

  useEffect(() => {
    let interval: number | undefined
    if (state.status === 'indexing') {
      interval = window.setInterval(checkStatus, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state.status, checkStatus])

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

  const handleCreateIndex = async () => {
    if (!newIndexName.trim()) return
    setIsCreatingIndex(true)
    const id = await createIndex(newIndexName.trim())
    if (id) {
      setSelectedIndex(id)
      setCreateMode(false)
      setNewIndexName('')
    }
    setIsCreatingIndex(false)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedIndex) return
    await uploadVideo(selectedFile, selectedIndex)
  }

  if (!configStatus.twelvelabs) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Upload Property Video</h2>
          <p className="text-text-secondary mt-1">
            Upload a video to TwelveLabs for AI-powered processing.
          </p>
        </div>

        <Card variant="elevated" className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">API Key Required</h3>
          <p className="text-text-secondary mb-4">
            Please configure your TwelveLabs API key in Settings to upload videos.
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
        <p className="text-text-secondary mt-1">
          Upload a video to TwelveLabs for AI-powered processing.
        </p>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Step 1: Select or Create Index</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setCreateMode(false)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                !createMode
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              Use Existing
            </button>
            <button
              onClick={() => setCreateMode(true)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                createMode
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              Create New
            </button>
          </div>

          {!createMode ? (
            <Select
              label="Select Index"
              placeholder="Choose an index..."
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value)}
              options={indexes.map((idx) => ({
                value: idx.id,
                label: `${idx.name} (${idx.videoCount} videos)`,
              }))}
            />
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="New Index Name"
                  placeholder="my-property-videos"
                  value={newIndexName}
                  onChange={(e) => setNewIndexName(e.target.value)}
                />
              </div>
              <div className="pt-7">
                <Button
                  onClick={handleCreateIndex}
                  isLoading={isCreatingIndex}
                  disabled={!newIndexName.trim()}
                  leftIcon={<FolderPlus className="w-4 h-4" />}
                >
                  Create
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Step 2: Upload Video</CardTitle>
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
                  accept="video/mp4,video/quicktime,video/x-m4v"
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
                      <p className="text-lg font-medium text-text-primary">
                        Drop your video here
                      </p>
                      <p className="text-sm text-text-muted">or click to browse</p>
                    </div>
                    <p className="text-xs text-text-muted">MP4, MOV up to 2GB</p>
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
                  disabled={!selectedFile || !selectedIndex}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Upload Video
                </Button>
              </div>
            </>
          )}

          {(state.status === 'uploading' || state.status === 'indexing') && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <FileVideo className="w-10 h-10 text-accent" />
                <div className="flex-1">
                  <p className="font-medium text-text-primary">{selectedFile?.name}</p>
                  <p className="text-sm text-text-muted">
                    {state.status === 'uploading' ? 'Uploading...' : 'Processing with Marengo...'}
                  </p>
                </div>
              </div>

              <Progress value={state.progress} showLabel animated />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle
                    className={clsx(
                      'w-5 h-5',
                      state.progress >= 100 ? 'text-success' : 'text-text-muted'
                    )}
                  />
                  <span
                    className={clsx(
                      'text-sm',
                      state.progress >= 100 ? 'text-text-primary' : 'text-text-muted'
                    )}
                  >
                    Upload complete
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {state.status === 'indexing' ? (
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-text-muted" />
                  )}
                  <span
                    className={clsx(
                      'text-sm',
                      state.status === 'indexing' ? 'text-text-primary' : 'text-text-muted'
                    )}
                  >
                    Generating embeddings...
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
                  Your video has been indexed and is ready for processing.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Upload Another
                </Button>
                <Button onClick={() => navigate('/pipeline')}>Go to Pipeline →</Button>
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
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
