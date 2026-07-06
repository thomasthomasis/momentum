import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { FocusSession, Project } from '../types'

interface Props {
  session: FocusSession
  projects: Project[]
  onClose: () => void
  onSaved: (session: FocusSession) => void
}

function toLocal(iso: string) {
  // Convert ISO string to datetime-local input format
  return new Date(iso).toISOString().slice(0, 16)
}

export function EditSessionModal({ session, projects, onClose, onSaved }: Props) {
  const [title, setTitle]           = useState(session.title)
  const [notes, setNotes]           = useState(session.notes ?? '')
  const [projectId, setProjectId]   = useState(session.projectId)
  const [energyLevel, setEnergy]    = useState(session.energyLevel)
  const [shipped, setShipped]       = useState(session.shipped)
  const [tags, setTags]             = useState(session.tags.join(', '))
  const [startedAt, setStartedAt]   = useState(toLocal(session.startedAt))
  const [endedAt, setEndedAt]       = useState(session.endedAt ? toLocal(session.endedAt) : '')
  const [error, setError]           = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }

    setSaving(true)
    setError(null)
    try {
      const updated = await api.sessions.update(session.id, {
        projectId,
        title:       title.trim(),
        notes:       notes.trim() || undefined,
        energyLevel,
        shipped,
        startedAt:   new Date(startedAt).toISOString(),
        endedAt:     endedAt ? new Date(endedAt).toISOString() : undefined,
        tags:        tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      onSaved(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const ENERGY_LABELS = ['', 'Drained', 'Low', 'Moderate', 'Solid', 'Peak 🔥']

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Session</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Started at</label>
              <input
                type="datetime-local"
                value={startedAt}
                onChange={e => setStartedAt(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Ended at</label>
              <input
                type="datetime-local"
                value={endedAt}
                onChange={e => setEndedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Energy — {ENERGY_LABELS[energyLevel]}</label>
            <input
              type="range" min={1} max={5} value={energyLevel}
              onChange={e => setEnergy(Number(e.target.value))}
            />
            <div className="energy-labels">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>

          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. frontend, bugfix, research"
            />
          </div>

          <div className="form-group form-checkbox">
            <label>
              <input
                type="checkbox"
                checked={shipped}
                onChange={e => setShipped(e.target.checked)}
              />
              Shipped something 🚀
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}