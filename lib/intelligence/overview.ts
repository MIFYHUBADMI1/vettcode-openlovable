import "server-only"

/**
 * Application Intelligence Overview — trusted view model (Phase 1).
 *
 * Builds an honest per-project snapshot from data the platform ALREADY holds
 * (`runtime_usage`, project deployment state, plan state). Every metric uses
 * the shared metric-trust vocabulary from `lib/intelligence/metric-trust.ts`.
 * Everything that requires the Phase 2 event-ingestion pipeline is explicitly
 * `not_instrumented` with the reason — never fabricated, never estimated.
 *
 * Ownership is the CALLER's responsibility (`requireOwnedProject` on the
 * page). No client-provided identifiers are trusted.
 *
 * Reuse note: deployment/plan project-state readers are imported from the
 * Marketing overview service — they are project-state projections, not
 * marketing features, and duplicating them would violate the no-duplicate-
 * implementations rule. Marketing & Monetization files are otherwise untouched.
 *
 * @module lib/intelligence/overview
 */

import { logger } from "@/lib/logging/logger"
import {
  failureRate,
  measured,
  notInstrumented,
  percentile,
  unavailable,
  type NumberMetric,
} from "@/lib/intelligence/metric-trust"
import {
  readSiteAvailability,
  readPlanKnowledge,
  type PlanKnowledge,
  type SiteAvailability,
} from "@/lib/marketing/growth-overview"
import { clampRange, summarizeProjectUsage } from "@/lib/runtime/control/analytics"
import { ensureRuntimeIndexes, runtimeUsageCol } from "@/lib/db/runtime-collections"
import type { MirrorProject } from "@/lib/types/project"
import type { UserDoc } from "@/lib/types/db"

// ─── Constants ───────────────────────────────────────────────────────────────

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30-day measurement window
/** Hard cap on documents used for latency percentiles — bounded query, never unbounded. */
const LATENCY_SAMPLE_LIMIT = 500

// ─── Section registry (information architecture, Phase 1) ───────────────────

/**
 * The Application Intelligence sections per the approved IA. `live` sections
 * render real content today; `pending_ingestion` sections are visible and
 * labeled because the capability depends on the event pipeline landing first.
 */
export type IntelligenceSectionId =
  | "overview"
  | "analytics"
  | "journeys"
  | "retention"
  | "health"
  | "insights"
  | "recommendations"
  | "experiments"
  | "instrumentation"

export interface IntelligenceSection {
  id: IntelligenceSectionId
  title: string
  description: string
  status: "live" | "partial" | "pending_ingestion"
}

export function intelligenceSections(): IntelligenceSection[] {
  return [
    {
      id: "overview",
      title: "Overview",
      description: "What Atai can measure about this application right now.",
      status: "live",
    },
    {
      id: "analytics",
      title: "Analytics",
      description: "Usage of your application's features, computed from events your app reports to Atai.",
      status: "pending_ingestion",
    },
    {
      id: "journeys",
      title: "User journeys",
      description: "How users move through key flows, and where they drop off.",
      status: "pending_ingestion",
    },
    {
      id: "retention",
      title: "Retention & churn",
      description: "Whether people come back, based on returning-activity cohorts.",
      status: "pending_ingestion",
    },
    {
      id: "health",
      title: "Application health",
      description: "Errors, latency and reliability. Runtime-call health is measured today; in-app errors need error reporting ingestion.",
      status: "partial",
    },
    {
      id: "insights",
      title: "Customer insights",
      description: "Behavioral patterns tied to customer feedback. Feedback from your app's customers is not collected yet.",
      status: "pending_ingestion",
    },
    {
      id: "recommendations",
      title: "AI recommendations",
      description: "Evidence-grounded suggestions, each with the data behind it, prioritized transparently.",
      status: "pending_ingestion",
    },
    {
      id: "experiments",
      title: "Experiments & impact",
      description: "Record a baseline, ship an improvement, and compare before/after honestly.",
      status: "pending_ingestion",
    },
    {
      id: "instrumentation",
      title: "Instrumentation & settings",
      description: "Connection status, event schema, privacy and retention controls.",
      status: "pending_ingestion",
    },
  ]
}

// ─── Runtime-call metrics (real data today) ────────────────────────────────

