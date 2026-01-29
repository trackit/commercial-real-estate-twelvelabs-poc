import { Handler } from 'aws-lambda';
import { AIServices } from '../../infrastructure/AIServices/AIServices';
import { DynamoTaskTokenStore } from '../../infrastructure/TaskTokenStore/TaskTokenStore';
import { GenerateEmbeddingsUseCase } from '../../useCases/generateEmbeddings';
import { Config } from '../../infrastructure/Config/Config';

interface StartMarengoEvent {
  taskToken: string;
  videoS3Uri: string;
  outputS3Uri: string;
  videoId: string;
}

interface StartMarengoResult {
  invocationArn: string;
  videoId: string;
}

export const handler: Handler<StartMarengoEvent, StartMarengoResult> = async (
  event,
) => {
  const config = new Config();
  const aiServices = new AIServices(config);
  const taskTokenStore = new DynamoTaskTokenStore(config);
  const useCase = new GenerateEmbeddingsUseCase(aiServices);

  const result = await useCase.execute({
    videoId: event.videoId,
    videoS3Uri: event.videoS3Uri,
    outputS3Uri: event.outputS3Uri,
    taskToken: event.taskToken,
  });

  await taskTokenStore.storeTaskToken({
    invocationArn: result.invocationArn,
    taskToken: event.taskToken,
    videoId: event.videoId,
    outputS3Uri: event.outputS3Uri,
    type: 'marengo',
  });

  return {
    invocationArn: result.invocationArn,
    videoId: result.videoId,
  };
};
