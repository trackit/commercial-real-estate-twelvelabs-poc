import { AlertCircle, MapPin } from 'lucide-react'
import { useEffect } from 'react'
import { useInsights } from '../../hooks/useInsights'
import { SchoolList } from '../insights/SchoolList'
import { ScoreCard } from '../insights/ScoreCard'
import { Card, CardHeader, CardTitle } from '../ui'
import { Spinner } from '../ui/Spinner'

interface LocationInsightsProps {
  streetAddress: string
}

export function LocationInsights({ streetAddress }: LocationInsightsProps) {
  const { insights, isLoading, error, fetchInsights } = useInsights()

  useEffect(() => {
    if (streetAddress && streetAddress.trim().length >= 5) {
      fetchInsights(streetAddress.trim())
    }
  }, [streetAddress, fetchInsights])

  if (!streetAddress || streetAddress.trim().length < 5) {
    return null
  }

  if (isLoading) {
    return (
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Location Insights</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6 flex flex-col items-center justify-center py-8">
          <Spinner size="lg" />
          <p className="mt-4 text-text-secondary">Analyzing location...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="elevated" className="border-warning">
        <CardHeader>
          <CardTitle>Location Insights</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6 text-center py-4">
          <AlertCircle className="w-10 h-10 text-warning mx-auto mb-3" />
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      </Card>
    )
  }

  if (!insights) {
    return null
  }

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Location Insights</CardTitle>
      </CardHeader>
      <div className="px-6 pb-6 space-y-6">
        <Card variant="glass" className="p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
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
          <h3 className="text-base font-semibold text-text-primary mb-3">Getting Around</h3>
          <div className="grid grid-cols-3 gap-3">
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
            <h3 className="text-base font-semibold text-text-primary mb-3">Nearby Schools</h3>
            <SchoolList schools={insights.schools} />
          </div>
        )}
      </div>
    </Card>
  )
}
