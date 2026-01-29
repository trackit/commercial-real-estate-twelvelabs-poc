import { Handler } from 'aws-lambda';
import { StorageServices } from '../../infrastructure/StorageServices/StorageServices';
import { AIServices } from '../../infrastructure/AIServices/AIServices';
import { Config } from '../../infrastructure/Config/Config';
import { VideoSegment } from '../../models/segment';
import { MarengoEmbeddingItem } from '../../models/embedding';

interface StoreEmbeddingsEvent {
  videoId: string;
  embeddingsS3Uri: string;
}

interface StoreEmbeddingsResult {
  segments: VideoSegment[];
  videoId: string;
}

export const handler: Handler<
  StoreEmbeddingsEvent,
  StoreEmbeddingsResult
> = async (event) => {
  const config = new Config();
  const aiServices = new AIServices(config);
  const storageServices = new StorageServices(config, config.vectorIndexName);

  const embeddingResult = await aiServices.getEmbeddingResult(
    event.embeddingsS3Uri,
  );

  const clipEmbeddings = embeddingResult.data.filter(
    (item: MarengoEmbeddingItem) => item.embeddingScope === 'clip',
  );

  const segmentEmbeddings = clipEmbeddings.map(
    (item: MarengoEmbeddingItem) => ({
      startTime: item.startSec,
      endTime: item.endSec,
      embedding: item.embedding,
    }),
  );

  await storageServices.storeEmbeddings(event.videoId, segmentEmbeddings);

  const segments: VideoSegment[] = clipEmbeddings.map(
    (item: MarengoEmbeddingItem, idx: number) => ({
      id: idx,
      startTime: item.startSec,
      endTime: item.endSec,
      duration: item.endSec - item.startSec,
    }),
  );

  return {
    segments,
    videoId: event.videoId,
  };
};
