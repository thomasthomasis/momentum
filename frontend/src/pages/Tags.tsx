import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { toast } from 'sonner';

interface Tag { id: string; name: string; sessionCount: number }

export default function Tags() {
  const [tags, setTags]           = useState<Tag[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [saving, setSaving]       = useState(false)

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      setTags(await api.tags.list())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTags() }, [loadTags])

  async function handleRename(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await api.tags.rename(id, editName.trim())
      setEditingId(null)
      loadTags()
      toast.success('Tag renamed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove tag "${name}" from all your sessions?`)) return
    try {
      await api.tags.delete(id)
      loadTags()
      toast.success(`Tag "${name}" removed`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="tags-page">
      <div className="tags-header">
        <h1 className="tags-title">Tags</h1>
        <p className="tags-subtitle">
          {tags.length} tag{tags.length !== 1 ? 's' : ''} across your sessions
        </p>
      </div>

      {loading && <div className="spinner" />}

      {!loading && tags.length === 0 && (
        <div className="empty-state">
          <p>No tags yet. Add tags when logging sessions.</p>
        </div>
      )}

      {!loading && tags.length > 0 && (
        <div className="tags-table">
          <div className="tags-table-header">
            <span>Tag</span><span>Sessions</span><span />
          </div>
          {tags.map(tag => (
            <div key={tag.id} className="tags-table-row">
              {editingId === tag.id ? (
                <>
                  <input className="tag-edit-input" value={editName}
                    onChange={e => setEditName(e.target.value)} autoFocus maxLength={50}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(tag.id); if (e.key === 'Escape') setEditingId(null) }} />
                  <span className="tag-session-count">{tag.sessionCount}</span>
                  <div className="tag-actions">
                    <button className="btn-sm btn-primary" onClick={() => handleRename(tag.id)} disabled={saving}>
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className="btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="tag-chip">#{tag.name}</span>
                  <span className="tag-session-count">{tag.sessionCount}</span>
                  <div className="tag-actions">
                    <button className="btn-sm" onClick={() => { setEditingId(tag.id); setEditName(tag.name) }}>Rename</button>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(tag.id, tag.name)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}