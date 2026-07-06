import { useState } from 'react'
import { EnergyBars } from './Icons'
import type { FocusSession, BrowsedSiteDto } from '../types'

interface Props {
  session: FocusSession
  onDelete: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

function SiteBreakdown({ sites }: { sites: BrowsedSiteDto[] }) {
  if (sites.length === 0) return null
  const maxSeconds = sites[0].timeSpentSeconds

  return (
    <div className="site-breakdown">
      {sites.slice(0, 5).map(site => {
        const pct = Math.round((site.timeSpentSeconds / maxSeconds) * 100)
        const label = site.timeSpentMinutes >= 1
          ? `${site.timeSpentMinutes.toFixed(0)}m`
          : `${site.timeSpentSeconds}s`

        return (
          <div key={site.domain} className="site-row">
            <span className="site-domain" title={site.domain}>{site.domain}</span>
            <div className="site-bar-wrap">
              <div className="site-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="site-time">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function SessionCard({ session, onDelete }: Props) {
  const [showSites, setShowSites] = useState(false)

  const duration = session.durationHours != null
    ? `${(session.durationHours * 60).toFixed(0)}m`
    : 'In progress'

  const hasSites = (session.browsedSites?.length ?? 0) > 0

  return (
    <article className="session-card">
      <div className="session-card-accent" style={{ background: session.projectColor }} />

      <div className="session-card-body">
        <div className="session-card-top">
          <span className="session-project" style={{ color: session.projectColor }}>
            {session.projectName}
          </span>
          <span className="session-duration">{duration}</span>
        </div>

        <h3 className="session-title">{session.title}</h3>

        {session.notes && (
          <p className="session-notes">{session.notes}</p>
        )}

        <div className="session-meta">
          <EnergyBars level={session.energyLevel} />
          {session.shipped && (
            <span className="session-shipped">Shipped</span>
          )}
          {session.tags.length > 0 && (
            <div className="session-tags">
              {session.tags.map(tag => (
                <span key={tag} className="session-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="session-footer">
          <span className="session-date">{formatDate(session.startedAt)}</span>
          <div className="session-actions">
            {hasSites && (
              <button
                className="btn-ghost"
                onClick={() => setShowSites(v => !v)}
              >
                {showSites ? 'Hide sites' : 'Sites'}
              </button>
            )}
            <button
              className="btn-ghost btn-danger"
              onClick={() => onDelete(session.id)}
            >
              Delete
            </button>
          </div>
        </div>

        {showSites && session.browsedSites && (
          <SiteBreakdown sites={session.browsedSites} />
        )}
      </div>
    </article>
  )
}