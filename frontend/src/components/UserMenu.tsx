import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { LogOutIcon, MonitorIcon } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '../contexts/AuthContext'
import { api } from '../api/client'

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 2)
}

// ── UserMenu ──────────────────────────────────────────────────────────────────

interface Props {
  user: User
  onLogout: () => void
}

export function UserMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showPairing, setShowPairing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="user-avatar">{initials(user.displayName)}</span>
        <span className="user-menu-name">{user.displayName}</span>
        <svg
          className={`user-menu-chevron ${open ? 'open' : ''}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-identity">
            <span className="user-avatar user-avatar-lg">{initials(user.displayName)}</span>
            <div className="user-menu-info">
              <span className="user-menu-fullname">{user.displayName}</span>
              <span className="user-menu-email">{user.email}</span>
            </div>
          </div>

          <div className="user-menu-sep" />

          <button
            className="user-menu-item"
            onClick={() => { setShowAccount(true); setOpen(false) }}
          >
            Account settings
          </button>

          <button
            className="user-menu-item"
            onClick={() => { setShowPairing(true); setOpen(false) }}
          >
            <MonitorIcon size={14} />
            Link desktop agent
          </button>

          <div className="user-menu-sep" />

          <button
            className="user-menu-item user-menu-item-danger"
            onClick={() => { onLogout(); setOpen(false) }}
          >
            <LogOutIcon size={14} />
            Sign out
          </button>
        </div>
      )}

      {showAccount && (
        <AccountModal user={user} onClose={() => setShowAccount(false)} />
      )}

      {showPairing && (
        <PairingCodeModal onClose={() => setShowPairing(false)} />
      )}
    </div>
  )
}

// ── PairingCodeModal ────────────────────────────────────────────────────────

function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

function PairingCodeModal({ onClose }: { onClose: () => void }) {
  const [code, setCode]           = useState<string | null>(null)
  const [secondsLeft, setSeconds] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.auth.generatePairingCode()
      setCode(res.code)
      setSeconds(res.expiresInSeconds)
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate code')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!code) return
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [code])

  const expired = code !== null && secondsLeft <= 0
  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal pairing-modal">
        <div className="modal-header">
          <h2>Link desktop agent</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pairing-modal-body">
          <p className="pairing-instructions">
            Open the Momentum tray app, choose <strong>Log in with a pairing code</strong>,
            and enter this code. It's single-use and expires shortly.
          </p>

          {error && <p className="form-error">{error}</p>}

          {code && !loading && (
            <div className="pairing-code-display">
              <span className={`pairing-code ${expired ? 'pairing-code-expired' : ''}`}>
                {formatCode(code)}
              </span>
              <span className="pairing-code-timer">
                {expired ? 'Expired' : `Expires in ${mm}:${ss}`}
              </span>
            </div>
          )}

          {loading && <p className="text-muted">Generating…</p>}

          {expired && (
            <button className="btn btn-primary btn-sm" onClick={generate}>
              Generate new code
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AccountModal ──────────────────────────────────────────────────────────────

function AccountModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { updateProfile, deleteAccount } = useAuth()

  // ── Profile edit ───────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user.displayName)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (trimmed === user.displayName) return
    setSaving(true)
    try {
      await updateProfile(trimmed)
      setDisplayName(trimmed)
      toast.success('Display name updated')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  const [showDelete, setShowDelete]     = useState(false)
  const [password, setPassword]         = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState<string | null>(null)

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount(password)
      // Auth state cleared — modal/app will unmount automatically
    } catch (err: any) {
      setDeleteError(err.message ?? 'Failed to delete account')
      setDeleting(false)
    }
  }

  function cancelDelete() {
    setShowDelete(false)
    setPassword('')
    setDeleteError(null)
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const isDirty = displayName.trim() !== user.displayName

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal account-modal">
        <div className="modal-header">
          <h2>Account settings</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="account-modal-body">
          {/* Avatar */}
          <div className="account-avatar-row">
            <span className="user-avatar user-avatar-xl">{initials(user.displayName)}</span>
          </div>

          {/* Profile form */}
          <form onSubmit={handleSave} className="account-form">
            <div className="form-group">
              <label htmlFor="acc-name">Display name</label>
              <input
                id="acc-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                minLength={2}
                maxLength={50}
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user.email} readOnly className="input-readonly" />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving || !isDirty}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          {/* Danger zone */}
          <div className="account-danger-zone">
            <h3 className="account-danger-title">Danger zone</h3>

            {!showDelete ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowDelete(true)}
              >
                Delete account
              </button>
            ) : (
              <form onSubmit={handleDelete} className="account-delete-form">
                <p className="account-delete-warning">
                  This permanently deletes your account and all data — sessions, projects, goals, everything.
                  This cannot be undone.
                </p>

                <div className="form-group">
                  <label htmlFor="acc-del-pw">Confirm with your password</label>
                  <input
                    id="acc-del-pw"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoFocus
                  />
                </div>

                {deleteError && <p className="form-error">{deleteError}</p>}

                <div className="account-delete-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={cancelDelete}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger btn-sm"
                    disabled={deleting || !password}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}