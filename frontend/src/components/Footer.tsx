import { BoltIcon, GitHubIcon } from './Icons'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <span className="logo"><BoltIcon size={18} /> Momentum</span>
          <p>Know where your focus actually goes.</p>
        </div>

        <div className="site-footer-col">
          <h4>Product</h4>
          <a href="/">Dashboard</a>
          <a href="https://github.com/thomasthomasis/momentum" target="_blank" rel="noreferrer">
            <GitHubIcon size={13} /> Source on GitHub
          </a>
        </div>

        <div className="site-footer-col">
          <h4>Legal</h4>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/cookies">Cookie Notice</a>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span>&copy; {year} Momentum. All rights reserved.</span>
      </div>
    </footer>
  )
}
