import type {
  CreateProjectRequest, CreateSessionRequest, CreateGoalRequest,
  FocusSession, Goal, Insights, PagedResult, Project, SessionFilters,
  SiteStat, AppStat, SessionStatus, Stats, StreakInfo,
} from '../types'

const BASE = '/api/v1'

let _getAccessToken: (() => Promise<string | null>) | null = null

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getAccessToken = fn
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = _getAccessToken ? await _getAccessToken() : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? error.title ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  auth: {
    generatePairingCode: (): Promise<{ code: string; expiresInSeconds: number }> =>
      request('/auth/pairing-code', { method: 'POST' }),
  },

  projects: {
    list: (): Promise<Project[]> =>
      request('/projects'),
    getById: (id: string): Promise<Project> =>
      request(`/projects/${id}`),
    create: (body: CreateProjectRequest): Promise<Project> =>
      request('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<CreateProjectRequest & { status: string }>): Promise<Project> =>
      request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string): Promise<void> =>
      request(`/projects/${id}`, { method: 'DELETE' }),
  },

  sessions: {
    list: (filters: SessionFilters = {}): Promise<PagedResult<FocusSession>> => {
      const params = new URLSearchParams()
      if (filters.projectId)   params.set('projectId',  filters.projectId)
      if (filters.from)        params.set('from',        filters.from)
      if (filters.to)          params.set('to',          filters.to)
      if (filters.minEnergy)   params.set('minEnergy',   String(filters.minEnergy))
      if (filters.shippedOnly) params.set('shippedOnly', 'true')
      if (filters.afterCursor) params.set('afterCursor', filters.afterCursor)
      if (filters.limit)       params.set('limit',       String(filters.limit))
      const qs = params.toString()
      return request(`/sessions${qs ? `?${qs}` : ''}`)
    },
    getById: (id: string): Promise<FocusSession> =>
      request(`/sessions/${id}`),
    create: (body: CreateSessionRequest): Promise<FocusSession> =>
      request('/sessions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<CreateSessionRequest>): Promise<FocusSession> =>
      request(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string): Promise<void> =>
      request(`/sessions/${id}`, { method: 'DELETE' }),
    pause: (id: string): Promise<FocusSession> =>
      request(`/sessions/${id}/pause`, { method: 'POST' }),
    resume: (id: string): Promise<FocusSession> =>
      request(`/sessions/${id}/resume`, { method: 'POST' }),
    end: (id: string, body?: { shipped?: boolean; energyLevel?: number }): Promise<FocusSession> =>
      request(`/sessions/${id}/end`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
    status: (id: string): Promise<SessionStatus> =>
      request(`/sessions/${id}/status`),
  },

  stats: {
    get: (projectId?: string, from?: string, to?: string): Promise<Stats> => {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      if (from)      params.set('from',      from)
      if (to)        params.set('to',        to)
      const qs = params.toString()
      return request(`/stats${qs ? `?${qs}` : ''}`)
    },
    sites: (from?: string, to?: string, limit = 10): Promise<SiteStat[]> => {
      const params = new URLSearchParams({ limit: String(limit) })
      if (from) params.set('from', from)
      if (to)   params.set('to',   to)
      return request(`/stats/sites?${params.toString()}`)
    },
    apps: (from?: string, to?: string, limit = 10): Promise<AppStat[]> => {
      const params = new URLSearchParams({ limit: String(limit) })
      if (from) params.set('from', from)
      if (to)   params.set('to',   to)
      return request(`/stats/apps?${params.toString()}`)
    },
    streak: (): Promise<StreakInfo> =>
      request('/stats/streak'),
  },

  insights: {
    get: (from?: string, to?: string): Promise<Insights> => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to)   params.set('to',   to)
      const qs = params.toString()
      return request(`/insights${qs ? `?${qs}` : ''}`)
    },
  },

  sites: {
    delete: (sessionId: string, domain: string): Promise<void> =>
      request(`/sessions/${sessionId}/sites/${encodeURIComponent(domain)}`, { method: 'DELETE' }),
  },

  apps: {
    delete: (sessionId: string, appName: string): Promise<void> =>
      request(`/sessions/${sessionId}/apps/${encodeURIComponent(appName)}`, { method: 'DELETE' }),
  },

  goals: {
    list: (): Promise<Goal[]> =>
      request('/goals'),
    create: (body: CreateGoalRequest): Promise<Goal> =>
      request('/goals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<CreateGoalRequest & { isActive: boolean }>): Promise<Goal> =>
      request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string): Promise<void> =>
      request(`/goals/${id}`, { method: 'DELETE' }),
  },

  // CSV export — triggers a file download rather than returning JSON
  csv: {
    sessions: async (from?: string, to?: string, projectId?: string): Promise<void> => {
      const token = _getAccessToken ? await _getAccessToken() : null
      const params = new URLSearchParams()
      if (from)      params.set('from',      from)
      if (to)        params.set('to',        to)
      if (projectId) params.set('projectId', projectId)
      const qs = params.toString()

      const res = await fetch(`${BASE}/export/sessions${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `momentum-sessions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
  },

  tags: {
    list: (): Promise<{ id: string; name: string; sessionCount: number }[]> =>
      request('/tags'),
    rename: (id: string, name: string): Promise<{ id: string; name: string }> =>
      request(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    delete: (id: string): Promise<void> =>
      request(`/tags/${id}`, { method: 'DELETE' }),
  },
}