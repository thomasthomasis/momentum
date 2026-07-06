import type { Stats } from '../../types'
import { EnergyIcon } from '../Icons'

interface Props {
  stats: Stats
}

export function ProjectBreakdown({ stats }: Props) {
  const { byProject } = stats
  if (byProject.length === 0) {
    return (
      <div className="dash-widget">
        <h3 className="dash-widget-title">Time by Project</h3>
        <p className="dash-empty">No project data yet.</p>
      </div>
    )
  }

  const maxHours = byProject[0].totalHours

  return (
    <div className="dash-widget">
      <h3 className="dash-widget-title">Time by Project</h3>
      <div className="project-breakdown">
        {byProject.map(p => {
          const pct = maxHours > 0 ? (p.totalHours / maxHours) * 100 : 0
          return (
            <div key={p.projectId} className="pb-row">
              <div className="pb-meta">
                <span className="pb-dot" style={{ background: p.projectColor }} />
                <span className="pb-name">{p.projectName}</span>
                <span className="pb-sessions">{p.sessionCount} sessions</span>
              </div>
              <div className="pb-bar-track">
                <div
                  className="pb-bar-fill"
                  style={{ width: `${pct}%`, background: p.projectColor }}
                />
              </div>
              <div className="pb-stats">
                <span className="pb-hours">{formatHours(p.totalHours)}</span>
                <span className="pb-energy" title="Avg energy">
                  <EnergyIcon size={12} />{p.averageEnergy.toFixed(1)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}