async function readRuntimeMetrics(projectId: string, window: { from: number; to: number }): Promise<{
  requests: NumberMetric
  failures: NumberMetric
  successRate: NumberMetric
  latencyP50: NumberMetric
  latencyP95: NumberMetric
}> {
  const base = {
    source: "runtime_usage",
    window,
  }
  try {
    await ensureRuntimeIndexes()
    const summary = await summarizeProjectUsage(projectId, window)

    // Bounded latency sample: recent events inside the window only.
    const col = await runtimeUsageCol()
    const sampleDocs = await col
      .find({ projectId, createdAt: { $gte: window.from, $lte: window.to } }, { projection: { latencyMs: 1 } })
      .sort({ createdAt: -1 })
      .limit(LATENCY_SAMPLE_LIMIT)
      .toArray()
    const latencies = sampleDocs
      .map((d) => d.latencyMs)
      .filter((ms): ms is number => typeof ms === "number" && Number.isFinite(ms))
      .sort((a, b) => a - b)

    const rate = failureRate(summary.failed, summary.requests)
    return {
      requests: measured(summary.requests, {
        ...base,
        definition: "API calls your generated app made through the Atai runtime in the last 30 days.",
        caveat: "Runtime calls are not visitors, page views, or in-app user actions.",
      }),
      failures: measured(summary.failed, {
        ...base,
        definition: "Runtime calls from your app that failed in the last 30 days.",
        caveat: "Covers Atai runtime capability calls only — in-app endpoint errors are not collected yet.",
      }),
      successRate: rate === null
        ? notInstrumented(
            "No runtime calls were recorded in this window, so there is no sample to compute a success rate from.",
            {
              definition: "Share of runtime calls that succeeded.",
              caveat: "An empty sample is not a 100% success rate.",
            },
          )
        : measured(roundRate(rate), {
            ...base,
            definition: "Share of runtime calls that succeeded in the last 30 days.",
            caveat: "Runtime calls only — not your app's own endpoints.",
          }),
      latencyP50: latencies.length > 0
        ? measured(Math.round(percentile(latencies, 50) ?? 0), {
            ...base,
            definition: `Median latency of runtime calls (sample of the last ${latencies.length} calls in this window).`,
            caveat: "Measures Atai runtime round-trips, not your app's own endpoints.",
          })
        : notInstrumented("No runtime calls in this window.", {
            definition: "Median latency of runtime calls.",
            caveat: "Needs a sample to be meaningful.",
          }),
      latencyP95: latencies.length > 0
        ? measured(Math.round(percentile(latencies, 95) ?? 0), {
            ...base,
            definition: "95th-percentile latency of runtime calls in this sample.",
            caveat: "Sample-based; tail percentiles need larger samples to be reliable.",
          })
        : notInstrumented("No runtime calls in this window.", {
            definition: "95th-percentile latency of runtime calls.",
            caveat: "Needs a sample to be meaningful.",
          }),
    }
  } catch (error) {
    const reason = "Runtime usage data could not be read right now."
    logger.warn("intelligence.overview", "runtime metrics read failed", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      requests: unavailable(reason, {
        ...base,
        definition: "API calls your generated app made through the Atai runtime.",
        caveat: "Runtime calls are not visitors or in-app user actions.",
      }),
      failures: unavailable(reason, {
        ...base,
        definition: "Runtime calls from your app that failed.",
        caveat: "Covers Atai runtime capability calls only.",
      }),
      successRate: unavailable(reason, {
        ...base,
        definition: "Share of runtime calls that succeeded.",
        caveat: "Runtime calls only.",
      }),
      latencyP50: unavailable(reason, {
        ...base,
        definition: "Median latency of runtime calls.",
        caveat: "Measures Atai runtime round-trips.",
      }),
      latencyP95: unavailable(reason, {
        ...base,
        definition: "95th-percentile latency of runtime calls.",
        caveat: "Measures Atai runtime round-trips.",
      }),
    }
  }
}

function roundRate(rate: number): number {
  return Math.round(rate * 1000) / 1000
}

// ─── View model ─────────────────────────────────────────────────────────────

export type PendingApplicationMetricKey =
  | "appEvents"
  | "activeUsers"
  | "journeys"
  | "retention"
  | "appErrors"
  | "appPerformance"
  | "customerFeedback"
  | "recommendations"
  | "experiments"

export interface IntelligenceOverview {
  projectId: string
  projectName: string
  projectState: string
  generatedAt: number
  window: { from: number; to: number }
  deployment: SiteAvailability
  plan: PlanKnowledge
  runtime: {
    requests: NumberMetric
    failures: NumberMetric
    successRate: NumberMetric
    latencyP50: NumberMetric
    latencyP95: NumberMetric
  }
  /** Application-behavior metrics — all honestly not instrumented until ingestion lands. */
  pendingMetrics: Record<PendingApplicationMetricKey, NumberMetric>
  sections: IntelligenceSection[]
  nextSteps: string[]
  trustNotes: string[]
}

