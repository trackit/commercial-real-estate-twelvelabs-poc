import { SegmentAnalysis, SelectedSegment } from '../models/segment'

export interface SegmentSelector {
  selectSegments(
    candidates: SegmentAnalysis[],
    targetDurationSeconds?: number
  ): Promise<SelectedSegment[]>
}
