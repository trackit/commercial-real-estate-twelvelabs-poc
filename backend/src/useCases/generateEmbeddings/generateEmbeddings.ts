import { EmbeddingGenerator } from '../../ports/embeddingGenerator'

export interface GenerateEmbeddingsInput {
  videoId: string
  videoS3Uri: string
  outputS3Uri: string
  taskToken?: string
}

export interface GenerateEmbeddingsOutput {
  invocationArn: string
  videoId: string
  taskToken?: string
}

export class GenerateEmbeddingsUseCase {
  constructor(private embeddingGenerator: EmbeddingGenerator) {}

  async execute(input: GenerateEmbeddingsInput): Promise<GenerateEmbeddingsOutput> {
    const invocationArn = await this.embeddingGenerator.startAsyncEmbedding(
      input.videoS3Uri,
      input.outputS3Uri
    )

    return {
      invocationArn,
      videoId: input.videoId,
      taskToken: input.taskToken,
    }
  }
}
