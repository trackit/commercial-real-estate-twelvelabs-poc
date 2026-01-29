import {
  SFNClient,
  SendTaskSuccessCommand,
  SendTaskFailureCommand,
} from '@aws-sdk/client-sfn';
import { WorkflowOrchestrator } from '../../ports/workflowOrchestrator';
import { Config } from '../Config/Config';
import { WorkflowError } from '../../shared/errors';

export class WorkflowServices implements WorkflowOrchestrator {
  private sfnClient: SFNClient;

  constructor(private config: Config) {
    this.sfnClient = new SFNClient({ region: config.awsRegion });
  }

  async sendTaskSuccess(taskToken: string, output: unknown): Promise<void> {
    try {
      await this.sfnClient.send(
        new SendTaskSuccessCommand({
          taskToken,
          output: JSON.stringify(output),
        }),
      );
    } catch (error) {
      throw new WorkflowError(
        `Failed to send task success: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async sendTaskFailure(
    taskToken: string,
    error: string,
    cause?: string,
  ): Promise<void> {
    try {
      await this.sfnClient.send(
        new SendTaskFailureCommand({
          taskToken,
          error,
          cause,
        }),
      );
    } catch (err) {
      throw new WorkflowError(
        `Failed to send task failure: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
    }
  }
}
