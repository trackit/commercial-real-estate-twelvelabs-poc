import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { PipelineStep } from '../../types'

interface PipelineStepsProps {
  steps: PipelineStep[]
}

export function PipelineSteps({ steps }: PipelineStepsProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={clsx(
            'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
            step.status === 'running' && 'bg-accent/5 border border-accent/20',
            step.status === 'complete' && 'opacity-80',
            step.status === 'error' && 'bg-error/5 border border-error/20'
          )}
        >
          <div className="flex-shrink-0">
            {step.status === 'complete' && (
              <CheckCircle className="w-5 h-5 text-success animate-scale-in" />
            )}
            {step.status === 'running' && (
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            )}
            {step.status === 'pending' && <Circle className="w-5 h-5 text-text-muted" />}
            {step.status === 'error' && <XCircle className="w-5 h-5 text-error" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'text-sm font-medium',
                  step.status === 'running' && 'text-accent',
                  step.status === 'complete' && 'text-text-secondary',
                  step.status === 'pending' && 'text-text-muted',
                  step.status === 'error' && 'text-error'
                )}
              >
                {step.name}
              </span>
              {step.detail && (
                <span className="text-xs text-text-muted bg-border px-2 py-0.5 rounded-full">
                  {step.detail}
                </span>
              )}
            </div>
            {step.progress !== undefined && step.status === 'running' && (
              <div className="mt-1 h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
            )}
          </div>

          <span className="text-xs text-text-muted tabular-nums">{index + 1}/{steps.length}</span>
        </div>
      ))}
    </div>
  )
}
