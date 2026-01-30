import { Handler } from 'aws-lambda'
import { StorageServices } from '../../infrastructure/StorageServices/StorageServices'
import { VideoProcessor } from '../../infrastructure/VideoProcessor/VideoProcessor'
import { ProcessVideoUseCase } from '../../useCases/processVideo'
import { Config } from '../../infrastructure/Config/Config'
import { SegmentWithAudio } from '../../models/segment'

interface ProcessVideoEvent {
  videoS3Uri: string
  segments: SegmentWithAudio[]
  videoId: string
  agencyLabel?: string
  streetLabel?: string
}

interface ProcessVideoResult {
  finalVideoS3Uri: string
  totalDuration: number
  segmentCount: number
  videoId: string
}

export const handler: Handler<ProcessVideoEvent, ProcessVideoResult> = async (event) => {
  const config = new Config()
  const storageServices = new StorageServices(config, config.vectorIndexName)
  const videoProcessor = new VideoProcessor({
    fontPath: '/opt/fonts/DejaVuSans-Bold.ttf',
    tempDir: '/tmp',
    enableTextOverlay: true,
    ffmpegPath: '/opt/bin/ffmpeg',
  })
  const useCase = new ProcessVideoUseCase(storageServices, videoProcessor)

  const outputS3Uri = `s3://${config.s3BucketName}/${event.videoId}/output/final.mp4`

  const agencyLabel = event.agencyLabel ?? pickRandomAgency()
  const streetLabel = event.streetLabel ?? pickRandomStreet()

  const result = await useCase.execute({
    videoS3Uri: event.videoS3Uri,
    segments: event.segments,
    outputS3Uri,
    agencyLabel,
    streetLabel,
  })

  return {
    finalVideoS3Uri: result.finalVideoS3Uri,
    totalDuration: result.totalDuration,
    segmentCount: result.segmentCount,
    videoId: event.videoId,
  }
}

function pickRandomAgency(): string {
  const agencies = [
    'Skyline Estates',
    'Aurora Home Studio',
    'PrimeNest Realty',
    'UrbanVista Media',
    'Horizon House Tours',
  ]
  return agencies[Math.floor(Math.random() * agencies.length)]
}

function pickRandomStreet(): string {
  const streets = [
    '12 Oakwood Lane',
    '45 Sunset Boulevard',
    '78 Riverside Drive',
    '23 Maple Avenue',
    '91 Cedar Street',
    '5 Willow Park',
    '34 Hillside Crescent',
  ]
  return streets[Math.floor(Math.random() * streets.length)]
}
