export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'PipelineError'
  }
}

export class VideoNotFoundError extends PipelineError {
  constructor(videoId: string) {
    super(`Video not found: ${videoId}`, 'VIDEO_NOT_FOUND')
    this.name = 'VideoNotFoundError'
  }
}

export class EmbeddingGenerationError extends PipelineError {
  constructor(message: string, cause?: Error) {
    super(message, 'EMBEDDING_GENERATION_FAILED', cause)
    this.name = 'EmbeddingGenerationError'
  }
}

export class AnalysisError extends PipelineError {
  constructor(segmentId: number, cause?: Error) {
    super(`Failed to analyze segment ${segmentId}`, 'ANALYSIS_FAILED', cause)
    this.name = 'AnalysisError'
  }
}

export class SelectionError extends PipelineError {
  constructor(message: string, cause?: Error) {
    super(message, 'SELECTION_FAILED', cause)
    this.name = 'SelectionError'
  }
}

export class VoiceoverError extends PipelineError {
  constructor(segmentId: number, cause?: Error) {
    super(`Failed to generate voiceover for segment ${segmentId}`, 'VOICEOVER_FAILED', cause)
    this.name = 'VoiceoverError'
  }
}

export class AudioSynthesisError extends PipelineError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUDIO_SYNTHESIS_FAILED', cause)
    this.name = 'AudioSynthesisError'
  }
}

export class VideoProcessingError extends PipelineError {
  constructor(message: string, cause?: Error) {
    super(message, 'VIDEO_PROCESSING_FAILED', cause)
    this.name = 'VideoProcessingError'
  }
}

export class StorageError extends PipelineError {
  constructor(operation: string, path: string, cause?: Error) {
    super(`Storage ${operation} failed for ${path}`, 'STORAGE_ERROR', cause)
    this.name = 'StorageError'
  }
}

export class WorkflowError extends PipelineError {
  constructor(message: string, cause?: Error) {
    super(message, 'WORKFLOW_ERROR', cause)
    this.name = 'WorkflowError'
  }
}
