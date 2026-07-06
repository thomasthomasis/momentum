import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Project, CreateProjectRequest } from '../types'

interface Props {
  project?: Project        // if provided, we're editing; otherwise creating
  onClose: () => void
  onSaved: (p: Project) => void
}

const COLOR_SWATCHES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
  '#06b6d4', '#64748b',
]

export function CreateEditProjectModal({ project, onClose, onSaved }: Props) {
  const [name, setName]               = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor]             = useState(project?.color ?? '#6366f1')
  const [error, setError]             = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }

    setSaving(true)
    setError(null)
    try {
      const body: CreateProjectRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      }
      const saved = project
        ? await api.projects.update(project.id, body)
        : await api.projects.create(body)
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2>{project ? 'Edit Project' : 'New Project'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Side project, Work, Learning"
            />
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>

          <div className="form-group">
            <label>Colour</label>
            <div className="color-swatches">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                title="Custom colour"
                className="color-custom"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}