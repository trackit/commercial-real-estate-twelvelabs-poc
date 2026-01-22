import { Footprints, Train, Bike } from 'lucide-react'
import { Card } from '../ui'
import { clsx } from 'clsx'

interface ScoreCardProps {
  icon: 'walk' | 'transit' | 'bike'
  label: string
  score: number
  description: string
}

const icons = {
  walk: Footprints,
  transit: Train,
  bike: Bike,
}

export function ScoreCard({ icon, label, score, description }: ScoreCardProps) {
  const Icon = icons[icon]

  const variant = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'error'

  const colors = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  }

  const bgColors = {
    success: 'stroke-success',
    warning: 'stroke-warning',
    error: 'stroke-error',
  }

  const size = 120
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference

  return (
    <Card variant="elevated" className="p-6 text-center">
      <div className="flex flex-col items-center mb-4">
        <Icon className={clsx('w-6 h-6 mb-3', colors[variant])} />
        <div className="relative inline-flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-border"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={clsx('transition-all duration-1000 ease-out', bgColors[variant])}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={clsx('text-3xl font-bold', colors[variant])}>{score}</span>
          </div>
        </div>
      </div>
      <h4 className="font-semibold text-text-primary">{label}</h4>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </Card>
  )
}
