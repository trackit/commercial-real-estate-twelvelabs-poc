import { RoomType } from './roomType';

export interface VideoSegment {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface SegmentAnalysis extends VideoSegment {
  roomType: RoomType;
  title: string;
  appealScore: number;
  isHeroCandidate: boolean;
  isTransitionOnly: boolean;
  shortDescription?: string;
}

export interface SelectedSegment {
  id: number;
  title: string;
  startTime: number;
  endTime: number;
}

export interface SegmentWithVoiceover extends SelectedSegment {
  voiceover: string;
}

export interface SegmentWithAudio extends SegmentWithVoiceover {
  audioS3Uri: string;
}
