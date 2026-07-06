import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { BASE } from '../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  userId: string
  email: string
  displayName: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string // absolute ISO timestamp
}

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, displayName: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
  updateProfile: (displayName: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
}

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'momentum_auth'

function saveToStorage(tokens: AuthTokens, user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tokens, user }))
}

function loadFromStorage(): { tokens: AuthTokens; user: User } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

// ── Extension sync ───────────────────────────────────────────────────────────
//
// The Chrome extension's content script (extension/content-script.js) listens
// for these events on our own origin and relays the payload into
// chrome.storage.local — so logging in here also logs the extension in,
// without a second email/password entry. Content scripts only inject on page
// load/navigation, so an already-open tab won't pick this up until refreshed.

function broadcastAuthToExtension(tokens: AuthTokens, user: User) {
  window.dispatchEvent(new CustomEvent('momentum-auth', {
    detail: {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt:    new Date(tokens.expiresAt).getTime(), // extension stores this as a ms epoch, not ISO
      user: { id: user.userId, email: user.email, displayName: user.displayName },
    },
  }))
}

function broadcastLogoutToExtension() {
  window.dispatchEvent(new CustomEvent('momentum-logout'))
}

// ── API response shape ────────────────────────────────────────────────────────

interface ApiAuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds
  user: { id: string; email: string; displayName: string }
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

const API = `${BASE}/auth`
const REFRESH_BUFFER_MS = 60_000 // refresh 60 s before expiry

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, tokens: null, isLoading: true,
  })

  // A ref to the current tokens so callbacks never close over stale state
  const tokensRef = useRef<AuthTokens | null>(null)

  // Coalesce concurrent refresh calls into one in-flight promise.
  // If multiple API calls fire simultaneously with an expired token, only
  // one /refresh request is made; all callers await the same promise.
  const refreshingRef = useRef<Promise<string | null> | null>(null)

  // ── Apply a successful API auth response ──────────────────────────────────

  const applyAuthResponse = useCallback((data: ApiAuthResponse): AuthTokens => {
    const tokens: AuthTokens = {
      accessToken:  data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt:    new Date(Date.now() + data.expiresIn * 1000).toISOString(),
    }
    const user: User = {
      userId:      data.user.id,
      email:       data.user.email,
      displayName: data.user.displayName,
    }
    tokensRef.current = tokens
    saveToStorage(tokens, user)
    setState({ user, tokens, isLoading: false })
    broadcastAuthToExtension(tokens, user)
    return tokens
  }, [])

  // ── One refresh network call ──────────────────────────────────────────────

  const doRefresh = useCallback(async (refreshToken: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API}/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        clearStorage()
        tokensRef.current = null
        setState({ user: null, tokens: null, isLoading: false })
        return null
      }
      const data = await res.json() as ApiAuthResponse
      const tokens = applyAuthResponse(data)
      return tokens.accessToken
    } catch {
      // Network error — return the existing token and let the request fail naturally
      return tokensRef.current?.accessToken ?? null
    }
  }, [applyAuthResponse])

  // ── Startup: rehydrate, pre-refresh if expired ────────────────────────────
  //
  // We resolve isLoading=false only after we have a usable token.
  // This means AuthenticatedApp never mounts with a stale/expired token,
  // eliminating the 401 flash the user sees on every page reload.

  useEffect(() => {
    const saved = loadFromStorage()

    if (!saved) {
      setState(s => ({ ...s, isLoading: false }))
      return
    }

    tokensRef.current = saved.tokens
    const expiresAt = new Date(saved.tokens.expiresAt).getTime()
    const isExpired = expiresAt - Date.now() <= REFRESH_BUFFER_MS

    if (!isExpired) {
      // Token still good — show the app right away
      setState({ user: saved.user, tokens: saved.tokens, isLoading: false })
      broadcastAuthToExtension(saved.tokens, saved.user)
      return
    }

    // Token is expired (or about to be) — silently refresh before showing the app
    doRefresh(saved.tokens.refreshToken).then(newToken => {
      if (!newToken) {
        // doRefresh already cleared state; just make sure loading is false
        setState(s => ({ ...s, isLoading: false }))
      }
      // If refresh succeeded, applyAuthResponse already called setState
    })
  }, [doRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? err.title ?? 'Login failed')
    }
    applyAuthResponse(await res.json() as ApiAuthResponse)
  }, [applyAuthResponse])

  const register = useCallback(async (
    email: string, displayName: string, password: string,
  ) => {
    const res = await fetch(`${API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, displayName, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const firstError = err.errors
        ? Object.values(err.errors as Record<string, string[]>).flat()[0]
        : (err.error ?? err.title ?? 'Registration failed')
      throw new Error(firstError as string)
    }
    applyAuthResponse(await res.json() as ApiAuthResponse)
  }, [applyAuthResponse])

  // ── getAccessToken (called by the API client before every request) ─────────

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const tokens = tokensRef.current
    if (!tokens) return null

    const expiresAt = new Date(tokens.expiresAt).getTime()
    if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
      return tokens.accessToken // still fresh
    }

    // Token is expiring — refresh, but coalesce concurrent calls
    if (!refreshingRef.current) {
      refreshingRef.current = doRefresh(tokens.refreshToken).finally(() => {
        refreshingRef.current = null
      })
    }
    return refreshingRef.current
  }, [doRefresh]) // tokensRef is a ref so it doesn't need to be a dep

  const updateProfile = useCallback(async (displayName: string) => {
    const token = await getAccessToken()
    const res = await fetch('/api/v1/users/me', {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ displayName }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Failed to update profile')
    }
    setState(s => {
      if (!s.user) return s
      const updatedUser = { ...s.user, displayName }
      const saved = loadFromStorage()
      if (saved) saveToStorage(saved.tokens, updatedUser)
      return { ...s, user: updatedUser }
    })
  }, [getAccessToken])

  const deleteAccount = useCallback(async (password: string) => {
    const token = await getAccessToken()
    const res = await fetch('/api/v1/users/me', {
      method:  'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Failed to delete account')
    }
    clearStorage()
    tokensRef.current = null
    setState({ user: null, tokens: null, isLoading: false })
    broadcastLogoutToExtension()
  }, [getAccessToken])

  const logout = useCallback(async () => {
    const token = tokensRef.current?.refreshToken
    if (token) {
      fetch(`${API}/logout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: token }),
      }).catch(() => {})
    }
    clearStorage()
    tokensRef.current = null
    setState({ user: null, tokens: null, isLoading: false })
    broadcastLogoutToExtension()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, getAccessToken, updateProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}