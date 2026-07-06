import type { StreakInfo } from '../../types'
import { FlameIcon } from '../Icons'

function flameColor(days: number) {
  if (days >= 30) return '#f97316'
  if (days >= 14) return '#ef4444'
  if (days >= 7)  return '#f59e0b'
  if (days >= 3)  return '#8b5cf6'
  return '#6366f1'
}

export default function StreakCard({ streak }: { streak: StreakInfo }) {
  const { currentStreak, longestStreak, lastActiveDate } = streak
  const color = flameColor(currentStreak)
  const lastSeen = lastActiveDate
    ? new Date(lastActiveDate + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  return (
    <div className="streak-card">
      <div className="streak-main">
        <FlameIcon size={48} className="streak-flame" />
        <div>
          <div className="streak-count" style={{ color }}>
            {currentStreak === 0 ? 'No active streak' : currentStreak === 1 ? '1 day' : `${currentStreak} days`}
          </div>
          <div className="streak-label">Current streak</div>
        </div>
      </div>
      <div className="streak-divider" />
      <div className="streak-stats">
        <div className="streak-stat">
          <span className="streak-stat-value">{longestStreak > 0 ? `${longestStreak}d` : '—'}</span>
          <span className="streak-stat-label">Best</span>
        </div>
        {lastSeen && (
          <div className="streak-stat">
            <span className="streak-stat-value">{lastSeen}</span>
            <span className="streak-stat-label">Last session</span>
          </div>
        )}
      </div>
      {currentStreak === 0 && (
        <p className="streak-nudge">Log a session today to start your streak!</p>
      )}
    </div>
  )
}