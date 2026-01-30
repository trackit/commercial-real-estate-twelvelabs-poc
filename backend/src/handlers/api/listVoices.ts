import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

interface PollyVoice {
  id: string
  name: string
  gender: 'Male' | 'Female'
  accent: string
}

const POLLY_VOICES: PollyVoice[] = [
  { id: 'Joanna', name: 'Joanna', gender: 'Female', accent: 'US English' },
  { id: 'Matthew', name: 'Matthew', gender: 'Male', accent: 'US English' },
  { id: 'Ruth', name: 'Ruth', gender: 'Female', accent: 'US English' },
  { id: 'Stephen', name: 'Stephen', gender: 'Male', accent: 'US English' },
  { id: 'Amy', name: 'Amy', gender: 'Female', accent: 'British English' },
  { id: 'Brian', name: 'Brian', gender: 'Male', accent: 'British English' },
  { id: 'Olivia', name: 'Olivia', gender: 'Female', accent: 'Australian English' },
  { id: 'Aria', name: 'Aria', gender: 'Female', accent: 'New Zealand English' },
]

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(POLLY_VOICES),
  }
}
