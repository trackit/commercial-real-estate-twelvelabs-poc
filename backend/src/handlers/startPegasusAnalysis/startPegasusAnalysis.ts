import { Handler } from 'aws-lambda'
import { AIServices } from '../../infrastructure/AIServices/AIServices'
import { WorkflowServices } from '../../infrastructure/WorkflowServices/WorkflowServices'
import { Config } from '../../infrastructure/Config/Config'
import { VideoSegment, SegmentAnalysis } from '../../models/segment'

interface StartPegasusAnalysisEvent {
  taskToken: string
  videoS3Uri: string
  segment: VideoSegment
  outputS3Uri: string
}

export const handler: Handler<StartPegasusAnalysisEvent, void> = async (event) => {
  const config = new Config()
  const aiServices = new AIServices(config)
  const workflowServices = new WorkflowServices(config)

  try {
    const analysis = await aiServices.analyzePegasusSync(
      event.videoS3Uri,
      event.segment.startTime,
      event.segment.endTime
    )

    const result: SegmentAnalysis = {
      ...analysis,
      id: event.segment.id,
    }

    await workflowServices.sendTaskSuccess(event.taskToken, result)
  } catch (error) {
    await workflowServices.sendTaskFailure(
      event.taskToken,
      'AnalysisError',
      error instanceof Error ? error.message : String(error)
    )
    throw error
  }
}
