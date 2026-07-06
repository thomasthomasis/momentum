import type { SiteStat } from '../../types'

interface Props {
  sites: SiteStat[]
}

export function TopSites({ sites }: Props) {
  if (sites.length === 0) {
    return (
      <div className="dash-widget">
        <h3 className="dash-widget-title">Top Sites</h3>
        <p className="dash-empty">No browsing data yet — start a session with the extension.</p>
      </div>
    )
  }

  const maxSeconds = sites[0].timeSpentSeconds

  return (
    <div className="dash-widget">
      <h3 className="dash-widget-title">Top Sites</h3>
      <div className="top-sites">
        {sites.slice(0, 10).map((site, i) => {
          const pct       = maxSeconds > 0 ? (site.timeSpentSeconds / maxSeconds) * 100 : 0
          const minutes   = site.timeSpentSeconds / 60
          const timeLabel = minutes >= 60
            ? `${(minutes / 60).toFixed(1)}h`
            : `${minutes.toFixed(0)}m`

          return (
            <div key={site.domain} className="ts-row">
              <span className="ts-rank">{i + 1}</span>
              <div className="ts-info">
                <div className="ts-domain-row">
                  <span className="ts-domain" title={site.domain}>{site.domain}</span>
                  <span className="ts-time">{timeLabel}</span>
                </div>
                <div className="ts-bar-track">
                  <div className="ts-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="ts-meta">
                  <span>{site.visitCount} visits</span>
                  <span>{site.sessionCount} {site.sessionCount === 1 ? 'session' : 'sessions'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}