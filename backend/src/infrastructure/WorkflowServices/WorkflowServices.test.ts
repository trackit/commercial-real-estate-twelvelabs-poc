import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowServices } from './WorkflowServices';
import { Config } from '../Config/Config';

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  SendTaskSuccessCommand: vi.fn(),
  SendTaskFailureCommand: vi.fn(),
}));

describe('WorkflowServices', () => {
  let workflowServices: WorkflowServices;
  let config: Config;

  beforeEach(() => {
    config = new Config({
      awsRegion: 'us-east-1',
      stateMachineArn:
        'arn:aws:states:us-east-1:123456789012:stateMachine:video-pipeline',
      s3BucketName: 'test-bucket',
    });
    workflowServices = new WorkflowServices(config);
  });

  describe('sendTaskSuccess', () => {
    it('should send task success with output', async () => {
      const sfnClient = (
        workflowServices as unknown as {
          sfnClient: { send: ReturnType<typeof vi.fn> };
        }
      ).sfnClient;
      sfnClient.send = vi.fn().mockResolvedValue({});

      await workflowServices.sendTaskSuccess('task-token-123', {
        status: 'completed',
        outputS3Uri: 's3://bucket/output.json',
      });

      expect(sfnClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendTaskFailure', () => {
    it('should send task failure with error details', async () => {
      const sfnClient = (
        workflowServices as unknown as {
          sfnClient: { send: ReturnType<typeof vi.fn> };
        }
      ).sfnClient;
      sfnClient.send = vi.fn().mockResolvedValue({});

      await workflowServices.sendTaskFailure(
        'task-token-123',
        'ProcessingError',
        'Failed to process video segment',
      );

      expect(sfnClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
