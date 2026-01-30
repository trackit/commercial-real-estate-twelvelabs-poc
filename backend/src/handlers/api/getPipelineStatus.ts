import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import {
  SFNClient,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
  HistoryEvent,
} from '@aws-sdk/client-sfn'

const sfnClient = new SFNClient({ region: process.env.AWS_REGION })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

const STATE_TO_STEP_MAP: Record<string, string[]> = {
  StartMarengoEmbedding: ['retrieve'],
  StoreEmbeddings: ['retrieve'],
  AnalyzeSegmentsMap: ['annotate'],
  SelectSegments: ['filter', 'select'],
  GenerateVoiceoverMap: ['voiceover'],
  SynthesizeAudio: ['audio'],
  ProcessVideo: ['render'],
}

const MAP_STATE_TO_STEP: Record<string, string> = {
  AnalyzeSegmentsMap: 'annotate',
  GenerateVoiceoverMap: 'voiceover',
}

interface MapProgress {
  total: number
  succeeded: number
  inProgress: number
  queued: number
  failed: number
}

interface PipelineStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'complete' | 'error'
  progress?: number
  detail?: string
  mapProgress?: MapProgress
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'retrieve', name: 'Retrieve Marengo segments', status: 'pending' },
  { id: 'annotate', name: 'Annotate with Pegasus', status: 'pending' },
  { id: 'filter', name: 'Filter candidates', status: 'pending' },
  { id: 'select', name: 'LLM segment selection', status: 'pending' },
  { id: 'voiceover', name: 'Generate voiceover scripts', status: 'pending' },
  { id: 'audio', name: 'Synthesize audio', status: 'pending' },
  { id: 'render', name: 'Process & render video', status: 'pending' },
]

async function getAllExecutionHistory(executionArn: string): Promise<HistoryEvent[]> {
  const allEvents: HistoryEvent[] = []
  let nextToken: string | undefined

  do {
    const response = await sfnClient.send(
      new GetExecutionHistoryCommand({
        executionArn,
        maxResults: 1000,
        nextToken,
      })
    )
    allEvents.push(...(response.events || []))
    nextToken = response.nextToken
  } while (nextToken)

  return allEvents
}

interface MapStateProgress {
  total: number
  started: number
  succeeded: number
  failed: number
}

