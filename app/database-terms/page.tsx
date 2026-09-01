import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Database Usage Terms & Policies — MirrorSite",
  description: "Learn about MirrorSite's managed database infrastructure plans, storage limits, and usage policies.",
}

export default function DatabaseTermsPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <Link href="/" className="font-mono text-sm text-primary hover:underline">
          ← MirrorSite.ai
        </Link>
        <p className="mt-20 font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Database Usage Terms & Policies
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Database & Infrastructure Terms
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Understanding how MirrorSite manages your application&apos;s database and infrastructure.
        </p>

        <div className="mt-12 space-y-10 text-base leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Managed Database</h2>
            <p>
              MirrorSite-managed applications use managed database and infrastructure services provided through
              our infrastructure partners. MirrorSite handles the setup, configuration, and maintenance of
              these services as part of your infrastructure plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Storage Limits</h2>
            <p>
              Each infrastructure plan provides an &quot;up to&quot; storage capacity. For example, a plan with
              &quot;up to 1 GB&quot; allows your application to use up to 1 GB of managed storage, subject to
              the plan&apos;s infrastructure allowance and applicable technical restrictions.
            </p>
            <p className="mt-3">
              Storage is measured across all database tables and files stored within your application&apos;s
              managed infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Infrastructure Usage</h2>
            <p>
              Database reads, writes, API requests, compute operations, and other infrastructure activities
              are included within your plan&apos;s monthly infrastructure allowance. You are not charged
              separately for individual database operations under normal plan usage.
            </p>
            <p className="mt-3">
              Infrastructure usage and storage are separate limits. Reaching one does not automatically mean
              you have reached the other.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Monthly Allowance</h2>
            <p>
              Infrastructure allowances are monthly and associated with the individual application/project.
              Each of your applications has its own independent infrastructure plan and allowance.
            </p>
            <p className="mt-3">
              Unused monthly allowances do not roll over to the next month and are not transferable between
              projects.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Usage Limits</h2>
            <p>
              MirrorSite may restrict infrastructure operations when a project reaches its plan&apos;s
              storage or infrastructure limits. When limits are reached:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-1">
              <li>New database writes may be restricted</li>
              <li>You will see a clear upgrade prompt in your project dashboard</li>
              <li>Existing data is preserved — no automatic deletion occurs</li>
              <li>Read access to existing data remains available</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Upgrades</h2>
            <p>
              You can upgrade your application&apos;s infrastructure plan at any time from the Database &amp;
              Infrastructure page. Upgrades take effect immediately and are charged at the plan&apos;s monthly
              rate using MirrorSite credits.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Expiration</h2>
            <p>
              Paid infrastructure plans expire according to their subscription period (monthly). When a plan
              expires:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-1">
              <li>The project is downgraded to the free Testing plan</li>
              <li>The infrastructure allowance is reduced accordingly</li>
              <li>Existing data is preserved</li>
              <li>New operations may be restricted if they exceed the lower plan&apos;s limits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Downgrades</h2>
            <p>
              If your application&apos;s existing storage exceeds the newly selected plan&apos;s limit, your
              data will not be automatically deleted. Instead, the system will:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-1">
              <li>Preserve all existing data</li>
              <li>Mark the project as over-quota</li>
              <li>Restrict new writes that would increase storage</li>
              <li>Show an upgrade message to resolve the situation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Excessive Usage &amp; Abuse</h2>
            <p>
              MirrorSite reserves the right to restrict abusive or automated usage that attempts to circumvent
              plan limits, rate limits, security controls, or fair-use policies. This includes but is not
              limited to:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-1">
              <li>Automated bulk data operations designed to exceed plan limits</li>
              <li>Circumventing infrastructure credit caps</li>
              <li>Using multiple accounts to avoid plan restrictions</li>
              <li>Any usage that violates the Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Data Retention</h2>
            <p>
              Your application data is retained as long as your project exists. If you delete a project,
              its associated database data may be permanently removed after a retention period. MirrorSite
              does not guarantee data retention beyond the active project lifecycle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Availability</h2>
            <p>
              Managed infrastructure depends on third-party infrastructure providers. MirrorSite cannot
              guarantee uninterrupted availability. We work to maintain high reliability, but service
              interruptions may occur due to factors outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Security</h2>
            <p>
              MirrorSite implements industry-standard security measures for managed infrastructure, including
              encrypted connections, access controls, and regular security monitoring. Users are responsible
              for keeping their application credentials secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. User Responsibility</h2>
            <p>
              You remain responsible for your application&apos;s content, credentials, data, compliance with
              applicable laws, and protecting sensitive information stored in your managed database.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Prohibited Usage</h2>
            <p>
              Infrastructure plans must not be used for illegal purposes, storing malicious content, or any
              activity that violates our Terms of Service. See our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              for full details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">15. Changes</h2>
            <p>
              MirrorSite may update infrastructure plans, limits, and policies subject to the Terms of
              Service and applicable notice requirements. Significant changes will be communicated through
              the platform.
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          <p>
            Last updated: September 2026. For questions about infrastructure plans, contact support.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
