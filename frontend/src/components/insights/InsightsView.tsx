import { useState } from 'react'
import { Search, MapPin, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input } from '../ui'
import { ScoreCard } from './ScoreCard'
import { SchoolList } from './SchoolList'
import { useInsights } from '../../hooks/useInsights'
import { useApiConfig } from '../../hooks/useApiConfig'
import { Spinner } from '../ui/Spinner'

export function InsightsView() {
  const navigate = useNavigate()
  const { status: configStatus } = useApiConfig()
  const { insights, isLoading, error, fetchInsights, reset } = useInsights()
  const [address, setAddress] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (address.trim().length >= 5) {
      fetchInsights(address.trim())
    }
  }

  if (!configStatus.gemini) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Location Insights</h2>
          <p className="text-text-secondary mt-1">
            Get walkability, transit, and amenity scores for any property address.
          </p>
        </div>

        <Card variant="elevated" className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">API Key Required</h3>
          <p className="text-text-secondary mb-4">
            Please configure your Google Cloud API key in Settings to get location insights.
          </p>
          <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Location Insights</h2>
        <p className="text-text-secondary mt-1">
          Get walkability, transit, and amenity scores for any property address.
        </p>
      </div>

      <Card variant="elevated">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter property address (e.g., 123 Main Street, Miami, FL)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                leftIcon={<MapPin className="w-4 h-4" />}
              />
            </div>
            <Button
              type="submit"
              disabled={address.trim().length < 5 || isLoading}
              leftIcon={isLoading ? undefined : <Search className="w-4 h-4" />}
              isLoading={isLoading}
            >
              Get Insights
            </Button>
          </form>
        </div>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-text-secondary">Analyzing location...</p>
        </div>
      )}

      {error && (
        <Card variant="elevated" className="border-error">
          <div className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Error</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button onClick={reset} variant="secondary">
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {insights && !isLoading && (
        <div className="space-y-6 animate-fade-in">
          <Card variant="glass" className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-accent mt-0.5" />
              <div>
                <p className="font-medium text-text-primary">{insights.address}</p>
                <p className="text-sm text-text-muted">
                  Coordinates: {insights.coordinates.lat.toFixed(4)},{' '}
                  {insights.coordinates.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </Card>

          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Getting Around</h3>
            <div className="grid grid-cols-3 gap-4">
              <ScoreCard
                icon="walk"
                label="Walk Score"
                score={insights.walkScore}
                description={insights.walkLabel}
              />
              <ScoreCard
                icon="transit"
                label="Transit Score"
                score={insights.transitScore}
                description={insights.transitLabel}
              />
              <ScoreCard
                icon="bike"
                label="Bike Score"
                score={insights.bikeScore}
                description={insights.bikeLabel}
              />
            </div>
          </div>

          {insights.schools.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4">Nearby Schools</h3>
              <SchoolList schools={insights.schools} />
            </div>
          )}
        </div>
      )}

      {!insights && !isLoading && !error && (
        <Card variant="elevated" className="p-12 text-center">
          <MapPin className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Enter an Address</h3>
          <p className="text-text-secondary">
            Search for a property address to see walkability, transit, and nearby amenities.
          </p>
        </Card>
      )}
    </div>
  )
}
