import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type { Project, FocusSession, SessionFilters } from '../types'
import { ProjectSidebar } from '../components/ProjectSidebar'
import { SessionCard } from '../components/SessionCard'
import { CreateSessionModal } from '../components/CreateSessionModal'
import { FilterBar } from '../components/FilterBar'
import { StatsBar } from '../components/StatsBar'
import { EditSessionModal } from '../components/EditSessionModal'
import { DownloadIcon } from '../components/Icons'
import { toast } from 'sonner';

interface Props {
  onLogSession?: () => void
}

export function Sessions({ onLogSession }: Props) {
  const [projects, setProjects]             = useState<Project[]>([])
  const [sessions, setSessions]             = useState<FocusSession[]>([])
  const [nextCursor, setNextCursor]         = useState<string | null>(null)
  const [hasMore, setHasMore]               = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [filters, setFilters]               = useState<Omit<SessionFilters, 'projectId' | 'afterCursor'>>({})
  const [showModal, setShowModal]           = useState(false)
  const [editingSession, setEditingSession] = useState<FocusSession | null>(null)
  const [loading, setLoading]               = useState(false)
  const [exporting, setExporting]           = useState(false)

  const loadProjects = useCallback(async () => {
    setProjects(await api.projects.list())
  }, [])

  const loadSessions = useCallback(async (reset = true) => {
    setLoading(true)
    try {
      const result = await api.sessions.list({
        ...filters,
        projectId:   selectedProjectId,
        afterCursor: reset ? undefined : (nextCursor ?? undefined),
        limit:       15,
      })
      setSessions(prev => reset ? result.data : [...prev, ...result.data])
      setNextCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [filters, selectedProjectId, nextCursor])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { loadSessions(true) }, [filters, selectedProjectId]) // eslint-disable-line

  const handleSessionCreated = () => {
    setShowModal(false)
    loadSessions(true)
    loadProjects()
    onLogSession?.()
    toast.success('Session logged!')
  }

  const handleDelete = async (id: string) => {
    try {
      await api.sessions.delete(id)
      loadSessions(true)
      loadProjects()
      toast.success('Session deleted')
    } catch (e) {
      toast.error('Failed to delete session')
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.csv.sessions(filters.from, filters.to, selectedProjectId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div className="app-body">
      <ProjectSidebar
        projects={projects}
        selectedId={selectedProjectId}
        onSelect={setSelectedProjectId}
        onProjectCreated={loadProjects}
      />

      <main className="main-content">
        <StatsBar projectId={selectedProjectId} />
        <FilterBar filters={filters} onChange={f => setFilters(f)} />

        <div className="sessions-header">
          <h2>
            {selectedProject ? selectedProject.name : 'All Sessions'}
            <span className="sessions-count">{sessions.length} shown</span>
          </h2>
          <div className="sessions-header-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleExport}
              disabled={exporting}
              title="Export as CSV"
            >
              {exporting ? 'Exporting…' : <><DownloadIcon size={13} /> Export CSV</>}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              + Log Session
            </button>
          </div>
        </div>

        {sessions.length === 0 && !loading && (
          <div className="empty-state">
            <p>No sessions yet.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              Log your first session
            </button>
          </div>
        )}

        <div className="sessions-list">
          {sessions.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {hasMore && (
          <button
            className="btn btn-ghost load-more"
            onClick={() => loadSessions(false)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}

        {loading && sessions.length === 0 && <div className="spinner" />}
      </main>

      {showModal && (
        <CreateSessionModal
          projects={projects}
          defaultProjectId={selectedProjectId}
          onClose={() => setShowModal(false)}
          onCreated={handleSessionCreated}
        />
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          projects={projects}
          onClose={() => setEditingSession(null)}
          onSaved={() => { setEditingSession(null); loadSessions(true) }}
        />
      )}
    </div>
  )
}