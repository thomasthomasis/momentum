import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type { Project, FocusSession, Stats } from '../types'
import { CreateEditProjectModal } from '../components/CreateEditProjectModal'
import { EditSessionModal } from '../components/EditSessionModal'
import { SessionCard } from '../components/SessionCard'

export function Projects() {
  const [projects, setProjects]               = useState<Project[]>([])
  const [selected, setSelected]               = useState<Project | null>(null)
  const [editing, setEditing]                 = useState<Project | null>(null)
  const [editingSession, setEditingSession]   = useState<FocusSession | null>(null)
  const [showCreate, setShowCreate]           = useState(false)
  const [sessions, setSessions]               = useState<FocusSession[]>([])
  const [projectStats, setProjectStats]       = useState<Stats | null>(null)
  const [loading, setLoading]                 = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.projects.list()
      setProjects(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    if (!selected) { setSessions([]); setProjectStats(null); return }
    setSessionsLoading(true)
    Promise.all([
      api.sessions.list({ projectId: selected.id, limit: 50 }),
      api.stats.get(selected.id),
    ]).then(([sessResult, stats]) => {
      setSessions(sessResult.data)
      setProjectStats(stats)
    }).finally(() => setSessionsLoading(false))
  }, [selected])

  const handleArchive = async (p: Project) => {
    const newStatus = p.status === 'Active' ? 'Archived' : 'Active'
    const updated = await api.projects.update(p.id, { status: newStatus })
    setProjects(prev => prev.map(x => x.id === updated.id ? updated : x))
    if (selected?.id === updated.id) setSelected(updated)
  }

  const handleDelete = async (p: Project) => {
    if (!confirm(`Delete "${p.name}"? This will also delete all its sessions.`)) return
    await api.projects.delete(p.id)
    setProjects(prev => prev.filter(x => x.id !== p.id))
    if (selected?.id === p.id) setSelected(null)
  }

  const handleSaved = (saved: Project) => {
    setProjects(prev => {
      const exists = prev.find(p => p.id === saved.id)
      return exists
        ? prev.map(p => p.id === saved.id ? saved : p)
        : [saved, ...prev]
    })
    setShowCreate(false)
    setEditing(null)
    if (selected?.id === saved.id) setSelected(saved)
  }

  const handleDeleteSession = async (id: string) => {
    await api.sessions.delete(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (selected) {
      const updated = await api.projects.getById(selected.id)
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
      setSelected(updated)
    }
  }

  const handleSessionSaved = (updated: FocusSession) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
    setEditingSession(null)
  }

  const active   = projects.filter(p => p.status === 'Active')
  const archived = projects.filter(p => p.status === 'Archived')

  if (loading) return <div className="dashboard-loading"><div className="spinner" /></div>

  return (
    <div className="projects-page">
      <div className="projects-list-panel">
        <div className="projects-list-header">
          <h2 className="projects-list-title">Projects</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + New
          </button>
        </div>

        {projects.length === 0 && (
          <div className="dash-empty" style={{ paddingTop: 40 }}>
            No projects yet.<br />Create one to get started.
          </div>
        )}

        {active.length > 0 && (
          <div className="project-group">
            <p className="project-group-label">Active</p>
            {active.map(p => (
              <ProjectRow
                key={p.id}
                project={p}
                selected={selected?.id === p.id}
                onSelect={() => setSelected(selected?.id === p.id ? null : p)}
                onEdit={() => setEditing(p)}
                onArchive={() => handleArchive(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div className="project-group">
            <p className="project-group-label">Archived</p>
            {archived.map(p => (
              <ProjectRow
                key={p.id}
                project={p}
                selected={selected?.id === p.id}
                onSelect={() => setSelected(selected?.id === p.id ? null : p)}
                onEdit={() => setEditing(p)}
                onArchive={() => handleArchive(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="projects-detail-panel">
        {!selected ? (
          <div className="projects-detail-empty">
            <span>←</span>
            <p>Select a project to view its sessions and stats</p>
          </div>
        ) : (
          <>
            <div className="project-detail-header">
              <div className="project-detail-title-row">
                <span className="project-detail-dot" style={{ background: selected.color }} />
                <h2 className="project-detail-name">{selected.name}</h2>
                {selected.status === 'Archived' && (
                  <span className="project-archived-badge">Archived</span>
                )}
              </div>
              {selected.description && (
                <p className="project-detail-desc">{selected.description}</p>
              )}
              <div className="project-detail-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(selected)}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleArchive(selected)}>
                  {selected.status === 'Active' ? 'Archive' : 'Unarchive'}
                </button>
              </div>
            </div>

            {projectStats && (
              <div className="project-stats-row">
                <StatPill label="Sessions"    value={String(projectStats.totalSessions)} />
                <StatPill label="Total Hours" value={`${projectStats.totalHours}h`} />
                <StatPill label="Avg Energy"  value={`${projectStats.averageEnergy.toFixed(1)}/5`} />
                <StatPill label="Shipped"     value={String(projectStats.shippedCount)} />
              </div>
            )}

            <div className="project-sessions-label">
              Sessions
              <span className="sessions-count">{sessions.length} shown</span>
            </div>

            {sessionsLoading && <div className="spinner" />}

            {!sessionsLoading && sessions.length === 0 && (
              <div className="dash-empty">No sessions for this project yet.</div>
            )}

            <div className="sessions-list">
              {sessions.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateEditProjectModal
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}

      {editing && (
        <CreateEditProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          projects={projects}
          onClose={() => setEditingSession(null)}
          onSaved={handleSessionSaved}
        />
      )}
    </div>
  )
}

function ProjectRow({
  project, selected, onSelect, onEdit, onArchive, onDelete,
}: {
  project: Project
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  return (
    <div className={`project-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="project-row-dot" style={{ background: project.color }} />
      <div className="project-row-info">
        <span className="project-row-name">{project.name}</span>
        <span className="project-row-meta">
          {project.sessionCount} sessions · {project.totalHours.toFixed(1)}h
        </span>
      </div>
      <div className="project-row-actions" onClick={e => e.stopPropagation()}>
        <button className="proj-action-btn" onClick={onEdit} title="Edit">✏️</button>
        <button className="proj-action-btn" onClick={onArchive} title={project.status === 'Active' ? 'Archive' : 'Unarchive'}>
          {project.status === 'Active' ? '📦' : '♻️'}
        </button>
        <button className="proj-action-btn danger" onClick={onDelete} title="Delete">🗑</button>
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-pill">
      <span className="stat-pill-value">{value}</span>
      <span className="stat-pill-label">{label}</span>
    </div>
  )
}