export interface IntelligenceOverviewInput {
  /**
   * Server-resolved session user. Only `id` is used today (plan projections
   * are project-owned); onboarding context follows the marketing overview's
   * optional shape.
   */
  user: Pick<UserDoc, "id">
  /** Project already ownership-checked by the caller. */
  project: MirrorProject
}

const TRUST_NOTES = [
  "Runtime metrics are measured, real data — but they describe calls your app makes to the Atai runtime, not your users' activity inside the app.",
  "Application behavior (usage, journeys, retention, in-app errors, feedback) is not collected yet. Every one of those tiles will read a real zero once instrumentation is live — never an estimate.",
  "None of the numbers on this page are simulated, backfilled, or sampled from other projects.",
]

const STATE_LABELS: Record<string, string> = {
  available: "Measured",
  measured_zero: "Measured · zero",
  unavailable: "Data unavailable",
  not_instrumented: "Not measured yet",
}

/** Deterministic, state-derived guidance for the founder. */
function deriveNextSteps(deployment: SiteAvailability): string[] {
  const steps: string[] = []
  if (deployment.state === "never_deployed") {
    steps.push("Deploy your application — intelligence surfaces become meaningful once the app is live and calling the runtime.")
  } else if (deployment.state === "deploy_failed") {
    steps.push("Fix the failed deployment before interpreting any intelligence metrics — the sample window has no live traffic.")
  }
  steps.push("Instrumentation is the next capability landing in Application Intelligence: your app will report real events, and usage/journeys/retention become measured.")
  return steps.slice(0, 3)
}

export async function getIntelligenceOverview({ project }: IntelligenceOverviewInput): Promise<IntelligenceOverview> {
  const now = Date.now()
  const window = clampRange(now - WINDOW_MS, now)

  const deployment = readSiteAvailability(project)
  const plan = readPlanKnowledge(project)
  const runtime = await readRuntimeMetrics(project.id, window)

  const pendingMetrics: Record<PendingApplicationMetricKey, NumberMetric> = {
    appEvents: notInstrumented(
      "Atai does not collect events from your generated app yet. The event ingestion pipeline for Application Intelligence is the next phase of this capability.",
      { definition: "Events your application reports to Atai.", caveat: "Runtime calls are NOT app events." },
    ),
    activeUsers: notInstrumented(
      "Active users need in-app activity events, which do not exist yet. No estimate is shown.",
      { definition: "People who actively used your app.", caveat: "Declined visitors and runtime calls both are not active users." },
    ),
    journeys: notInstrumented("Journeys are derived from in-app event sequences — no events yet.", {
      definition: "Paths users take through your app.",
      caveat: "Will require instrumented events first.",
    }),
    retention: notInstrumented("Retention cohorts need returning-activity events.", {
      definition: "Share of users who come back after first use.",
      caveat: "Activity-based — distinct from subscription churn.",
    }),
    appErrors: notInstrumented(
      "In-app errors are not reported to Atai yet. Runtime-call failures (measured above) cover runtime capability calls only.",
      { definition: "Errors raised inside your app.", caveat: "Runtime failures ≠ app endpoint failures." },
    ),
    appPerformance: notInstrumented(
      "Your app's own endpoint latency and web vitals are not instrumented; only runtime-call latency is measured today.",
      { definition: "Latency of your app's own routes.", caveat: "Runtime latency ≠ app latency." },
    ),
    customerFeedback: notInstrumented(
      "Feedback submitted inside your app is not collected. Atai's feature-request board covers Atai itself, not your app's customers.",
      { definition: "What your app's customers ask for.", caveat: "No fabricated quotes or sentiment." },
    ),
    recommendations: notInstrumented(
      "AI recommendations will generate only from measured evidence once ingestion is live — never from assumptions.",
      { definition: "Evidence-grounded improvement suggestions.", caveat: "No recommendations without data." },
    ),
    experiments: notInstrumented(
      "Impact measurement requires recorded baselines, which require events to measure.",
      { definition: "Before/after comparison of a shipped change.", caveat: "Before-and-after ≠ proof of causation." },
    ),
  }

  return {
    projectId: project.id,
    projectName: project.name,
    projectState: project.state,
    generatedAt: now,
    window,
    deployment,
    plan,
    runtime,
    pendingMetrics,
    sections: intelligenceSections(),
    nextSteps: deriveNextSteps(deployment),
    trustNotes: TRUST_NOTES,
  }
}

/** Label helper shared by the overview UI. */
export function metricStateLabel(state: NumberMetric["state"]): string {
  return STATE_LABELS[state] ?? state
}
