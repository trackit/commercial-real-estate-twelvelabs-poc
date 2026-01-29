import { SegmentSelector } from '../../ports/segmentSelector';
import { SegmentAnalysis, SelectedSegment } from '../../models/segment';

export interface SelectSegmentsInput {
  analyses: SegmentAnalysis[];
  targetDuration?: number;
}

export interface SelectSegmentsOutput {
  selectedSegments: SelectedSegment[];
  totalDuration: number;
}

export class SelectSegmentsUseCase {
  constructor(private segmentSelector: SegmentSelector) {}

  async execute(input: SelectSegmentsInput): Promise<SelectSegmentsOutput> {
    const filteredCandidates = input.analyses.filter(
      (seg) => seg.appealScore > 0 && !seg.isTransitionOnly
    );

    if (filteredCandidates.length === 0) {
      return { selectedSegments: [], totalDuration: 0 };
    }

    const selectedSegments = await this.segmentSelector.selectSegments(
      filteredCandidates,
      input.targetDuration
    );

    const totalDuration = selectedSegments.reduce(
      (sum, seg) => sum + (seg.endTime - seg.startTime),
      0
    );

    return { selectedSegments, totalDuration };
  }
}
