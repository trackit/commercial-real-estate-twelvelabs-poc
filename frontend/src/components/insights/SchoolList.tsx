import { GraduationCap, Star } from 'lucide-react'
import { Card } from '../ui'
import type { School } from '../../types'

interface SchoolListProps {
  schools: School[]
}

export function SchoolList({ schools }: SchoolListProps) {
  return (
    <Card variant="elevated" padding="none">
      <div className="divide-y divide-border">
        {schools.map((school, index) => (
          <div key={index} className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-text-primary">{school.name}</h4>
              <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                {school.rating !== null && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                    {school.rating.toFixed(1)}/5
                  </span>
                )}
                <span>
                  {school.distance.mi} mi ({school.distance.km} km) away
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
