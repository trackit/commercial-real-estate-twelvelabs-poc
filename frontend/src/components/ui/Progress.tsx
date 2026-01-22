import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  animated?: boolean
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = 'md',
      variant = 'default',
      showLabel = false,
      animated = true,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const sizes = {
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-4',
    }

    const variants = {
      default: 'bg-accent',
      success: 'bg-success',
      warning: 'bg-warning',
      error: 'bg-error',
    }

    return (
      <div className={clsx('space-y-1', className)} {...props} ref={ref}>
        {showLabel && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Progress</span>
            <span className="text-text-primary font-medium">{Math.round(percentage)}%</span>
          </div>
        )}
        <div className={clsx('w-full bg-border rounded-full overflow-hidden', sizes[size])}>
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500 ease-out',
              variants[variant],
              animated && 'relative overflow-hidden'
            )}
            style={{ width: `${percentage}%` }}
          >
            {animated && percentage > 0 && percentage < 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
            )}
          </div>
        </div>
      </div>
    )
  }
)

Progress.displayName = 'Progress'

interface CircularProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'success' | 'warning' | 'error'
}

export const CircularProgress = forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ className, value, size = 120, strokeWidth = 8, variant = 'default', ...props }, ref) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (value / 100) * circumference

    const variants = {
      default: 'text-accent',
      success: 'text-success',
      warning: 'text-warning',
      error: 'text-error',
    }

    return (
      <div
        ref={ref}
        className={clsx('relative inline-flex items-center justify-center', className)}
        {...props}
      >
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
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={clsx('transition-all duration-700 ease-out', variants[variant])}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-text-primary">{Math.round(value)}</span>
        </div>
      </div>
    )
  }
)

CircularProgress.displayName = 'CircularProgress'
