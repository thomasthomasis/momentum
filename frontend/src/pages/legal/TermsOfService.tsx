import { LegalLayout } from './LegalLayout'

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" updated="July 6, 2026">
      <p>
        These terms govern your use of Momentum's web app, Chrome extension, and desktop tray agent
        (together, the "Service"). By creating an account or using the Service, you agree to them.
      </p>

      <h2>1. The Service</h2>
      <p>
        Momentum is a focus and productivity tracker made up of three parts that work together: a
        web dashboard, a Chrome extension, and a desktop tray application. It's provided as-is, and
        is currently offered free of charge with no paid tiers.
      </p>

      <h2>2. Eligibility and Accounts</h2>
      <p>
        You must be at least 16 years old (or the age of legal majority where you live, if higher) to
        use the Service. You're responsible for keeping your password secure and for all activity
        under your account. Provide accurate information when registering.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for anything illegal, or to violate anyone else's rights or privacy.</li>
        <li>Attempt to disrupt, overload, or gain unauthorized access to the Service or its
          infrastructure.</li>
        <li>Use automated means to abuse the Service beyond normal personal use (e.g. mass account
          creation, scraping).</li>
      </ul>

      <h2>4. Your Content</h2>
      <p>
        You own the projects, sessions, notes, and other content you create in Momentum. We claim no
        ownership over it — we store and process it only to provide the Service to you. If you delete
        your account, this content is permanently deleted (see the <a href="/privacy">Privacy
        Policy</a> for details).
      </p>

      <h2>5. Availability and Changes</h2>
      <p>
        This is an actively developed, early-stage project. We don't guarantee uninterrupted
        availability, and features may change, be added, or be removed as the Service evolves. We'll
        try to avoid breaking changes that affect your existing data, but the Service is provided
        without uptime guarantees.
      </p>

      <h2>6. Third-Party Platforms</h2>
      <p>
        The Chrome extension and desktop agent interact with your browser and operating system. We
        aren't responsible for the behavior of Chrome, your OS, or any other third-party platform the
        Service happens to run on top of.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate accounts that violate these terms, or that we reasonably believe pose a security
        risk to the Service or other users.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        The Service is provided "as is" and "as available," without warranties of any kind, express
        or implied, including fitness for a particular purpose. Your productivity data is provided
        for your own informational use — we make no guarantee of its accuracy for any particular
        purpose.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, Momentum will not be liable for any indirect,
        incidental, or consequential damages arising from your use of, or inability to use, the
        Service.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these terms as the Service evolves. If we make material changes, we'll update
        the date above. Continuing to use the Service after a change means you accept the updated
        terms.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These terms are governed by the laws of the Province of Ontario and the federal laws of
        Canada applicable therein, without regard to conflict-of-law principles.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: <a href="mailto:thomas.i.sloane@gmail.com">thomas.i.sloane@gmail.com</a></p>
    </LegalLayout>
  )
}
