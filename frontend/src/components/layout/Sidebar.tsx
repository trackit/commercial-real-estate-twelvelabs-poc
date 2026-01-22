import { Upload, Zap, MapPin, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const navItems = [
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/pipeline', icon: Zap, label: 'Pipeline' },
  { to: '/insights', icon: MapPin, label: 'Insights' },
]

const bottomItems = [{ to: '/settings', icon: Settings, label: 'Settings' }]

export function Sidebar() {
  return (
    <aside className="w-64 h-[calc(100vh-4rem)] border-r border-border bg-surface/30 flex flex-col">
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-accent/10 text-accent border-l-2 border-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
