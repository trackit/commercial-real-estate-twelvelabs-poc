import { Home, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useApiConfig } from '../../hooks/useApiConfig'
import { Badge } from '../ui'

export function Header() {
  const location = useLocation()
  const { status } = useApiConfig()

  const configuredCount = Object.values(status).filter(Boolean).length
  const totalCount = Object.keys(status).length
  const allConfigured = configuredCount === totalCount

  return (
    <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Home className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">RealEstate AI</h1>
            <p className="text-xs text-text-muted">Video Processing Pipeline</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={allConfigured ? 'success' : 'warning'} size="sm">
              {configuredCount}/{totalCount} APIs configured
            </Badge>
          </div>

          <Link
            to="/settings"
            className={`p-2 rounded-lg transition-colors ${
              location.pathname === '/settings'
                ? 'bg-accent/10 text-accent'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  )
}
