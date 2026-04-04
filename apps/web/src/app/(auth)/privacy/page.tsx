import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - LeanPilot',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="space-y-3 text-gray-600 dark:text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 md:p-12">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">&larr; Back to Login</Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: April 2026</p>

        <nav className="mb-10 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contents</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-600 dark:text-blue-400">
            <li><a href="#controller" className="hover:underline">Data Controller</a></li>
            <li><a href="#data-collected" className="hover:underline">Data We Collect</a></li>
            <li><a href="#legal-basis" className="hover:underline">Legal Basis for Processing</a></li>
            <li><a href="#purpose" className="hover:underline">Purpose of Processing</a></li>
            <li><a href="#storage" className="hover:underline">Where Data is Stored</a></li>
            <li><a href="#third-parties" className="hover:underline">Third Parties</a></li>
            <li><a href="#retention" className="hover:underline">Data Retention</a></li>
            <li><a href="#rights" className="hover:underline">Your Rights</a></li>
            <li><a href="#cookies" className="hover:underline">Cookies and Tracking</a></li>
            <li><a href="#children" className="hover:underline">Children</a></li>
            <li><a href="#changes" className="hover:underline">Changes to This Policy</a></li>
            <li><a href="#dpo" className="hover:underline">Data Protection Officer</a></li>
          </ol>
        </nav>

        <Section id="controller" title="1. Data Controller">
          <p>
            The data controller for LeanPilot is <strong>Centro Studi Grassi</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
            operating the LeanPilot manufacturing intelligence platform at <strong>leanpilot.me</strong>.
          </p>
          <p>Contact: <a href="mailto:privacy@leanpilot.me" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@leanpilot.me</a></p>
        </Section>

        <Section id="data-collected" title="2. Data We Collect">
          <p>We collect and process the following categories of personal data:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Account data:</strong> first name, last name, email address, hashed password, role within your organization</li>
            <li><strong>Production data:</strong> production runs, workstation events, shift records, OEE metrics attributed to operator accounts</li>
            <li><strong>Quality records:</strong> inspection results, non-conformance reports, corrective actions attributed to inspectors and reporters</li>
            <li><strong>Safety data:</strong> safety incident reports (reporter name, incident details, injury information if applicable)</li>
            <li><strong>Continuous improvement data:</strong> Kaizen ideas, Gemba walk observations, 5S audit scores, A3 reports, SMED analyses</li>
            <li><strong>Maintenance data:</strong> CILT checks, maintenance logs attributed to operators and technicians</li>
            <li><strong>Audit logs:</strong> system activity logs including user ID, action performed, timestamp, and IP address</li>
          </ul>
          <p>
            We do <strong>not</strong> collect sensitive personal data (health data, biometric data, political opinions, etc.)
            beyond what is strictly necessary for safety incident reporting as required by occupational health and safety regulations.
          </p>
        </Section>

        <Section id="legal-basis" title="3. Legal Basis for Processing">
          <p>We process personal data under the following legal bases as defined by GDPR Article 6:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Contract performance (Art. 6(1)(b)):</strong> processing necessary to provide the LeanPilot service as agreed with your employer/organization</li>
            <li><strong>Legal obligation (Art. 6(1)(c)):</strong> retention of quality records (ISO 9001:2015), safety incident records (ISO 45001:2018), and audit trails as required by applicable regulations</li>
            <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> security logging, fraud prevention, and service improvement. We have conducted a balancing test and determined these interests do not override your fundamental rights</li>
          </ul>
        </Section>

        <Section id="purpose" title="4. Purpose of Processing">
          <p>Your data is processed exclusively for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Providing and operating the LeanPilot platform for your organization</li>
            <li>Authentication and access control</li>
            <li>Lean manufacturing workflow management (5S, Kaizen, Gemba, OEE, TPM, SMED, quality, safety)</li>
            <li>Generating reports and dashboards for your organization</li>
            <li>Maintaining audit trails for ISO 9001 and ISO 45001 compliance</li>
            <li>Ensuring platform security and preventing unauthorized access</li>
          </ul>
          <p>We do <strong>not</strong> use your data for profiling, automated decision-making, advertising, or any purpose other than operating the platform for your organization.</p>
        </Section>

        <Section id="storage" title="5. Where Data is Stored">
          <p>
            All data is stored on servers operated by <strong>Hetzner Online GmbH</strong> in <strong>Germany (EU)</strong>.
            Data never leaves the European Economic Area (EEA). Hetzner is ISO 27001 certified and operates
            under strict German and EU data protection laws.
          </p>
          <p>
            Database backups are stored on the same Hetzner infrastructure within the EU.
            All data is encrypted in transit (TLS 1.2+) and at rest.
          </p>
        </Section>

        <Section id="third-parties" title="6. Third Parties">
          <p>We share data with the following third-party processors, all operating within the EU:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Hetzner Online GmbH</strong> (Germany) — server hosting and infrastructure</li>
            <li><strong>SMTP email provider</strong> — transactional emails only (password resets, notifications). Only email addresses are shared</li>
          </ul>
          <p>
            We have Data Processing Agreements (DPAs) in place with all sub-processors in accordance with GDPR Article 28.
            We do <strong>not</strong> sell, rent, or share your data with any other third party.
          </p>
        </Section>

        <Section id="retention" title="7. Data Retention">
          <p>We retain data according to the following schedule:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Active accounts:</strong> data is retained for the lifetime of the service agreement with your organization</li>
            <li><strong>Audit logs:</strong> retained for a minimum of 2 years from creation, then automatically deleted (ISO 9001 requirement)</li>
            <li><strong>Deactivated/deleted accounts:</strong> personal data is anonymized immediately upon GDPR deletion request. Anonymized records are hard-deleted after 30 days</li>
            <li><strong>Database backups:</strong> retained for 30 days, then automatically overwritten</li>
            <li><strong>Quality and safety records:</strong> retained for the lifetime of the service for regulatory compliance (ISO 9001, ISO 45001). Upon account deletion, these records are anonymized but preserved</li>
          </ul>
        </Section>

        <Section id="rights" title="8. Your Rights">
          <p>Under GDPR, you have the following rights regarding your personal data:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Right of access (Art. 15):</strong> request a copy of all personal data we hold about you. You can export your data directly from the platform</li>
            <li><strong>Right to rectification (Art. 16):</strong> request correction of inaccurate personal data</li>
            <li><strong>Right to erasure (Art. 17):</strong> request deletion of your personal data, subject to legal retention obligations</li>
            <li><strong>Right to data portability (Art. 20):</strong> receive your data in a structured, machine-readable format (JSON)</li>
            <li><strong>Right to object (Art. 21):</strong> object to processing based on legitimate interest</li>
            <li><strong>Right to restriction (Art. 18):</strong> request restriction of processing in certain circumstances</li>
            <li><strong>Right to lodge a complaint:</strong> you may file a complaint with your national data protection authority</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@leanpilot.me" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@leanpilot.me</a>.
            We will respond within 30 days as required by GDPR.
          </p>
        </Section>

        <Section id="cookies" title="9. Cookies and Tracking">
          <p>
            LeanPilot does <strong>not</strong> use cookies for tracking or analytics. We do <strong>not</strong> use
            any third-party analytics services (no Google Analytics, no tracking pixels, no fingerprinting).
          </p>
          <p>
            The only client-side storage used is a JWT authentication token stored in browser memory for session management.
            This is strictly necessary for the functioning of the service and does not require consent under the ePrivacy Directive.
          </p>
        </Section>

        <Section id="children" title="10. Children">
          <p>
            LeanPilot is a B2B service designed for manufacturing professionals. We do not knowingly collect
            personal data from anyone under the age of 16. If you believe a child has provided us with personal
            data, please contact us immediately.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify registered users of material
            changes via email. The &quot;Last updated&quot; date at the top of this policy indicates when it was last revised.
          </p>
        </Section>

        <Section id="dpo" title="12. Data Protection Officer">
          <p>
            Our Data Protection Officer can be contacted at:
          </p>
          <p className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <strong>Data Protection Officer</strong><br />
            Centro Studi Grassi<br />
            Email: <a href="mailto:privacy@leanpilot.me" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@leanpilot.me</a>
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <span>LeanPilot by Centro Studi Grassi</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline font-medium text-gray-600 dark:text-gray-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
