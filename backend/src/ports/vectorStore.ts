export interface VectorStore {
  storeEmbeddings(videoId: string, segments: SegmentEmbeddingInput[]): Promise<void>
}

export interface SegmentEmbeddingInput {
  startTime: number
  endTime: number
  embedding: number[]
}
