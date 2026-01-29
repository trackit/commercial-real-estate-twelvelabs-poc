import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export const handler: APIGatewayProxyHandler = async (
  event,
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const videoId = event.pathParameters?.videoId;

    if (!videoId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'videoId is required' }),
      };
    }

    const key = `${videoId}/output/final.mp4`;

    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
        }),
      );
    } catch {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Output video not found' }),
      };
    }

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: 'attachment; filename="final.mp4"',
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        videoId,
        downloadUrl: presignedUrl,
      }),
    };
  } catch (error) {
    console.error('Error generating output video URL:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Failed to generate output video URL' }),
    };
  }
};
