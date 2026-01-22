import { Home, DoorOpen, Sofa, ChefHat, Bed, Bath, ArrowUpDown, TreeDeciduous } from 'lucide-react'
import { clsx } from 'clsx'
import type { Segment } from '../../types'
import { formatDuration } from '../../utils/format'

interface SegmentCardProps {
  segment: Segment
}

const roomIcons: Record<string, React.ElementType> = {
  Exterior: Home,
  Entry: DoorOpen,
  Living: Sofa,
  Kitchen: ChefHat,
  Bedroom: Bed,
  Bathroom: Bath,
  Hallway: ArrowUpDown,
  Stairs: ArrowUpDown,
  Outdoor: TreeDeciduous,
  Other: Home,
}

export function SegmentCard({ segment }: SegmentCardProps) {
  const Icon = roomIcons[segment.roomType] || Home

  const scoreColor =
    segment.appealScore >= 8
      ? 'text-success'
      : segment.appealScore >= 5
        ? 'text-warning'
        : 'text-error'

  return (
    <div className="p-3 bg-surface rounded-lg border border-border hover:border-accent/30 transition-all duration-200 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{segment.title}</p>
          <p className="text-xs text-text-muted">
            {formatDuration(segment.startTime)} - {formatDuration(segment.endTime)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted bg-border px-2 py-0.5 rounded-full">
          {segment.roomType}
        </span>
        <span className={clsx('text-sm font-bold tabular-nums', scoreColor)}>
          {segment.appealScore}/10
        </span>
      </div>
    </div>
  )
}
