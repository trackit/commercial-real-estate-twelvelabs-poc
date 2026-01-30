import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  try {
    const videoId = event.pathParameters?.id

    if (!videoId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Video ID is required' }),
      }
    }

    const response = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.VIDEOS_TABLE,
        Key: { id: { S: videoId } },
      })
    )

    if (!response.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Video not found' }),
      }
    }

    const item = response.Item
    const video = {
      id: item.id?.S || '',
      filename: item.filename?.S || '',
      s3Uri: item.s3Uri?.S || '',
      size: parseInt(item.size?.N || '0', 10),
      status: item.status?.S || 'unknown',
      createdAt: item.createdAt?.S || '',
      duration: item.duration?.N ? parseFloat(item.duration.N) : undefined,
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(video),
    }
  } catch (error) {
    console.error('Error getting video:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Failed to get video' }),
    }
  }
}
