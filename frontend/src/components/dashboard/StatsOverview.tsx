import type { Stats } from '../../types'
import type { ReactNode } from 'react'
import { ClockIcon, EnergyIcon, RocketIcon, BarChartIcon } from '../Icons'

interface Props {
  stats: Stats
}

export function StatsOverview({ stats }: Props) {
  const avgMinutes = stats.totalSessions > 0
    ? Math.round((stats.totalHours * 60) / stats.totalSessions)
    : 0

  const shippedRate = stats.totalSessions > 0
    ? Math.round((stats.shippedCount / stats.totalSessions) * 100)
    : 0

  return (
    <div className="stats-overview">
      <StatCard
        icon={<ClockIcon size={20} />}
        label="Total Focus Time"
        value={formatHours(stats.totalHours)}
        sub={`avg ${avgMinutes}m / session`}
        accent="#6366f1"
      />
      <StatCard
        icon={<BarChartIcon size={20} />}
        label="Sessions"
        value={String(stats.totalSessions)}
        sub={`${stats.shippedCount} shipped`}
        accent="#06b6d4"
      />
      <StatCard
        icon={<EnergyIcon size={20} />}
        label="Avg Energy"
        value={`${stats.averageEnergy.toFixed(1)}`}
        sub={energyLabel(stats.averageEnergy)}
        accent={energyColor(stats.averageEnergy)}
      />
      <StatCard
        icon={<RocketIcon size={20} />}
        label="Ship Rate"
        value={`${shippedRate}%`}
        sub={`${stats.shippedCount} of ${stats.totalSessions}`}
        accent="#22c55e"
      />
    </div>
  )
}

function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="stat-card" style={{ borderTopColor: accent }}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-sub">{sub}</div>
    </div>
  )
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function energyLabel(e: number) {
  if (e >= 4.5) return 'peak flow'
  if (e >= 3.5) return 'solid energy'
  if (e >= 2.5) return 'moderate'
  return 'low energy'
}

function energyColor(e: number) {
  if (e >= 4) return '#f59e0b'
  if (e >= 3) return '#22c55e'
  return '#94a3b8'
}