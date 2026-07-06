import type { ReactNode } from 'react'
import { BoltIcon } from '../../components/Icons'
import { Footer } from '../../components/Footer'

interface Props {
  title: string
  updated: string
  children: ReactNode
}

export function LegalLayout({ title, updated, children }: Props) {
  return (
    <div className="legal-page">
      <header className="landing-header">
        <a className="logo" href="/"><BoltIcon size={20} /> Momentum</a>
        <nav className="legal-nav">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/cookies">Cookies</a>
        </nav>
      </header>

      <main className="legal-content">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        {children}
      </main>

      <Footer />
    </div>
  )
}
