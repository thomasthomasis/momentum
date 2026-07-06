import { useState } from 'react'
import { api } from '../api/client'
import type { Project } from '../types'

interface Props {
  projects: Project[]
  selectedId: string | undefined
  onSelect: (id: string | undefined) => void
  onProjectCreated: () => void
}

export function ProjectSidebar({ projects, selectedId, onSelect, onProjectCreated }: Props) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      await api.projects.create({ name: newName.trim() })
      setNewName('')
      onProjectCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside className="sidebar">
      <h3>Projects</h3>
      <nav>
        <button
          className={`sidebar-item ${!selectedId ? 'active' : ''}`}
          onClick={() => onSelect(undefined)}
        >
          <span className="dot" style={{ background: '#888' }} />
          All Projects
          <span className="badge">{projects.reduce((s, p) => s + p.sessionCount, 0)}</span>
        </button>
        {projects.map(p => (
          <button
            key={p.id}
            className={`sidebar-item ${selectedId === p.id ? 'active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <span className="dot" style={{ background: p.color }} />
            <span className="project-name">{p.name}</span>
            <span className="badge">{p.sessionCount}</span>
          </button>
        ))}
      </nav>
      <form className="new-project-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New project…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          maxLength={100}
        />
        <button type="submit" disabled={creating || !newName.trim()} className="btn btn-sm">
          {creating ? '…' : '+'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </aside>
  )
}