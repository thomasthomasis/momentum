import type { Insights } from '../../types'
import { CalendarIcon, ClockIcon, BarChartIcon } from '../Icons'

interface Props {
  insights: Insights
}

function formatHour(hour: number) {
  if (hour === 0)  return '12am'
  if (hour < 12)  return `${hour}am`
  if (hour === 12) return '12pm'
  return `${hour - 12}pm`
}

function formatDuration(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(1)}h`
}

export default function InsightsPanel({ insights }: Props) {
  const {
    peakHour, bestDay, avgSessionHours,
    hourBreakdown, dayBreakdown, topTags, sessionsAnalysed
  } = insights

  if (sessionsAnalysed === 0) {
    return (
      <div className="insights-panel">
        <h3 className="insights-title">Insights</h3>
        <p className="insights-empty">Complete some sessions to see your productivity patterns.</p>
      </div>
    )
  }

  const maxHourCount = Math.max(...hourBreakdown.map(h => h.sessionCount), 1)
  const maxDayHours  = Math.max(...dayBreakdown.map(d => d.totalHours), 1)
  const maxTagCount  = Math.max(...topTags.map(t => t.count), 1)

  return (
    <div className="insights-panel">
      <h3 className="insights-title">Insights</h3>

      <div className="insights-pills">
        {peakHour && (
          <div className="insight-pill">
            <ClockIcon size={14} />
            <div>
              <div className="insight-pill-value">{formatHour(peakHour.hour)}</div>
              <div className="insight-pill-label">Peak hour</div>
            </div>
          </div>
        )}
        {bestDay && (
          <div className="insight-pill">
            <CalendarIcon size={14} />
            <div>
              <div className="insight-pill-value">{bestDay.dayName.slice(0, 3)}</div>
              <div className="insight-pill-label">Best day</div>
            </div>
          </div>
        )}
        <div className="insight-pill">
          <ClockIcon size={14} />
          <div>
            <div className="insight-pill-value">{formatDuration(avgSessionHours)}</div>
            <div className="insight-pill-label">Avg session</div>
          </div>
        </div>
        <div className="insight-pill">
          <BarChartIcon size={14} />
          <div>
            <div className="insight-pill-value">{sessionsAnalysed}</div>
            <div className="insight-pill-label">Sessions</div>
          </div>
        </div>
      </div>

      <div className="insights-charts">
        <div className="insights-chart-block">
          <h4>Sessions by hour</h4>
          <div className="hour-bars">
            {hourBreakdown.map(h => (
              <div key={h.hour} className="hour-bar-col"
                title={`${formatHour(h.hour)}: ${h.sessionCount} sessions`}>
                <div
                  className={`hour-bar-fill ${h.hour === peakHour?.hour ? 'hour-bar-peak' : ''}`}
                  style={{ height: `${(h.sessionCount / maxHourCount) * 100}%` }}
                />
                {h.hour % 6 === 0 && (
                  <span className="hour-bar-label">{formatHour(h.hour)}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="insights-chart-block">
          <h4>Sessions by day</h4>
          <div className="day-bars">
            {dayBreakdown.map(d => (
              <div key={d.dayOfWeek} className="day-bar-row">
                <span className="day-bar-label">{d.dayName.slice(0, 3)}</span>
                <div className="day-bar-track">
                  <div
                    className={`day-bar-fill ${d.dayOfWeek === bestDay?.dayOfWeek ? 'day-bar-best' : ''}`}
                    style={{ width: `${(d.totalHours / maxDayHours) * 100}%` }}
                  />
                </div>
                <span className="day-bar-hours">
                  {d.totalHours > 0 ? formatDuration(d.totalHours) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {topTags.length > 0 && (
          <div className="insights-chart-block">
            <h4>Top tags</h4>
            <div className="tag-bars">
              {topTags.map(t => (
                <div key={t.tag} className="tag-bar-row">
                  <span className="tag-bar-label">{t.tag}</span>
                  <div className="tag-bar-track">
                    <div
                      className="tag-bar-fill"
                      style={{ width: `${(t.count / maxTagCount) * 100}%` }}
                    />
                  </div>
                  <span className="tag-bar-count">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}