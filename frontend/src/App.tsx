import { useState } from 'react'
import type { ComponentType } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { BoltIcon, SunIcon, MoonIcon } from './components/Icons'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { setTokenGetter } from './api/client'
import { UserMenu } from './components/UserMenu'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import TermsOfService from './pages/legal/TermsOfService'
import CookieNotice from './pages/legal/CookieNotice'
import { Dashboard } from './pages/Dashboard'
import { Sessions } from './pages/Sessions'
import { Projects } from './pages/Projects'
import { WeekView } from './pages/WeekView'
import Tags from './pages/Tags'

type Tab = 'dashboard' | 'week' | 'sessions' | 'projects' | 'tags'
type AuthView = 'landing' | 'login' | 'register'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}

function AuthenticatedApp() {
  const { user, logout, getAccessToken } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')

  // Synchronous — ensures the token getter is set before any child useEffect fires
  setTokenGetter(getAccessToken)

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">
          <BoltIcon size={18} />
          Momentum
        </span>

        <nav className="app-nav">
          {(['dashboard', 'week', 'sessions', 'projects', 'tags'] as Tab[]).map(t => (
            <button
              key={t}
              className={`nav-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <ThemeToggle />
          {user && <UserMenu user={user} onLogout={logout} />}
        </div>
      </header>

      <div className="app-content">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'week'      && <WeekView />}
        {tab === 'sessions'  && <Sessions onLogSession={() => setTab('sessions')} />}
        {tab === 'projects'  && <Projects />}
        {tab === 'tags'      && <Tags />}
      </div>
    </div>
  )
}

function AuthGate() {
  const { user, isLoading } = useAuth()
  const [authView, setAuthView] = useState<AuthView>('landing')

  if (isLoading) {
    return (
      <div className="auth-loading">
        <BoltIcon size={36} />
      </div>
    )
  }

  if (user) return <AuthenticatedApp />

  if (authView === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setAuthView('register')}
        onSignIn={() => setAuthView('login')}
      />
    )
  }

  return authView === 'login'
    ? <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    : <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
}

// Legal pages are static, publicly viewable regardless of auth state, and
// need a real linkable URL (Chrome Web Store submission asks for a privacy
// policy URL, and a footer link should survive a page refresh). No router
// dependency for just three static pages — a plain pathname check is enough;
// see vercel.json for the SPA-fallback rewrite that makes direct navigation
// to these paths work in production.
const LEGAL_PAGES: Record<string, ComponentType> = {
  '/privacy': PrivacyPolicy,
  '/terms': TermsOfService,
  '/cookies': CookieNotice,
}

export default function App() {
  const LegalPage = LEGAL_PAGES[window.location.pathname]
  if (LegalPage) {
    return (
      <ThemeProvider>
        <LegalPage />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}