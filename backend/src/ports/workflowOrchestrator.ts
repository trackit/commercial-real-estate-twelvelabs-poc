export interface WorkflowOrchestrator {
  sendTaskSuccess(taskToken: string, output: unknown): Promise<void>;
  sendTaskFailure(
    taskToken: string,
    error: string,
    cause?: string,
  ): Promise<void>;
}
