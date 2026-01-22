import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../ui'
import { clsx } from 'clsx'

interface LiveLogProps {
  logs: string[]
}

export function LiveLog({ logs }: LiveLogProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logContainerRef.current && isExpanded) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isExpanded])

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-text-muted" />
          <CardTitle>Live Log</CardTitle>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-surface-elevated rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </button>
      </CardHeader>
      {isExpanded && (
        <div
          ref={logContainerRef}
          className="px-6 pb-6 max-h-48 overflow-y-auto font-mono text-xs"
        >
          {logs.length === 0 ? (
            <p className="text-text-muted">Waiting for logs...</p>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={clsx(
                  'py-0.5 animate-slide-up',
                  log.includes('[ERROR]')
                    ? 'text-error'
                    : log.includes('[VO]')
                      ? 'text-accent'
                      : log.includes('[JOB')
                        ? 'text-success'
                        : 'text-text-secondary'
                )}
              >
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  )
}
