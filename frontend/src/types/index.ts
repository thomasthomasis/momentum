export interface Project {
  id: string; name: string; description: string | null; color: string
  status: 'Active' | 'Archived'; createdAt: string; updatedAt: string
  sessionCount: number; totalHours: number
}

export interface BrowsedSiteDto {
  domain: string; timeSpentSeconds: number; visitCount: number; timeSpentMinutes: number
}

export interface AppUsageDto {
  appName: string; timeSpentSeconds: number; switchCount: number; timeSpentMinutes: number
}

export interface FocusSession {
  id: string; projectId: string; projectName: string; projectColor: string
  title: string; notes: string | null; energyLevel: number; shipped: boolean
  startedAt: string; endedAt: string | null; durationHours: number | null
  tags: string[]; browsedSites: BrowsedSiteDto[]; createdAt: string
  isPaused: boolean; pausedAt: string | null; totalPausedSeconds: number
  appUsages: AppUsageDto[]
}

export interface SessionStatus {
  id: string; isPaused: boolean; pausedAt: string | null
  totalPausedSeconds: number; startedAt: string; endedAt: string | null
}

export interface PagedResult<T> { data: T[]; nextCursor: string | null; count: number; hasMore: boolean }

export interface Stats {
  totalHours: number; totalSessions: number; averageEnergy: number
  shippedCount: number; byProject: ProjectStat[]
}

export interface ProjectStat {
  projectId: string; projectName: string; projectColor: string
  totalHours: number; sessionCount: number; averageEnergy: number
}

export interface SiteStat {
  domain: string; timeSpentSeconds: number; visitCount: number; sessionCount: number
}

export interface AppStat {
  appName: string; timeSpentSeconds: number; switchCount: number; sessionCount: number
}

export interface CreateProjectRequest { name: string; description?: string; color?: string }

export interface CreateSessionRequest {
  projectId: string; title: string; notes?: string; energyLevel: number
  shipped: boolean; startedAt: string; endedAt?: string; tags?: string[]
}

export interface SessionFilters {
  projectId?: string; from?: string; to?: string; minEnergy?: number
  shippedOnly?: boolean; afterCursor?: string; limit?: number
}

export type DashboardRange = '7d' | '30d' | '90d' | 'all'

export interface Goal {
  id: string; projectId: string | null; projectName: string | null
  projectColor: string | null; label: string | null
  targetHoursPerWeek: number; actualHoursThisWeek: number
  progressPercent: number; isActive: boolean; createdAt: string
}

export interface CreateGoalRequest {
  projectId?: string; targetHoursPerWeek: number; label?: string
}

export interface StreakInfo {
  currentStreak: number; longestStreak: number; lastActiveDate: string | null
}

export interface HourStat {
  hour: number
  sessionCount: number
  totalHours: number
}

export interface DayStat {
  dayName: string
  dayOfWeek: number
  sessionCount: number
  totalHours: number
}

export interface TagStat {
  tag: string
  count: number
}

export interface Insights {
  peakHour: HourStat | null
  bestDay: DayStat | null
  avgSessionHours: number
  hourBreakdown: HourStat[]
  dayBreakdown: DayStat[]
  topTags: TagStat[]
  sessionsAnalysed: number
}