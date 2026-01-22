import type { LocationInsights, School } from '../types/index.js'

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'

const WALK_RADIUS = 1200
const TRANSIT_RADIUS = 800
const BIKE_RADIUS = 1500
const SCHOOL_RADIUS = 5000

const WALK_TYPES = ['supermarket', 'grocery_or_supermarket', 'convenience_store', 'shopping_mall', 'pharmacy', 'restaurant', 'cafe']
const TRANSIT_TYPES = ['bus_station', 'train_station', 'subway_station', 'transit_station']
const BIKE_TYPES = ['park', 'bicycle_store']

interface GeocodeResponse {
  status: string
  results: Array<{
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
    formatted_address: string
  }>
}

interface PlacesResponse {
  results: Array<{
    name: string
    rating?: number
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
  }>
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
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

export class InsightsService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async getInsights(address: string): Promise<LocationInsights> {
    const geocodeResponse = await fetch(
      `${GEOCODING_URL}?address=${encodeURIComponent(address)}&key=${this.apiKey}`
    )
    const geocodeData = await geocodeResponse.json() as GeocodeResponse

    if (geocodeData.status !== 'OK') {
      const errorMessage = (geocodeData as any).error_message
      if (geocodeData.status === 'REQUEST_DENIED' && errorMessage?.includes('not activated')) {
        throw new Error('Geocoding API is not enabled. Please enable the Geocoding API in your Google Cloud Console at console.cloud.google.com')
      }
      throw new Error(errorMessage || `Geocoding failed: ${geocodeData.status}`)
    }

    const location = geocodeData.results[0].geometry.location
    const formattedAddress = geocodeData.results[0].formatted_address
    const lat = location.lat
    const lng = location.lng

    const [walkPois, transitPois, bikePois, schoolsData] = await Promise.all([
      this.countNearbyPlaces(lat, lng, WALK_TYPES, WALK_RADIUS),
      this.countNearbyPlaces(lat, lng, TRANSIT_TYPES, TRANSIT_RADIUS),
      this.countNearbyPlaces(lat, lng, BIKE_TYPES, BIKE_RADIUS),
      this.getNearbySchools(lat, lng),
    ])

    const walkScore = Math.min(walkPois * 10, 100)
    const transitScore = Math.min(transitPois * 15, 100)
    const bikeScore = Math.min(bikePois * 10, 100)

    const schools: School[] = schoolsData.slice(0, 3).map((school) => {
      const distKm = haversineKm(lat, lng, school.lat, school.lng)
      return {
        name: school.name,
        rating: school.rating,
        distance: {
          km: Math.round(distKm * 100) / 100,
          mi: Math.round(distKm * 0.621371 * 10) / 10,
        },
      }
    })

    return {
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
  }

  private async countNearbyPlaces(
    lat: number,
    lng: number,
    types: string[],
    radius: number
  ): Promise<number> {
    let total = 0

    for (const type of types) {
      const response = await fetch(
        `${PLACES_URL}?location=${lat},${lng}&radius=${radius}&type=${type}&key=${this.apiKey}`
      )
      const data = await response.json() as PlacesResponse
      if (data.results) {
        total += data.results.length
      }
    }

    return total
  }

  private async getNearbySchools(
    lat: number,
    lng: number
  ): Promise<Array<{ name: string; rating: number | null; lat: number; lng: number }>> {
    const response = await fetch(
      `${PLACES_URL}?location=${lat},${lng}&radius=${SCHOOL_RADIUS}&type=school&key=${this.apiKey}`
    )
    const data = await response.json() as PlacesResponse

    if (!data.results) return []

    return data.results
      .map((school) => ({
        name: school.name,
        rating: school.rating ?? null,
        lat: school.geometry.location.lat,
        lng: school.geometry.location.lng,
      }))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${GEOCODING_URL}?address=test&key=${this.apiKey}`
      )
      const data = await response.json() as GeocodeResponse
      return data.status !== 'REQUEST_DENIED'
    } catch {
      return false
    }
  }
}
