import { LegalLayout } from './LegalLayout'

export default function CookieNotice() {
  return (
    <LegalLayout title="Cookie Notice" updated="July 6, 2026">
      <p>
        Short version: <strong>Momentum doesn't use tracking or advertising cookies.</strong> Here's
        exactly what we do use, since most cookie notices are copy-pasted and describe things a site
        doesn't actually do — we'd rather tell you what's really happening.
      </p>

      <h2>How We Keep You Signed In</h2>
      <p>
        Instead of a cookie, the web app stores your session token in your browser's{' '}
        <strong>local storage</strong>. It's a similar idea — a small piece of data your browser
        holds onto — but technically distinct from a cookie, and it's never sent to any other site.
        The Chrome extension and desktop agent store their own copy in their own local storage
        areas, not shared with any third party.
      </p>

      <h2>Our Hosting Providers</h2>
      <p>
        Our infrastructure providers — Vercel (which serves the web app) and Amazon Web Services
        (which runs the backend) — may set minimal technical cookies or identifiers necessary to
        route requests and serve the site reliably. These are operational, not used to track you
        across other websites, and are outside our direct control.
      </p>

      <h2>No Analytics, No Advertising</h2>
      <p>
        We don't currently run any analytics, advertising, or third-party tracking scripts on the
        Service. If that ever changes, we'll update this notice — and where required by law, ask for
        your consent first.
      </p>

      <h2>Contact</h2>
      <p>Questions about this notice: <a href="mailto:thomas.i.sloane@gmail.com">thomas.i.sloane@gmail.com</a></p>
    </LegalLayout>
  )
}
