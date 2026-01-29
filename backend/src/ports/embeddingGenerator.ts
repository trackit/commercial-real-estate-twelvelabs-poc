import { EmbeddingResult } from '../models/embedding';

export interface EmbeddingGenerator {
  startAsyncEmbedding(videoS3Uri: string, outputS3Uri: string): Promise<string>;
  getEmbeddingResult(outputS3Uri: string): Promise<EmbeddingResult>;
}
