import { useState } from 'react'
import type { Goal, Project } from '../../types'
import { api } from '../../api/client'
import { CheckIcon } from '../Icons'

interface Props { goals: Goal[]; projects: Project[]; onGoalsChanged: () => void }

export default function GoalsProgress({ goals, projects, onGoalsChanged }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ projectId: '', targetHoursPerWeek: '10', label: '' })
  const [saving, setSaving] = useState(false)

  const activeGoals = goals.filter(g => g.isActive)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.goals.create({
        projectId: form.projectId || undefined,
        targetHoursPerWeek: Number(form.targetHoursPerWeek),
        label: form.label || undefined,
      })
      setShowCreate(false)
      setForm({ projectId: '', targetHoursPerWeek: '10', label: '' })
      onGoalsChanged()
    } finally { setSaving(false) }
  }

  return (
    <div className="goals-card">
      <div className="goals-header">
        <h3>Weekly Goals</h3>
        <button className="btn-sm" onClick={() => setShowCreate(v => !v)}>
          {showCreate ? 'Cancel' : '+ Add goal'}
        </button>
      </div>

      {showCreate && (
        <form className="goals-create-form" onSubmit={handleCreate}>
          <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
            <option value="">All projects (global)</option>
            {projects.filter(p => p.status === 'Active').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input type="number" min="0.5" max="168" step="0.5" required
            value={form.targetHoursPerWeek} placeholder="Target hrs/week"
            onChange={e => setForm(f => ({ ...f, targetHoursPerWeek: e.target.value }))} />
          <input type="text" maxLength={100} value={form.label} placeholder="Label (optional)"
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {activeGoals.length === 0 && !showCreate && (
        <p className="goals-empty">No goals yet. Add one to track your weekly focus time.</p>
      )}

      <div className="goals-list">
        {activeGoals.map(goal => {
          const pct   = Math.min(100, goal.progressPercent)
          const color = goal.projectColor ?? '#6366f1'
          const name  = goal.label ?? (goal.projectName ?? 'All projects')
          const done  = pct >= 100
          return (
            <div key={goal.id} className="goal-row">
              <div className="goal-row-header">
                <span className="goal-name">
                  {goal.projectColor && <span className="goal-dot" style={{ background: goal.projectColor }} />}
                  {name}
                </span>
                <span className="goal-hours">{goal.actualHoursThisWeek.toFixed(1)} / {goal.targetHoursPerWeek}h</span>
                <button className="goal-delete-btn" onClick={() => api.goals.delete(goal.id).then(onGoalsChanged)}>×</button>
              </div>
              <div className="goal-bar-track">
                <div className={`goal-bar-fill ${done ? 'goal-bar-done' : ''}`}
                  style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="goal-pct">{done ? <><CheckIcon size={12} /> Complete!</> : `${pct.toFixed(0)}%`}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}