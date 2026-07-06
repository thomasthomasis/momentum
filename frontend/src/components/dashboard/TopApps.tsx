import type { AppStat } from '../../types'

interface Props {
  apps: AppStat[]
}

export function TopApps({ apps }: Props) {
  if (apps.length === 0) {
    return (
      <div className="dash-widget">
        <h3 className="dash-widget-title">Top Apps</h3>
        <p className="dash-empty">No app-usage data yet — start a session with the desktop tray agent.</p>
      </div>
    )
  }

  const maxSeconds = apps[0].timeSpentSeconds

  return (
    <div className="dash-widget">
      <h3 className="dash-widget-title">Top Apps</h3>
      <div className="top-sites">
        {apps.slice(0, 10).map((app, i) => {
          const pct       = maxSeconds > 0 ? (app.timeSpentSeconds / maxSeconds) * 100 : 0
          const minutes   = app.timeSpentSeconds / 60
          const timeLabel = minutes >= 60
            ? `${(minutes / 60).toFixed(1)}h`
            : `${minutes.toFixed(0)}m`

          return (
            <div key={app.appName} className="ts-row">
              <span className="ts-rank">{i + 1}</span>
              <div className="ts-info">
                <div className="ts-domain-row">
                  <span className="ts-domain" title={app.appName}>{app.appName}</span>
                  <span className="ts-time">{timeLabel}</span>
                </div>
                <div className="ts-bar-track">
                  <div className="ts-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="ts-meta">
                  <span>{app.switchCount} switches</span>
                  <span>{app.sessionCount} {app.sessionCount === 1 ? 'session' : 'sessions'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
