import React, { useState } from 'react'
import { BoltIcon } from '../components/Icons'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onSwitchToLogin: () => void
}

export default function RegisterPage({ onSwitchToLogin }: Props) {
  const { register } = useAuth()
  const [email, setEmail]             = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(email, displayName, password)
    } catch (err: any) {
      setError(err.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-inner">
          <div className="auth-logo">
            <BoltIcon size={28} />
            <h1>Momentum</h1>
          </div>
          <p className="auth-subtitle">Create your account</p>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="displayName">Display name</label>
              <input
                id="displayName" type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name" minLength={3} required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters" minLength={8} required
              />
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <button className="auth-switch-btn" onClick={onSwitchToLogin}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}