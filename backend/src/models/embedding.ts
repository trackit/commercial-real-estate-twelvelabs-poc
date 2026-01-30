export interface MarengoEmbeddingItem {
  embedding: number[]
  embeddingOption: string[]
  embeddingScope: string
  startSec: number
  endSec: number
}

export interface EmbeddingResult {
  data: MarengoEmbeddingItem[]
}
