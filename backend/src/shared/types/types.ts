export interface LambdaContext {
  awsRequestId: string
  functionName: string
  functionVersion: string
  invokedFunctionArn: string
  memoryLimitInMB: string
  logGroupName: string
  logStreamName: string
  getRemainingTimeInMillis: () => number
}

export interface StepFunctionEvent<T = unknown> {
  taskToken?: string
  input: T
}

export interface PipelineState {
  videoId: string
  videoS3Uri: string
  outputS3Uri: string
  segments?: unknown[]
  analyses?: unknown[]
  selectedSegments?: unknown[]
  voiceovers?: unknown[]
  audioFiles?: unknown[]
  finalVideo?: {
    s3Uri: string
    duration: number
  }
}

export interface AsyncInvokeResponse {
  invocationArn: string
  status: 'InProgress' | 'Completed' | 'Failed'
}

export interface BedrockModelResponse {
  output?: {
    message?: {
      content?: Array<{ text?: string }>
    }
  }
}
