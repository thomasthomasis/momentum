import { useMemo, useState, useEffect } from 'react'
import { api } from '../../api/client'
import type { FocusSession } from '../../types'

// ── constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// Mon=0 … Sun=6; show label every other row to avoid crowding
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

// ── helpers ───────────────────────────────────────────────────────────────────

function heatColor(hours: number): string {
  if (hours === 0) return 'var(--surface2)'
  if (hours < 0.5) return '#1e3a5f'
  if (hours < 1)   return '#1d4ed8'
  if (hours < 2)   return '#4f46e5'
  if (hours < 3)   return '#6366f1'
  if (hours < 4)   return '#818cf8'
  return '#a5b4fc'
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Cell {
  date: string
  hours: number
  tooltip: string
  isFuture: boolean
  isEmpty: boolean // padding cell — not a real day
}

// ── component ─────────────────────────────────────────────────────────────────

export function ActivityHeatmap() {
  const todayRef = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const currentYear = todayRef.getFullYear()
  const [year, setYear]         = useState(currentYear)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [loading, setLoading]   = useState(true)

  // Fetch sessions for the selected year (or trailing 365 days for current year)
  useEffect(() => {
    setLoading(true)

    const from = year === currentYear
      ? (() => {
          const d = new Date(todayRef)
          d.setDate(d.getDate() - 364)
          return d.toISOString()
        })()
      : new Date(year, 0, 1).toISOString()

    const to = year === currentYear
      ? undefined
      : new Date(year, 11, 31, 23, 59, 59).toISOString()

    api.sessions.list({ from, to, limit: 1000 })
      .then(r => setSessions(r.data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [year, currentYear, todayRef])

  // Build date → hours map
  const dayMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (!s.endedAt || !s.durationHours) continue
      const key = s.startedAt.slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + s.durationHours)
    }
    return map
  }, [sessions])

  // Build ordered array of days for this view
  const rawCells = useMemo<Cell[]>(() => {
    const todayStr = todayRef.toISOString().slice(0, 10)

    if (year === currentYear) {
      // Trailing 365 days — current day on the far right
      return Array.from({ length: 365 }, (_, i) => {
        const d = new Date(todayRef)
        d.setDate(todayRef.getDate() - (364 - i))
        const key   = d.toISOString().slice(0, 10)
        const hours = dayMap.get(key) ?? 0
        return {
          date:     key,
          hours,
          tooltip:  `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}: ${hours > 0 ? formatHours(hours) : 'no sessions'}`,
          isFuture: false,
          isEmpty:  false,
        }
      })
    } else {
      // Full calendar year Jan 1 → Dec 31
      const cells: Cell[] = []
      const d = new Date(year, 0, 1)
      while (d.getFullYear() === year) {
        const key   = d.toISOString().slice(0, 10)
        const hours = dayMap.get(key) ?? 0
        cells.push({
          date:     key,
          hours,
          tooltip:  `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}: ${hours > 0 ? formatHours(hours) : 'no sessions'}`,
          isFuture: key > todayStr,
          isEmpty:  false,
        })
        d.setDate(d.getDate() + 1)
      }
      return cells
    }
  }, [year, currentYear, todayRef, dayMap])

  // Group into week columns, padding the first column so Mon aligns to row 0
  const { weeks, monthLabels } = useMemo(() => {
    const firstDate = new Date(rawCells[0].date)
    const firstDow  = (firstDate.getDay() + 6) % 7  // Mon=0 … Sun=6

    const EMPTY: Cell = { date: '', hours: 0, tooltip: '', isFuture: false, isEmpty: true }
    const padded: Cell[] = [...Array(firstDow).fill(EMPTY), ...rawCells]

    // Pad end to complete weeks
    while (padded.length % 7 !== 0) padded.push({ ...EMPTY })

    const weeks: Cell[][] = []
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7))
    }

    // Month label: show when the first real day in the column is day 1–7 of its month
    const monthLabels = weeks.map(week => {
      const first = week.find(c => !c.isEmpty)
      if (!first) return ''
      const d = new Date(first.date)
      return d.getDate() <= 7 ? MONTH_NAMES[d.getMonth()] : ''
    })

    return { weeks, monthLabels }
  }, [rawCells])

  const totalHours = useMemo(() => rawCells.reduce((s, c) => s + c.hours, 0), [rawCells])
  const activeDays = useMemo(() => rawCells.filter(c => c.hours > 0).length,  [rawCells])

  // Year buttons: current year + 3 previous years
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - i)

  return (
    <div className="dash-widget dash-widget-wide">
      <div className="dash-widget-header">
        <h3 className="dash-widget-title">Activity</h3>
        <div className="heatmap-header-right">
          {!loading && (
            <span className="dash-widget-meta">
              {activeDays} active day{activeDays !== 1 ? 's' : ''} · {formatHours(totalHours)}
            </span>
          )}
          <div className="heatmap-year-nav">
            {yearOptions.map(y => (
              <button
                key={y}
                className={`heatmap-year-btn ${year === y ? 'active' : ''}`}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="heatmap-loading"><div className="spinner" /></div>
      ) : (
        <>
          <div className="heatmap-scroll">
            <div className="heatmap-wrap">
              {/* Day-of-week labels */}
              <div className="heatmap-day-labels">
                {DAY_LABELS.map((label, i) => (
                  <span key={i} className="heatmap-day-label">{label}</span>
                ))}
              </div>

              <div className="heatmap-grid-wrap">
                {/* Month labels */}
                <div className="heatmap-month-row">
                  {weeks.map((_, wi) => (
                    <span key={wi} className="heatmap-month-label">
                      {monthLabels[wi]}
                    </span>
                  ))}
                </div>

                {/* Cell grid */}
                <div className="heatmap-grid">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="heatmap-col">
                      {week.map((cell, di) => (
                        <div
                          key={cell.isEmpty ? `pad-${wi}-${di}` : cell.date}
                          className={`heatmap-cell${cell.isEmpty ? ' heatmap-cell-pad' : ''}${cell.isFuture ? ' heatmap-cell-future' : ''}`}
                          style={!cell.isEmpty && !cell.isFuture
                            ? { background: heatColor(cell.hours) }
                            : undefined}
                          title={cell.isEmpty ? undefined : cell.tooltip}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="heatmap-legend">
            <span className="heatmap-legend-label">Less</span>
            {[0, 0.5, 1, 2, 3, 4].map(h => (
              <div key={h} className="heatmap-cell" style={{ background: heatColor(h) }} />
            ))}
            <span className="heatmap-legend-label">More</span>
          </div>
        </>
      )}
    </div>
  )
}