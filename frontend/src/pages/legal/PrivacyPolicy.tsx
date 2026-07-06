import { LegalLayout } from './LegalLayout'

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 6, 2026">
      <p>
        This policy describes what information Momentum ("we," "our") collects when you use the
        Momentum web app, Chrome extension, and desktop tray agent (together, the "Service"), and
        how we use it. It's meant to describe what the Service actually does, not generic boilerplate —
        if something here seems wrong, please <a href="mailto:thomas.i.sloane@gmail.com">tell us</a>.
      </p>

      <h2>Information We Collect</h2>
      <p><strong>Account information.</strong> Your email address, display name, and password
        (we never store your password itself — only a one-way cryptographic hash of it).</p>
      <p><strong>Content you create.</strong> Projects, focus sessions (titles, notes, energy
        ratings, tags), and goals that you enter directly.</p>
      <p><strong>Browsing activity, via the Chrome extension.</strong> While a focus session is
        active, the extension records the <strong>domain</strong> of sites you visit (e.g.
        "github.com" — not full URLs, page content, or browsing outside an active session) and how
        long you spend on each.</p>
      <p><strong>Application usage, via the desktop agent.</strong> While a focus session is
        active, the desktop agent records the <strong>names of applications</strong> you use (e.g.
        "Code.exe") and how long each is in focus. It does not read file contents, keystrokes, or
        anything inside those applications.</p>
      <p><strong>Technical data.</strong> Our hosting providers (Amazon Web Services, Vercel)
        generate standard server logs (IP address, timestamps, request metadata) as a normal part of
        operating the Service.</p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To operate the Service — authenticate you, sync data between the web app, extension,
          and desktop agent, and keep your session state consistent across all three.</li>
        <li>To show you your own dashboard, stats, streaks, and insights — this is the entire point
          of the product, and none of this data is used for anything beyond generating that for you.</li>
        <li>To maintain security — detecting suspicious login activity, enforcing rate limits.</li>
      </ul>
      <p>We do not use your data for advertising, and we do not sell it to anyone.</p>

      <h2>How We Share Information</h2>
      <p>
        We use third-party infrastructure providers to run the Service: <strong>Amazon Web
        Services</strong> (database and backend hosting) and <strong>Vercel</strong> (web app
        hosting). These providers process data on our behalf under their own security and privacy
        commitments — they don't use your data for their own purposes. We don't share your data with
        any other third party, and we don't sell it.
      </p>

      <h2>Data Retention and Deletion</h2>
      <p>
        We keep your data for as long as your account is active. You can delete your account at any
        time from Account Settings — this <strong>permanently and immediately</strong> deletes your
        account and all associated data (projects, sessions, goals, browsing/app-usage records).
        This cannot be undone.
      </p>

      <h2>Your Rights</h2>
      <p>You can, at any time and without contacting us:</p>
      <ul>
        <li><strong>Access</strong> your data through the dashboard, or export your session history
          as a CSV file.</li>
        <li><strong>Correct</strong> your display name from Account Settings.</li>
        <li><strong>Delete</strong> your account and all associated data from Account Settings.</li>
      </ul>
      <p>
        If you're in a jurisdiction with additional statutory rights (for example under PIPEDA in
        Canada, or GDPR in the EU/UK) and want to exercise them directly with us, contact us at the
        address below.
      </p>

      <h2>Security</h2>
      <p>
        Passwords and refresh tokens are stored as cryptographic hashes, not plaintext. We use
        industry-standard practices (encrypted connections, access-controlled infrastructure) to
        protect your data. No method of storage or transmission is 100% secure, and we can't
        guarantee absolute security.
      </p>

      <h2>International Data Transfers</h2>
      <p>
        Our servers are located in the United States (AWS, us-east-1). If you're accessing the
        Service from Canada or elsewhere, your information will be transferred to and processed in
        the United States, which may have different data protection laws than your own country.
      </p>

      <h2>Children's Privacy</h2>
      <p>
        The Service is not directed at children under 16, and we do not knowingly collect
        information from anyone under 16. If you believe a child has provided us information,
        contact us and we'll delete it.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        If we make material changes, we'll update the date at the top of this page. Continued use of
        the Service after a change means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: <a href="mailto:thomas.i.sloane@gmail.com">thomas.i.sloane@gmail.com</a></p>
    </LegalLayout>
  )
}
