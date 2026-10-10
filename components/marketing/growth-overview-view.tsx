import Link from "next/link"
import type { GrowthOverview, NumberMetric } from "@/lib/marketing/growth-overview"

/**
 * Growth Overview presentation (Phase 2). Pure render of the trusted view
 * model produced by `lib/marketing/growth-overview.ts` — no fetches, no
 * client state, nothing invented. Every metric carries its availability
 * state; unavailable and uninstrumented measurements are visually distinct
 * from a real measured zero.
 */

const SITE_LABELS: Record<GrowthOverview["site"]["state"], string> = {
  live: "Live deployment",
  never_deployed: "Not deployed yet",
  deploy_failed: "Last deployment failed",
  deploy_in_progress: "Deployment in progress",
}

const STATE_BADGE: Record<GrowthOverview["site"]["state"], string> = {
  live: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  never_deployed: "bg-muted text-muted-foreground",
  deploy_failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  deploy_in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

function MetricBadge({ state }: { state: NumberMetric["state"] }) {
  if (state === "available") {
    return <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">measured</span>
  }
  if (state === "measured_zero") {
    return <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">measured · zero</span>
  }
  if (state === "unavailable") {
    return <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">data unavailable</span>
  }
  return <span className="rounded-full border border-dashed border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">not measured yet</span>
}

function MetricCard({ metric }: { metric: NumberMetric }) {
  const showValue = metric.state === "available" || metric.state === "measured_zero"
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{metric.source ?? "measurement"}</p>
        <MetricBadge state={metric.state} />
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">
        {showValue ? (metric.value ?? 0).toLocaleString() : "—"}
      </p>
      <p className="text-sm leading-6 text-foreground/80">{metric.definition}</p>
      {metric.reason ? <p className="text-xs leading-5 text-muted-foreground">{metric.reason}</p> : null}
      <p className="text-xs leading-5 text-muted-foreground italic">{metric.caveat}</p>
    </div>
  )
}

export function GrowthOverviewView({ overview }: { overview: GrowthOverview }) {
  const { metrics, whatAtaiKnows, site } = overview
  const windowDays = Math.round((overview.window.to - overview.window.from) / (24 * 60 * 60 * 1000))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Growth overview</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">How {overview.projectName} is doing</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Everything below is either a real measurement from Atai&apos;s data, something Atai genuinely knows about this
          business, or an AI-generated plan that has <span className="text-foreground">not been executed</span>. Nothing
          is estimated, simulated, or filled in with zeroes.
        </p>
      </header>

      {/* B1 — Project state */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Project state</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Lifecycle</p>
            <p className="mt-2 text-base font-medium">{overview.projectStateLabel}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Deployment</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_BADGE[site.state]}`}>{SITE_LABELS[site.state]}</span>
            </div>
            {site.url ? (
              <a href={site.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">
                {site.url}
              </a>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-muted-foreground italic">{site.caveat}</p>
          </div>
        </div>
      </section>

      {/* B2 — What Atai knows */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">What Atai knows about this business</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Application plan</p>
            {whatAtaiKnows.plan.health ? (
              <>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{whatAtaiKnows.plan.health.percent}% complete</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {whatAtaiKnows.plan.health.completeSections}/{whatAtaiKnows.plan.health.totalSections} sections filled.{" "}
                  {whatAtaiKnows.plan.health.missing.length > 0
                    ? `Missing: ${whatAtaiKnows.plan.health.missing.map((m) => m.label).join(", ")}.`
                    : "No missing sections."}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No application plan exists yet. Generate one from the workspace — this page gets much smarter once it does.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Who it is for</p>
            {whatAtaiKnows.plan.targetUsers.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm leading-6">
                {whatAtaiKnows.plan.targetUsers.slice(0, 5).map((u) => (
                  <li key={u}>· {u}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Target users have not been defined in the plan yet.</p>
            )}
            {whatAtaiKnows.ownerGoals ? (
              <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                From your onboarding — goal: {whatAtaiKnows.ownerGoals.businessGoal ?? "not set"} · revenue target:{" "}
                {whatAtaiKnows.ownerGoals.revenueTarget ?? "not set"}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* B3 — AI-generated plans (never executed) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Growth plans Atai has drafted</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          These documents were written by Atai&apos;s planner during analysis. They are <span className="text-foreground">planning
          context</span> — publishing, campaigns, and optimizations have not been run for you.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {whatAtaiKnows.aiPlanDocuments.map((doc) => (
            <div key={doc.id} className={`rounded-2xl border p-5 ${doc.present ? "border-border bg-card" : "border-dashed border-border bg-transparent"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{doc.label}</p>
                {doc.present ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    AI draft · not executed
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">not drafted</span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {doc.present ? `${doc.characterCount.toLocaleString()} characters in your plan.` : "The planner has not produced this yet."}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* B4 — Measurements */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Measurements</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">last {windowDays} days · real data only</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard metric={metrics.runtimeRequests} />
          <MetricCard metric={metrics.checkoutCalls} />
          <MetricCard metric={metrics.creditsConsumedByProject} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard metric={metrics.siteVisitors} />
          <MetricCard metric={metrics.completedPayments} />
          <MetricCard metric={metrics.appRevenue} />
          <MetricCard metric={metrics.conversionRate} />
          <MetricCard metric={metrics.ownerAccountReferrals} />
          <MetricCard metric={metrics.projectLevelReferrals} />
        </div>
        <ul className="rounded-2xl border border-border bg-muted/40 p-5 text-xs leading-6 text-muted-foreground">
          {overview.trustNotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </section>

      {/* B5 — Next steps */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Suggested next steps</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Derived by fixed rules from what Atai can currently observe. These are suggestions — nothing has been done for you.
        </p>
        {overview.nextSteps.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
            No urgent next steps from the signals available right now.
          </p>
        ) : (
          <div className="grid gap-3">
            {overview.nextSteps.map((step) => (
              <div key={step.id} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{step.detail}</p>
                {step.navigation ? (
                  <Link href={`/project/${step.navigation.projectId}/${step.navigation.target}`} className="mt-1 w-fit text-xs font-medium text-primary hover:underline">
                    Open {step.navigation.target} →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* B6 — provenance footer */}
      <footer className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
        Generated {new Date(overview.generatedAt).toISOString()} · Sources: project record, runtime usage, credit ledger
        (project references), referral registry (account level), stored application plan. This page never charges credits
        and never calls external providers.
      </footer>
    </div>
  )
}
