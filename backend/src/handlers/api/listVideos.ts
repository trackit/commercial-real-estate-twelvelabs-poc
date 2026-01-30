import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'

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
    const response = await dynamoClient.send(
      new ScanCommand({
        TableName: process.env.VIDEOS_TABLE,
      })
    )

    const videos = (response.Items || []).map((item) => ({
      id: item.id?.S || '',
      filename: item.filename?.S || '',
      s3Uri: item.s3Uri?.S || '',
      size: parseInt(item.size?.N || '0', 10),
      status: item.status?.S || 'unknown',
      createdAt: item.createdAt?.S || '',
      duration: item.duration?.N ? parseFloat(item.duration.N) : undefined,
    }))

    videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(videos),
    }
  } catch (error) {
    console.error('Error listing videos:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Failed to list videos' }),
    }
  }
}
