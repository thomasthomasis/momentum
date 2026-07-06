import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Stats } from '../types'

interface Props { projectId?: string }

export function StatsBar({ projectId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.stats.get(projectId).then(setStats).catch(() => setStats(null))
  }, [projectId])

  if (!stats) return null

  return (
    <div className="stats-bar">
      <Stat label="Total Hours" value={`${stats.totalHours}h`} />
      <Stat label="Sessions"    value={String(stats.totalSessions)} />
      <Stat label="Avg Energy"  value={`${stats.averageEnergy}/5`} />
      <Stat label="Shipped"     value={String(stats.shippedCount)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}