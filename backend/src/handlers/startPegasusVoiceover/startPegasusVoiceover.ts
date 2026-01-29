import { Handler } from 'aws-lambda';
import { AIServices } from '../../infrastructure/AIServices/AIServices';
import { WorkflowServices } from '../../infrastructure/WorkflowServices/WorkflowServices';

import { Config } from '../../infrastructure/Config/Config';
import { SelectedSegment } from '../../models/segment';

interface StartPegasusVoiceoverEvent {
  taskToken: string;
  videoS3Uri: string;
  segment: SelectedSegment;
  outputS3Uri: string;
  previousScript?: string;
  agencyName?: string;
  streetAddress?: string;
}

interface VoiceoverResult {
  id: number;
  title: string;
  startTime: number;
  endTime: number;
  voiceover: string;
}

export const handler: Handler<StartPegasusVoiceoverEvent, void> = async (
  event,
) => {
  const config = new Config();
  const aiServices = new AIServices(config);
  const workflowServices = new WorkflowServices(config);

  try {
    const voiceover = await aiServices.generateVoiceoverSync(
      event.videoS3Uri,
      event.segment.title,
      event.segment.startTime,
      event.segment.endTime,
      event.previousScript ?? '',
      event.agencyName,
      event.streetAddress,
    );

    const result: VoiceoverResult = {
      id: event.segment.id,
      title: event.segment.title,
      startTime: event.segment.startTime,
      endTime: event.segment.endTime,
      voiceover,
    };

    await workflowServices.sendTaskSuccess(event.taskToken, result);
  } catch (error) {
    await workflowServices.sendTaskFailure(
      event.taskToken,
      'VoiceoverError',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};
