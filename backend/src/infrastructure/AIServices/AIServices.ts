import {
  BedrockRuntimeClient,
  StartAsyncInvokeCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { EmbeddingGenerator } from '../../ports/embeddingGenerator'
import { EmbeddingResult } from '../../models/embedding'
import { SegmentSelector } from '../../ports/segmentSelector'
import { SegmentAnalysis, SelectedSegment } from '../../models/segment'
import { RoomType } from '../../models/roomType'
import { Config } from '../Config/Config'
import {
  buildAnalysisPrompt,
  buildVoiceoverPrompt,
  buildSelectionPrompt,
  PEGASUS_ANALYSIS_JSON_SCHEMA,
  PEGASUS_VOICEOVER_JSON_SCHEMA,
} from '../../shared/prompts'
import { parseS3Uri } from '../../shared/utils'
import { EmbeddingGenerationError, AnalysisError, SelectionError } from '../../shared/errors'

export class AIServices implements EmbeddingGenerator, SegmentSelector {
  private bedrockClient: BedrockRuntimeClient
  private s3Client: S3Client

  constructor(private config: Config) {
    this.bedrockClient = new BedrockRuntimeClient({ region: config.awsRegion })
    this.s3Client = new S3Client({ region: config.awsRegion })
  }

  async startAsyncEmbedding(videoS3Uri: string, outputS3Uri: string): Promise<string> {
    if (!this.config.accountId) {
      throw new EmbeddingGenerationError('AWS_ACCOUNT_ID environment variable is not configured')
    }

    const requestParams = {
      modelId: this.config.getMarengoModelId(),
      modelInput: {
        inputType: 'video',
        video: {
          mediaSource: {
            s3Location: {
              uri: videoS3Uri,
              bucketOwner: this.config.accountId,
            },
          },
        },
      },
      outputDataConfig: {
        s3OutputDataConfig: {
          s3Uri: outputS3Uri,
        },
      },
    }

    try {
      const response = await this.bedrockClient.send(new StartAsyncInvokeCommand(requestParams))
      return response.invocationArn!
    } catch (error) {
      throw new EmbeddingGenerationError(
        `Failed to start async embedding: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  async analyzePegasusSync(
    videoS3Uri: string,
    startSec: number,
    endSec: number
  ): Promise<SegmentAnalysis> {
    try {
      const prompt = buildAnalysisPrompt(startSec, endSec)
      const result = await this.invokePegasus(videoS3Uri, prompt, PEGASUS_ANALYSIS_JSON_SCHEMA)

      const analysisResult = result as {
        room_type: RoomType
        title: string
        appeal_score: number
        is_hero_candidate: boolean
        is_transition_only: boolean
        short_description?: string
      }

      return {
        id: 0,
        startTime: startSec,
        endTime: endSec,
        duration: endSec - startSec,
        roomType: analysisResult.room_type,
        title: analysisResult.title,
        appealScore: analysisResult.appeal_score,
        isHeroCandidate: analysisResult.is_hero_candidate,
        isTransitionOnly: analysisResult.is_transition_only,
        shortDescription: analysisResult.short_description,
      }
    } catch (error) {
      throw new AnalysisError(0, error instanceof Error ? error : new Error(String(error)))
    }
  }

  async generateVoiceoverSync(
    videoS3Uri: string,
    title: string,
    startSec: number,
    endSec: number,
    previousScript: string,
    agencyName?: string,
    streetAddress?: string
  ): Promise<string> {
    try {
      const prompt = buildVoiceoverPrompt(
        title,
        startSec,
        endSec,
        previousScript,
        agencyName,
        streetAddress
      )
      const result = await this.invokePegasus(videoS3Uri, prompt, PEGASUS_VOICEOVER_JSON_SCHEMA)
      return (result as { voiceover: string }).voiceover
    } catch (error) {
      throw new AnalysisError(0, error instanceof Error ? error : new Error(String(error)))
    }
  }

  async getEmbeddingResult(outputS3Uri: string): Promise<EmbeddingResult> {
    const { bucket, key } = parseS3Uri(outputS3Uri)
    const response = await this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const body = await response.Body!.transformToString()
    return JSON.parse(body)
  }

  async selectSegments(
    candidates: SegmentAnalysis[],
    _targetDurationSeconds = 60
  ): Promise<SelectedSegment[]> {
    try {
      const prompt = buildSelectionPrompt(candidates)
      const result = await this.invokeNova(prompt)

      return result.segments.map(
        (seg: { id: number; title: string; start_time: number; end_time: number }) => ({
          id: seg.id,
          title: seg.title,
          startTime: seg.start_time,
          endTime: seg.end_time,
        })
      )
    } catch (error) {
      throw new SelectionError(
        `Failed to select segments: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  private async invokePegasus(
    videoS3Uri: string,
    prompt: string,
    responseFormat: unknown
  ): Promise<Record<string, unknown>> {
    const requestBody = {
      inputPrompt: prompt,
      mediaSource: {
        s3Location: {
          uri: videoS3Uri,
          bucketOwner: this.config.accountId,
        },
      },
      responseFormat,
    }

    const response = await this.bedrockClient.send(
      new InvokeModelCommand({
        modelId: this.config.getPegasusModelId(),
        body: JSON.stringify(requestBody),
        contentType: 'application/json',
        accept: 'application/json',
      })
    )

    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    const content = responseBody.message || responseBody.data

    if (typeof content === 'string') {
      return JSON.parse(content)
    }
    return content
  }

  private async invokeNova(prompt: string): Promise<{
    segments: Array<{
      id: number
      title: string
      start_time: number
      end_time: number
    }>
  }> {
    const response = await this.bedrockClient.send(
      new InvokeModelCommand({
        modelId: this.config.getNovaModelId(),
        body: JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 4096, temperature: 0 },
        }),
        contentType: 'application/json',
        accept: 'application/json',
      })
    )

    const result = JSON.parse(new TextDecoder().decode(response.body))
    const text = result.output.message.content[0].text
    const cleanText = text
      .replace(/^```json\s*/g, '')
      .replace(/^```\s*/g, '')
      .replace(/```\s*$/g, '')

    return JSON.parse(cleanText)
  }
}
