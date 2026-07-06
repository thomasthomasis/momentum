import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import type { FocusSession } from '../types'

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // normalise to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const ENERGY_EMOJI = ['', '😴', '😐', '🙂', '😊', '🔥']

export function WeekView() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [sessions, setSessions]   = useState<FocusSession[]>([])
  const [loading, setLoading]     = useState(true)

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekStart])

  useEffect(() => {
    setLoading(true)
    api.sessions.list({
      from:  weekStart.toISOString(),
      to:    weekEnd.toISOString(),
      limit: 100,
    })
      .then(r => setSessions(r.data))
      .finally(() => setLoading(false))
  }, [weekStart, weekEnd])

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }), [weekStart])

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, FocusSession[]>()
    for (const s of sessions) {
      const key = s.startedAt.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [sessions])

  const totalHours = sessions
    .filter(s => s.durationHours)
    .reduce((a, s) => a + (s.durationHours ?? 0), 0)

  const isThisWeek = weekStart.toDateString() === getWeekStart(new Date()).toDateString()
  const today      = new Date().toISOString().slice(0, 10)

  const goTo = (offset: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + offset)
    setWeekStart(d)
  }

  const weekLabel = [
    weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    '–',
    new Date(weekEnd.getTime() - 1).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    }),
  ].join(' ')

  return (
    <div className="week-view">
      <div className="week-nav">
        <div className="week-nav-side">
          <button className="btn btn-ghost btn-sm" onClick={() => goTo(-7)}>← Prev</button>
          {!isThisWeek && (
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>
              Today
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => goTo(7)}>Next →</button>
        </div>

        <h2 className="week-label">{weekLabel}</h2>

        <div className="week-nav-side week-nav-right">
          <span className="week-summary">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h
          </span>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-loading"><div className="spinner" /></div>
      ) : (
        <div className="week-grid">
          {days.map(day => {
            const key         = day.toISOString().slice(0, 10)
            const daySessions = sessionsByDay.get(key) ?? []
            const dayHours    = daySessions
              .filter(s => s.durationHours)
              .reduce((a, s) => a + (s.durationHours ?? 0), 0)
            const isToday = key === today

            return (
              <div key={key} className={`week-day ${isToday ? 'week-day-today' : ''}`}>
                <div className="week-day-header">
                  <span className="week-day-name">
                    {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className={`week-day-date ${isToday ? 'week-day-date-today' : ''}`}>
                    {day.getDate()}
                  </span>
                  {dayHours > 0 && (
                    <span className="week-day-hours">{dayHours.toFixed(1)}h</span>
                  )}
                </div>

                <div className="week-day-sessions">
                  {daySessions.length === 0
                    ? <div className="week-day-empty" />
                    : daySessions.map(s => (
                        <WeekSessionCard key={s.id} session={s} />
                      ))
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WeekSessionCard({ session }: { session: FocusSession }) {
  const time = new Date(session.startedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
  const duration = session.durationHours != null
    ? `${Math.round(session.durationHours * 60)}m`
    : 'ongoing'

  return (
    <div className="week-session-card" style={{ borderLeftColor: session.projectColor }}>
      <div className="week-session-top">
        <span className="week-session-time">{time}</span>
        <span className="week-session-duration">{duration}</span>
      </div>
      <div className="week-session-title" title={session.title}>{session.title}</div>
      <div className="week-session-meta">
        <span className="week-session-project" style={{ color: session.projectColor }}>
          {session.projectName}
        </span>
        <span>{ENERGY_EMOJI[session.energyLevel]}</span>
        {session.shipped && <span title="Shipped">🚀</span>}
      </div>
    </div>
  )
}