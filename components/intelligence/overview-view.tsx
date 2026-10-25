import Link from "next/link"
import type {
  IntelligenceOverview,
  IntelligenceSection,
  PendingApplicationMetricKey,
} from "@/lib/intelligence/overview"
import { metricStateLabel } from "@/lib/intelligence/overview"
import type { NumberMetric } from "@/lib/intelligence/metric-trust"

/**
 * Application Intelligence Overview presentation (Phase 1). Pure render of the
 * trusted view model from `lib/intelligence/overview.ts` — no fetches, no
 * client state, nothing invented. Availability badges distinguish a real
 * measured zero from a failed read and from a not-yet-instrumented capability.
 */

const DEPLOYMENT_BADGE: Record<IntelligenceOverview["deployment"]["state"], { label: string; className: string }> = {
  live: { label: "Live deployment", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  never_deployed: { label: "Not deployed yet", className: "bg-muted text-muted-foreground" },
  deploy_failed: { label: "Last deployment failed", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  deploy_in_progress: { label: "Deployment in progress", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
}

const SECTION_BADGE: Record<IntelligenceSection["status"], { label: string; className: string }> = {
  live: { label: "Available now", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  partial: { label: "Partially available", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  pending_ingestion: { label: "Needs instrumentation", className: "bg-muted text-muted-foreground" },
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

function MetricCard({ metric, label }: { metric: NumberMetric; label: string }) {
  const showValue = metric.state === "available" || metric.state === "measured_zero"
  const display = showValue
    ? metric.value !== null && metric.value >= 0 && metric.value < 1 && metric.definition.toLowerCase().startsWith("share of")
      ? `${(metric.value * 100).toFixed(1)}%`
      : (metric.value ?? 0).toLocaleString()
    : "—"
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <MetricBadge state={metric.state} />
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{display}</p>
      <p className="text-sm leading-6 text-foreground/80">{metric.definition}</p>
      {metric.reason ? <p className="text-xs leading-5 text-muted-foreground">{metric.reason}</p> : null}
      <p className="text-xs italic leading-5 text-muted-foreground">{metric.caveat}</p>
    </div>
  )
}


const PENDING_LABELS: Record<PendingApplicationMetricKey, string> = {
  appEvents: "App events",
  activeUsers: "Active users",
  journeys: "User journeys",
  retention: "Retention",
  appErrors: "In-app errors",
  appPerformance: "App performance",
  customerFeedback: "Customer feedback",
  recommendations: "AI recommendations",
  experiments: "Impact measurement",
}

export function IntelligenceOverviewView({ overview }: { overview: IntelligenceOverview }) {
  const deployment = DEPLOYMENT_BADGE[overview.deployment.state]
  const windowDays = Math.round((overview.window.to - overview.window.from) / (24 * 60 * 60 * 1000))

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Application intelligence</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">What Atai knows about {overview.projectName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Measured over the last {windowDays} days · generated {new Date(overview.generatedAt).toLocaleString()}
          </p>
        </div>
        <span className={`self-start rounded-full px-3 py-1 text-xs font-medium ${deployment.className}`}>{deployment.label}</span>
      </div>

      {/* Measured today */}
      <h2 className="pb-3 pt-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Measured right now — runtime-call health
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard metric={overview.runtime.requests} label="Runtime calls" />
        <MetricCard metric={overview.runtime.failures} label="Failed runtime calls" />
        <MetricCard
          metric={overview.runtime.successRate}
          label="Success rate"
        />
        <MetricCard metric={overview.runtime.latencyP50} label="Runtime p50 latency" />
        <MetricCard metric={overview.runtime.latencyP95} label="Runtime p95 latency" />
      </div>

      {/* Pending */}
      <h2 className="pb-3 pt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Application behavior — waiting on instrumentation
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(PENDING_LABELS) as PendingApplicationMetricKey[]).map((key) => (
          <MetricCard key={key} metric={overview.pendingMetrics[key]} label={PENDING_LABELS[key]} />
        ))}
      </div>

      {/* Sections IA */}
      <h2 className="pb-3 pt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sections</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overview.sections
          .filter((s) => s.id !== "overview")
          .map((section) => {
            const badge = SECTION_BADGE[section.status]
            return (
              <div key={section.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{section.title}</p>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.label}</span>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{section.description}</p>
              </div>
            )
          })}
      </div>

      {/* Plan + next steps */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Application plan</p>
          {overview.plan.hasSpecification && overview.plan.health ? (
            <p className="mt-2 text-sm leading-6">
              Plan is <span className="font-semibold">{overview.plan.health.percent}% complete</span> (
              {overview.plan.health.completeSections}/{overview.plan.health.totalSections} sections complete).
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">No application plan has been produced for this project yet.</p>
          )}
          <p className="mt-2 text-xs italic leading-5 text-muted-foreground">
            AI-written plan text is planning context — none of it has been executed.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Next steps</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6">
            {overview.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Trust notes */}
      <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">How to read this page</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5 text-muted-foreground">
          {overview.trustNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <Link href={`/project/${overview.projectId}/runtime`} className="text-sm text-primary hover:underline">
          View runtime request explorer →
        </Link>
      </div>
    </div>
  )
}
