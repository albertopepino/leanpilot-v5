import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - LeanPilot',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="space-y-3 text-gray-600 dark:text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 md:p-12">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">&larr; Back to Login</Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: April 2026</p>

        <nav className="mb-10 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contents</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-600 dark:text-blue-400">
            <li><a href="#service" className="hover:underline">Service Description</a></li>
            <li><a href="#accounts" className="hover:underline">User Accounts</a></li>
            <li><a href="#acceptable-use" className="hover:underline">Acceptable Use</a></li>
            <li><a href="#data-ownership" className="hover:underline">Data Ownership</a></li>
            <li><a href="#intellectual-property" className="hover:underline">Intellectual Property</a></li>
            <li><a href="#availability" className="hover:underline">Service Availability</a></li>
            <li><a href="#liability" className="hover:underline">Limitation of Liability</a></li>
            <li><a href="#indemnification" className="hover:underline">Indemnification</a></li>
            <li><a href="#termination" className="hover:underline">Termination</a></li>
            <li><a href="#governing-law" className="hover:underline">Governing Law</a></li>
            <li><a href="#changes" className="hover:underline">Changes to Terms</a></li>
            <li><a href="#contact" className="hover:underline">Contact</a></li>
          </ol>
        </nav>

        <Section id="service" title="1. Service Description">
          <p>
            LeanPilot is a business-to-business (B2B) web application operated by <strong>Centro Studi Grassi</strong>
            that provides lean manufacturing management tools including but not limited to: 5S/6S auditing, Kaizen boards,
            Gemba walks, OEE tracking, TPM/CILT management, quality inspections, safety incident reporting, SMED analysis,
            production dashboards, and related manufacturing intelligence features.
          </p>
          <p>
            The Service is provided on a subscription basis to organizations (&quot;Customers&quot;). Individual user accounts
            are created by Customer administrators within the platform.
          </p>
        </Section>

        <Section id="accounts" title="2. User Accounts">
          <p>
            Access to LeanPilot is by invitation only. User accounts are created by your organization&apos;s administrator.
            You are responsible for:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying your administrator immediately of any unauthorized use</li>
          </ul>
          <p>
            You must not share your credentials with others or use another person&apos;s account.
            Your organization&apos;s administrator may deactivate or modify your account at any time.
          </p>
        </Section>

        <Section id="acceptable-use" title="3. Acceptable Use">
          <p>You agree to use LeanPilot only for its intended purpose of lean manufacturing management. You must not:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure</li>
            <li>Use the Service to store or transmit malicious code, malware, or harmful content</li>
            <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
            <li>Use automated tools (bots, scrapers) to access the Service without prior written consent</li>
            <li>Interfere with or disrupt the integrity or performance of the Service</li>
            <li>Use the Service in violation of any applicable law or regulation</li>
            <li>Upload content that infringes on the intellectual property rights of others</li>
          </ul>
        </Section>

        <Section id="data-ownership" title="4. Data Ownership">
          <p>
            <strong>Your organization owns its data.</strong> All production data, quality records, safety reports,
            improvement ideas, and other content entered into LeanPilot by your organization&apos;s users remains
            the property of your organization.
          </p>
          <p>
            We do not claim any ownership rights over Customer data. We process your data solely to provide the
            Service as described in our <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>.
          </p>
          <p>
            Upon termination of the service agreement, you may request a full export of your data in a
            machine-readable format (JSON). We will provide this export within 30 days of the request.
            After the export period, data will be deleted in accordance with our retention policy.
          </p>
        </Section>

        <Section id="intellectual-property" title="5. Intellectual Property">
          <p>
            The LeanPilot platform, including its software, design, logos, and documentation, is the
            intellectual property of Centro Studi Grassi. Your subscription grants you a limited,
            non-exclusive, non-transferable license to use the Service for its intended purpose during
            the term of your subscription.
          </p>
        </Section>

        <Section id="availability" title="6. Service Availability">
          <p>
            We strive to maintain high availability of the Service but do not guarantee uninterrupted access.
            The Service may be temporarily unavailable due to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Scheduled maintenance (we will provide advance notice when possible)</li>
            <li>Emergency security patches or critical updates</li>
            <li>Infrastructure issues beyond our reasonable control</li>
          </ul>
          <p>
            We will make commercially reasonable efforts to minimize downtime and communicate
            any planned maintenance windows in advance.
          </p>
        </Section>

        <Section id="liability" title="7. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
              whether express or implied, including but not limited to implied warranties of merchantability
              and fitness for a particular purpose
            </li>
            <li>
              Centro Studi Grassi shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages, including but not limited to loss of profits, data, or business opportunity
            </li>
            <li>
              Our total aggregate liability for any claims arising from or related to the Service shall not
              exceed the amount paid by your organization for the Service in the 12 months preceding the claim
            </li>
          </ul>
          <p>
            Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence,
            fraud, or any liability that cannot be excluded under applicable law.
          </p>
        </Section>

        <Section id="indemnification" title="8. Indemnification">
          <p>
            You agree to indemnify and hold harmless Centro Studi Grassi from any claims, damages, or expenses
            arising from your violation of these Terms or misuse of the Service.
          </p>
        </Section>

        <Section id="termination" title="9. Termination">
          <p>
            <strong>By Customer:</strong> Your organization may terminate the service agreement at any time by
            providing written notice. Upon termination, you may request a data export as described in Section 4.
          </p>
          <p>
            <strong>By us:</strong> We may suspend or terminate access to the Service if:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Payment obligations are not met after reasonable notice</li>
            <li>These Terms are materially breached and the breach is not cured within 30 days of notice</li>
            <li>Continued provision of the Service would violate applicable law</li>
          </ul>
          <p>
            Upon termination, your right to use the Service ceases immediately. We will retain your data
            for 30 days to allow for export, after which it will be deleted in accordance with our
            retention policy.
          </p>
        </Section>

        <Section id="governing-law" title="10. Governing Law">
          <p>
            These Terms are governed by and construed in accordance with the laws of Italy.
            Any disputes arising from these Terms shall be subject to the exclusive jurisdiction
            of the courts of Italy, without prejudice to your right to bring proceedings in the
            courts of your country of residence as permitted by applicable consumer protection law.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to Terms">
          <p>
            We reserve the right to modify these Terms at any time. We will notify registered users
            of material changes via email at least 30 days before they take effect. Continued use of
            the Service after changes take effect constitutes acceptance of the modified Terms.
          </p>
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            For questions about these Terms, contact us at:
          </p>
          <p className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <strong>Centro Studi Grassi</strong><br />
            Email: <a href="mailto:info@leanpilot.me" className="text-blue-600 dark:text-blue-400 hover:underline">info@leanpilot.me</a><br />
            Privacy inquiries: <a href="mailto:privacy@leanpilot.me" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@leanpilot.me</a>
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <span>LeanPilot by Centro Studi Grassi</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline font-medium text-gray-600 dark:text-gray-300">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
