import {
  BoltIcon, BarChartIcon, BrowserIcon, MonitorIcon,
  DownloadIcon, ArrowRightIcon, CheckIcon,
} from '../components/Icons'

interface Props {
  onGetStarted: () => void
  onSignIn: () => void
}

export default function LandingPage({ onGetStarted, onSignIn }: Props) {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <span className="logo"><BoltIcon size={20} /> Momentum</span>
        <div className="landing-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={onSignIn}>Sign in</button>
          <button className="btn btn-primary btn-sm" onClick={onGetStarted}>Get started</button>
        </div>
      </header>

      <section className="landing-hero">
        <h1>Know where your focus actually goes.</h1>
        <p className="landing-hero-sub">
          Momentum tracks your focus sessions across your desktop and browser automatically,
          so your dashboard reflects real work — not guesses.
        </p>
        <div className="landing-hero-actions">
          <button className="btn btn-primary" onClick={onGetStarted}>
            Get started free <ArrowRightIcon />
          </button>
          <button className="btn btn-ghost" onClick={onSignIn}>Sign in</button>
        </div>
      </section>

      <section className="landing-pillars">
        <div className="landing-pillar">
          <div className="landing-pillar-icon"><BarChartIcon size={22} /></div>
          <h3>Web Dashboard</h3>
          <p>Streaks, goals, activity heatmaps, and insights — all in one place, in light or dark mode.</p>
        </div>

        <div className="landing-pillar">
          <div className="landing-pillar-icon"><BrowserIcon size={22} /></div>
          <h3>Chrome Extension</h3>
          <p>Start, pause, and stop sessions from your toolbar, with automatic site-tracking while you work.</p>
          <span className="landing-badge landing-badge-soon">Coming soon to the Chrome Web Store</span>
        </div>

        <div className="landing-pillar">
          <div className="landing-pillar-icon"><MonitorIcon size={22} /></div>
          <h3>Desktop Agent</h3>
          <p>Runs quietly in your system tray, tracking app usage and auto-pausing the moment you step away.</p>
          <a
            className="btn btn-primary btn-sm"
            href="https://momentum-agent-downloads-850919910323.s3.amazonaws.com/downloads/MomentumAgent.exe"
            download
          >
            <DownloadIcon /> Download for Windows
          </a>
        </div>
      </section>

      <section className="landing-how">
        <h2>How it fits together</h2>
        <ul className="landing-steps">
          <li><CheckIcon /> Sign in once — the same account works everywhere.</li>
          <li><CheckIcon /> Start a session from the extension, the desktop agent, or log one manually on the web.</li>
          <li><CheckIcon /> Everything stays in sync — pause on your desktop, and the extension picks it up automatically.</li>
        </ul>
      </section>

      <footer className="landing-footer">
        Momentum — built for people who want to know where their time really goes.
      </footer>
    </div>
  )
}
