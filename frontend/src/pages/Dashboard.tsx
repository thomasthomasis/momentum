import { useEffect, useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '../api/client'
import type { Stats, FocusSession, SiteStat, AppStat, DashboardRange, Goal, Project, StreakInfo, Insights } from '../types'
import { StatsOverview } from '../components/dashboard/StatsOverview'
import { ProjectBreakdown } from '../components/dashboard/ProjectBreakdown'
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap'
import { EnergyTrend } from '../components/dashboard/EnergyTrend'
import { TopSites } from '../components/dashboard/TopSites'
import { TopApps } from '../components/dashboard/TopApps'
import StreakCard from '../components/dashboard/StreakCard'
import GoalsProgress from '../components/dashboard/GoalsProgress'
import InsightsPanel from '../components/dashboard/InsightsPanel'

export function Dashboard() {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [sessions, setSessions]   = useState<FocusSession[]>([])
  const [sites, setSites]         = useState<SiteStat[]>([])
  const [apps, setApps]           = useState<AppStat[]>([])
  const [goals, setGoals]         = useState<Goal[]>([])
  const [projects, setProjects]   = useState<Project[]>([])
  const [streak, setStreak]       = useState<StreakInfo | null>(null)
  const [insights, setInsights]   = useState<Insights | null>(null)
  const [range, setRange]         = useState<DashboardRange>('30d')
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState(false)

  const fromDate = useMemo(() => {
    if (range === 'all') return undefined
    const d = new Date()
    d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90))
    return d.toISOString()
  }, [range])

  const loadGoals = useCallback(async () => {
    setGoals(await api.goals.list())
  }, [])

  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      api.stats.get(undefined, fromDate),
      api.sessions.list({ limit: 100, from: fromDate }),
      api.stats.sites(fromDate, undefined, 20),
      api.stats.apps(fromDate, undefined, 20),
      api.goals.list(),
      api.projects.list(),
      api.stats.streak(),
      api.insights.get(fromDate),
    ])
      .then(([s, sessResult, siteStats, appStats, g, p, st, ins]) => {
        setStats(s)
        setSessions(sessResult.data)
        setSites(siteStats)
        setApps(appStats)
        setGoals(g)
        setProjects(p)
        setStreak(st)
        setInsights(ins)
      })
      .catch(e => {
        toast.error(e instanceof Error ? e.message : 'Failed to load dashboard')
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [fromDate])

  if (loading)   return <div className="dashboard-loading"><div className="spinner" /></div>
  if (loadError) return <div className="dashboard"><p className="text-muted">Could not load dashboard. Check connection and try again.</p></div>
  if (!stats)    return null

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            {stats.totalSessions === 0 ? 'No sessions yet.'
              : `${stats.totalSessions} session${stats.totalSessions !== 1 ? 's' : ''} tracked`}
          </p>
        </div>
        <select className="range-select" value={range}
          onChange={e => setRange(e.target.value as DashboardRange)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <StatsOverview stats={stats} />

      <div className="dashboard-two-col">
        {streak && <StreakCard streak={streak} />}
        <GoalsProgress goals={goals} projects={projects} onGoalsChanged={loadGoals} />
      </div>

      <ActivityHeatmap />

      {insights && <InsightsPanel insights={insights} />}

      <div className="dashboard-two-col">
        <ProjectBreakdown stats={stats} />
        <TopSites sites={sites} />
      </div>

      <TopApps apps={apps} />

      <EnergyTrend sessions={sessions} />
    </div>
  )
}