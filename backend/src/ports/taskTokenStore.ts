export interface TaskTokenRecord {
  invocationArn: string
  taskToken: string
  videoId: string
  outputS3Uri: string
  type: 'marengo' | 'pegasus-analysis' | 'pegasus-voiceover'
}

export interface TaskTokenStore {
  storeTaskToken(record: TaskTokenRecord): Promise<void>
  getTaskTokenByOutputPath(
    outputS3Uri: string,
    type: TaskTokenRecord['type']
  ): Promise<TaskTokenRecord | null>
  consumeTaskToken(
    outputS3Uri: string,
    type: TaskTokenRecord['type']
  ): Promise<TaskTokenRecord | null>
}