function trackMapProgress(events: HistoryEvent[]): Record<string, MapStateProgress> {
  const mapProgress: Record<string, MapStateProgress> = {}
  const mapStateStack: string[] = []

  for (const event of events) {
    if (event.type === 'MapStateEntered') {
      const stateName = event.stateEnteredEventDetails?.name
      if (stateName) {
        mapStateStack.push(stateName)
        if (!mapProgress[stateName]) {
          mapProgress[stateName] = { total: 0, started: 0, succeeded: 0, failed: 0 }
        }
      }
    }

    if (event.type === 'MapStateStarted') {
      const currentMap = mapStateStack[mapStateStack.length - 1]
      if (currentMap && event.mapStateStartedEventDetails?.length !== undefined) {
        mapProgress[currentMap].total = event.mapStateStartedEventDetails.length
      }
    }

    if (event.type === 'MapIterationStarted') {
      const currentMap = mapStateStack[mapStateStack.length - 1]
      if (currentMap) {
        mapProgress[currentMap].started++
      }
    }

    if (event.type === 'MapIterationSucceeded') {
      const currentMap = mapStateStack[mapStateStack.length - 1]
      if (currentMap) {
        mapProgress[currentMap].succeeded++
      }
    }

    if (event.type === 'MapIterationFailed') {
      const currentMap = mapStateStack[mapStateStack.length - 1]
      if (currentMap) {
        mapProgress[currentMap].failed++
      }
    }

    if (event.type === 'MapStateExited') {
      mapStateStack.pop()
    }
  }

  return mapProgress
}

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  try {
    const executionId = event.pathParameters?.executionId

    if (!executionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Execution ID is required' }),
      }
    }

    const executionArn = decodeURIComponent(executionId)

    const [describeResponse, historyEvents] = await Promise.all([
      sfnClient.send(new DescribeExecutionCommand({ executionArn })),
      getAllExecutionHistory(executionArn),
    ])

    const steps = PIPELINE_STEPS.map((step) => ({ ...step }))
    const completedStates = new Set<string>()
    let currentState: string | null = null

    for (const historyEvent of historyEvents) {
      if (historyEvent.type === 'TaskStateEntered' || historyEvent.type === 'MapStateEntered') {
        const stateEnteredDetails = historyEvent.stateEnteredEventDetails
        if (stateEnteredDetails?.name) {
          currentState = stateEnteredDetails.name
        }
      }

      if (historyEvent.type === 'TaskStateExited' || historyEvent.type === 'MapStateExited') {
        const stateExitedDetails = historyEvent.stateExitedEventDetails
        if (stateExitedDetails?.name) {
          completedStates.add(stateExitedDetails.name)
        }
      }
    }

    const mapProgressData = trackMapProgress(historyEvents)

    for (const [stateName, stepIds] of Object.entries(STATE_TO_STEP_MAP)) {
      if (completedStates.has(stateName)) {
        for (const stepId of stepIds) {
          const step = steps.find((s) => s.id === stepId)
          if (step) {
            step.status = 'complete'
          }
        }
      } else if (currentState === stateName) {
        for (const stepId of stepIds) {
          const step = steps.find((s) => s.id === stepId)
          if (step && step.status === 'pending') step.status = 'running'
        }
      }
    }

    for (const [mapStateName, stepId] of Object.entries(MAP_STATE_TO_STEP)) {
      const progress = mapProgressData[mapStateName]
      if (progress && progress.total > 0) {
        const step = steps.find((s) => s.id === stepId)
        if (step) {
          const inProgress = progress.started - progress.succeeded - progress.failed
          const queued = progress.total - progress.started

          step.mapProgress = {
            total: progress.total,
            succeeded: progress.succeeded,
            inProgress,
            queued,
            failed: progress.failed,
          }

          step.progress = Math.round((progress.succeeded / progress.total) * 100)

          if (completedStates.has(mapStateName)) {
            step.status = 'complete'
            step.detail = `${progress.succeeded}/${progress.total} complete`
          } else if (progress.started > 0) {
            step.status = 'running'
            step.detail = `✅ ${progress.succeeded}  ⏳ ${inProgress}  📋 ${queued}`
            if (progress.failed > 0) {
              step.detail += `  ❌ ${progress.failed}`
            }
          }
        }
      }
    }

    let overallStatus: 'running' | 'complete' | 'error' | 'idle' = 'running'
    let outputPath: string | undefined
    let error: string | undefined

    if (describeResponse.status === 'SUCCEEDED') {
      overallStatus = 'complete'
      steps.forEach((step) => (step.status = 'complete'))

      try {
        const output = JSON.parse(describeResponse.output || '{}')
        outputPath = output.finalVideoS3Uri
      } catch {
        outputPath = undefined
      }
    } else if (
      describeResponse.status === 'FAILED' ||
      describeResponse.status === 'ABORTED' ||
      describeResponse.status === 'TIMED_OUT'
    ) {
      overallStatus = 'error'
      error = describeResponse.error || describeResponse.cause || 'Pipeline failed'

      if (currentState) {
        const stepIds = STATE_TO_STEP_MAP[currentState]
        if (stepIds) {
          for (const stepId of stepIds) {
            const step = steps.find((s) => s.id === stepId)
            if (step) step.status = 'error'
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        executionId: executionArn,
        status: overallStatus,
        steps,
        outputPath,
        error,
        startDate: describeResponse.startDate?.toISOString(),
        stopDate: describeResponse.stopDate?.toISOString(),
      }),
    }
  } catch (error) {
    console.error('Error getting pipeline status:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Failed to get pipeline status' }),
    }
  }
}
