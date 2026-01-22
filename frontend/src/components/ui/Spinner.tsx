import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizes = {
      sm: 'w-4 h-4 border-2',
      md: 'w-8 h-8 border-3',
      lg: 'w-12 h-12 border-4',
    }

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-full border-accent border-t-transparent animate-spin',
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)

Spinner.displayName = 'Spinner'

interface LoadingOverlayProps extends HTMLAttributes<HTMLDivElement> {
  message?: string
}

export const LoadingOverlay = forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ className, message, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50',
          className
        )}
        {...props}
      >
        <Spinner size="lg" />
        {message && <p className="mt-4 text-text-secondary">{message}</p>}
      </div>
    )
  }
)

LoadingOverlay.displayName = 'LoadingOverlay'
