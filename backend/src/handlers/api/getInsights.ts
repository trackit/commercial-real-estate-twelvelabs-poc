import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-gemini-key',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

interface GeocodingResult {
  results: Array<{
    formatted_address: string
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
  }>
  status: string
}

interface PlacesResult {
  results: Array<{
    name: string
    rating?: number
    user_ratings_total?: number
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
  }>
  status: string
}

interface LocationInsights {
  address: string
  coordinates: {
    lat: number
    lng: number
  }
  walkScore: number
  walkLabel: string
  transitScore: number
  transitLabel: string
  bikeScore: number
  bikeLabel: string
  schools: Array<{
    name: string
    rating: number | null
    distance: {
      km: number
      mi: number
    }
  }>
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function getWalkLabel(score: number): string {
  if (score < 25) return 'Car-dependent'
  if (score < 50) return 'Limited walkability'
  if (score < 70) return 'Somewhat walkable'
  if (score < 90) return 'Very walkable'
  return 'Highly walkable'
}

function getTransitLabel(score: number): string {
  if (score < 25) return 'Minimal transit'
  if (score < 50) return 'Some transit'
  if (score < 70) return 'Good transit'
  if (score < 90) return 'Very good transit'
  return 'Excellent transit'
}

function getBikeLabel(score: number): string {
  if (score < 25) return 'Not very bike-friendly'
  if (score < 50) return 'Somewhat bikeable'
  if (score < 70) return 'Bikeable'
  if (score < 90) return 'Very bikeable'
  return 'Excellent for biking'
}

async function getNearbyCount(
  apiKey: string,
  lat: number,
  lng: number,
  type: string,
  radius: number
): Promise<number> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`

  const response = await fetch(url)
  const data = (await response.json()) as PlacesResult

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`Places API returned status: ${data.status} for type: ${type}`)
    return 0
  }

  return data.results.length
}

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  try {
    const apiKey = event.headers['x-gemini-key']
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Google Cloud API key is required' }),
      }
    }

    const body = JSON.parse(event.body || '{}')
    const address = body.address

    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Valid address is required (minimum 5 characters)',
        }),
      }
    }

    const encodedAddress = encodeURIComponent(address)
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`

    const geocodeResponse = await fetch(geocodeUrl)
    const geocodeData = (await geocodeResponse.json()) as GeocodingResult

    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: `Geocoding failed: ${geocodeData.status}. Please check the address.`,
        }),
      }
    }

    const location = geocodeData.results[0].geometry.location
    const formattedAddress = geocodeData.results[0].formatted_address
    const lat = location.lat
    const lng = location.lng

    const walkTypes = [
      'supermarket',
      'grocery_or_supermarket',
      'convenience_store',
      'shopping_mall',
      'pharmacy',
      'restaurant',
      'cafe',
    ]

    const transitTypes = ['bus_station', 'train_station', 'subway_station', 'transit_station']

    const bikeTypes = ['park', 'bicycle_store']

    let walkPois = 0
    for (const type of walkTypes) {
      const count = await getNearbyCount(apiKey, lat, lng, type, 1200)
      walkPois += count
    }

    let transitPois = 0
    for (const type of transitTypes) {
      const count = await getNearbyCount(apiKey, lat, lng, type, 800)
      transitPois += count
    }

    let bikePois = 0
    for (const type of bikeTypes) {
      const count = await getNearbyCount(apiKey, lat, lng, type, 1500)
      bikePois += count
    }

    const walkScore = Math.min(walkPois * 10, 100)
    const transitScore = Math.min(transitPois * 15, 100)
    const bikeScore = Math.min(bikePois * 10, 100)

    const schoolsUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=school&key=${apiKey}`
    const schoolsResponse = await fetch(schoolsUrl)
    const schoolsData = (await schoolsResponse.json()) as PlacesResult

    const schools = (schoolsData.results || [])
      .filter((school) => school.rating !== undefined)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3)
      .map((school) => {
        const distKm = haversineDistance(
          lat,
          lng,
          school.geometry.location.lat,
          school.geometry.location.lng
        )
        return {
          name: school.name,
          rating: school.rating || null,
          distance: {
            km: Math.round(distKm * 100) / 100,
            mi: Math.round(distKm * 0.621371 * 10) / 10,
          },
        }
      })

    const insights: LocationInsights = {
      address: formattedAddress,
      coordinates: { lat, lng },
      walkScore,
      walkLabel: getWalkLabel(walkScore),
      transitScore,
      transitLabel: getTransitLabel(transitScore),
      bikeScore,
      bikeLabel: getBikeLabel(bikeScore),
      schools,
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(insights),
    }
  } catch (error) {
    console.error('Error generating insights:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: error instanceof Error ? error.message : 'Failed to generate location insights',
      }),
    }
  }
}
