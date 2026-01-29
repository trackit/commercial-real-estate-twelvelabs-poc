import { Handler } from 'aws-lambda';
import { AIServices } from '../../infrastructure/AIServices/AIServices';
import { SelectSegmentsUseCase } from '../../useCases/selectSegments';
import { Config } from '../../infrastructure/Config/Config';
import { SegmentAnalysis, SelectedSegment } from '../../models/segment';

interface SelectSegmentsEvent {
  analyses: SegmentAnalysis[];
  videoS3Uri: string;
  targetDuration?: number;
}

interface SelectSegmentsResult {
  selectedSegments: SelectedSegment[];
  totalDuration: number;
  videoS3Uri: string;
}

export const handler: Handler<SelectSegmentsEvent, SelectSegmentsResult> = async (event) => {
  const config = new Config();
  const aiServices = new AIServices(config);
  const useCase = new SelectSegmentsUseCase(aiServices);

  const result = await useCase.execute({
    analyses: event.analyses,
    targetDuration: event.targetDuration,
  });

  return {
    selectedSegments: result.selectedSegments,
    totalDuration: result.totalDuration,
    videoS3Uri: event.videoS3Uri,
  };
};
