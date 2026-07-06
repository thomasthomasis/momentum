import { useMemo } from 'react'
import type { FocusSession } from '../../types'

interface Props {
  sessions: FocusSession[]
}

const W = 600
const H = 160
const PAD = { top: 16, right: 16, bottom: 32, left: 32 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

const ENERGY_COLORS = ['', '#94a3b8', '#64748b', '#22c55e', '#f59e0b', '#ef4444']

export function EnergyTrend({ sessions }: Props) {
  const data = useMemo(() =>
    [...sessions]
      .filter(s => s.endedAt)
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .slice(-40),
    [sessions]
  )

  if (data.length < 2) {
    return (
      <div className="dash-widget dash-widget-wide">
        <h3 className="dash-widget-title">Energy Trend</h3>
        <p className="dash-empty">Need at least 2 sessions to show a trend.</p>
      </div>
    )
  }

  const toY = (e: number) => PAD.top + INNER_H - ((e - 1) / 4) * INNER_H
  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * INNER_W

  const points = data.map((s, i) => `${toX(i)},${toY(s.energyLevel)}`).join(' ')

  const area = [
    `M ${toX(0)},${toY(data[0].energyLevel)}`,
    ...data.slice(1).map((s, i) => `L ${toX(i + 1)},${toY(s.energyLevel)}`),
    `L ${toX(data.length - 1)},${H - PAD.bottom}`,
    `L ${toX(0)},${H - PAD.bottom}`,
    'Z',
  ].join(' ')

  const avg = data.reduce((a, s) => a + s.energyLevel, 0) / data.length
  const avgY = toY(avg)

  return (
    <div className="dash-widget dash-widget-wide">
      <div className="dash-widget-header">
        <h3 className="dash-widget-title">Energy Trend</h3>
        <span className="dash-widget-meta">
          last {data.length} sessions · avg {avg.toFixed(1)}/5
        </span>
      </div>

      <div className="energy-chart-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="energy-svg"
        >
          <defs>
            <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[1, 2, 3, 4, 5].map(e => (
            <g key={e}>
              <line
                x1={PAD.left} y1={toY(e)} x2={W - PAD.right} y2={toY(e)}
                stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4"
              />
              <text x={PAD.left - 6} y={toY(e) + 4} textAnchor="end"
                fill="var(--text-muted)" fontSize="11">
                {e}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY}
            stroke="#6366f1" strokeWidth="1" strokeDasharray="6,3" opacity="0.5"
          />
          <text x={W - PAD.right + 4} y={avgY + 4} fill="#6366f1" fontSize="10">avg</text>

          <path d={area} fill="url(#energyGrad)" />

          <polyline
            points={points}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {data.map((s, i) => (
            <circle
              key={s.id}
              cx={toX(i)}
              cy={toY(s.energyLevel)}
              r="4"
              fill={ENERGY_COLORS[s.energyLevel]}
              stroke="var(--surface)"
              strokeWidth="2"
            >
              <title>
                {new Date(s.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {'\n'}{s.title}
                {'\n'}Energy: {s.energyLevel}/5
              </title>
            </circle>
          ))}

          {data.map((s, i) => {
            if (i !== 0 && i !== data.length - 1 && i % 10 !== 0) return null
            return (
              <text
                key={s.id}
                x={toX(i)}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10"
              >
                {new Date(s.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}