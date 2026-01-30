import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'

const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { videoId, voiceId, agencyName, streetAddress } = body

    if (!videoId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'videoId is required' }),
      }
    }

    const videoResponse = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.VIDEOS_TABLE,
        Key: { id: { S: videoId } },
      })
    )

    if (!videoResponse.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Video not found' }),
      }
    }

    const s3Uri = videoResponse.Item.s3Uri?.S
    if (!s3Uri) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Video has no S3 URI' }),
      }
    }

    const executionName = `video-${videoId}-${Date.now()}`
    const response = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN,
        name: executionName,
        input: JSON.stringify({
          videoId,
          videoS3Uri: s3Uri,
          bucketName: process.env.S3_BUCKET_NAME,
          voiceId: voiceId || 'Joanna',
          agencyName: agencyName || 'Skyline Estates',
          streetAddress: streetAddress || '',
        }),
      })
    )

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        executionId: response.executionArn,
        videoId,
        status: 'RUNNING',
      }),
    }
  } catch (error) {
    console.error('Error starting pipeline:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Failed to start pipeline' }),
    }
  }
}
