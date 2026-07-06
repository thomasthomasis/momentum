import { useState } from 'react'
import { api } from '../api/client'
import type { Project } from '../types'

interface Props {
  projects: Project[]
  defaultProjectId?: string
  onClose: () => void
  onCreated: () => void
}

function toLocalISOString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateSessionModal({ projects, defaultProjectId, onClose, onCreated }: Props) {
  const now = new Date()
  const [form, setForm] = useState({
    projectId:   defaultProjectId ?? projects[0]?.id ?? '',
    title:       '',
    notes:       '',
    energyLevel: 3,
    shipped:     false,
    startedAt:   toLocalISOString(new Date(now.getTime() - 60 * 60 * 1000)),
    endedAt:     toLocalISOString(now),
    tags:        '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectId || !form.title.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.sessions.create({
        projectId:   form.projectId,
        title:       form.title.trim(),
        notes:       form.notes.trim() || undefined,
        energyLevel: form.energyLevel,
        shipped:     form.shipped,
        startedAt:   new Date(form.startedAt).toISOString(),
        endedAt:     form.endedAt ? new Date(form.endedAt).toISOString() : undefined,
        tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2>Log Focus Session</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project *</label>
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)} required>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>What did you work on? *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Implemented cursor-based pagination…" maxLength={200} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Started</label>
              <input type="datetime-local" value={form.startedAt}
                onChange={e => set('startedAt', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Ended</label>
              <input type="datetime-local" value={form.endedAt}
                onChange={e => set('endedAt', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Energy level: {form.energyLevel}/5</label>
            <input type="range" min={1} max={5} value={form.energyLevel}
              onChange={e => set('energyLevel', Number(e.target.value))} />
            <div className="energy-labels"><span>Drained</span><span>Peak</span></div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="What did you learn? Any blockers?" rows={3} />
          </div>
          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
              placeholder="feature, backend, learning" />
          </div>
          <div className="form-group form-checkbox">
            <label>
              <input type="checkbox" checked={form.shipped}
                onChange={e => set('shipped', e.target.checked)} />
              I shipped something in this session 🚀
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}