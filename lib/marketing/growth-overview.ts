import "server-only"

/**
 * Growth Overview data service (Phase 2 — "Secure Foundations, Project Growth
 * Workspace & Growth Overview").
 *
 * This module assembles a typed, TRUSTED view of everything the platform can
 * honestly say about one project's growth situation. Hard rules it enforces
 * (spec sections 5–8):
 *
 *  - It reads ONLY existing, already-collected data (projects, runtime_usage,
 *    credit_ledger project attribution, referrals, the AI-generated plan in
 *    the specification, onboarding goals). No new collections, no external
 *    providers, no credit charges for reading.
 *  - Every metric carries an explicit availability state. A real measured
 *    zero (`measured_zero`) is a DIFFERENT state from a failed read
 *    (`unavailable`) and from a capability the platform does not have at all
 *    (`not_instrumented`). The UI must never render a row of zeroes for a
 *    missing data source.
 *  - Metric definitions carry caveats so the surface can never conflate:
 *    checkout creation ≠ completed payment; runtime requests ≠ visitors;
 *    credit consumption ≠ revenue; Atai platform revenue ≠ generated-app
 *    revenue; owner-level referrals ≠ project-level referrals; deployment
 *    success ≠ customer acquisition; AI plan text ≠ executed activity.
 *  - Ownership is the CALLER's responsibility (requireOwnedProject on pages,
 *  checkProjectOwnership on APIs, ToolContext.user on agent tools). This
 *  service never trusts a client-provided userId; it only ever receives
 *  server-resolved identities.
 */

import { computePlanHealth, isPlaceholderValue, type PlanSectionId } from "@/lib/analysis/plan-sections"
import { creditLedgerCol, referralsCol } from "@/lib/db/collections"
import { ensureRuntimeIndexes, runtimeUsageCol } from "@/lib/db/runtime-collections"
import { logger } from "@/lib/logging/logger"
import { clampRange, summarizeProjectUsage } from "@/lib/runtime/control/analytics"
import { STATE_LABELS, type MirrorProject } from "@/lib/types/project"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { UserDoc } from "@/lib/types/db"

// ─── Metric trust model ─────────────────────────────────────────────────────

export type MetricState =
  /** Source read succeeded and produced a non-zero measurement. */
  | "available"
  /** Source read succeeded and genuinely measured zero (a real, trustworthy 0). */
  | "measured_zero"
  /** Source exists but this read failed (error / timeout). Never shown as 0. */
  | "unavailable"
  /** The platform does not collect this data at all yet. Never fabricated. */
  | "not_instrumented"

export interface NumberMetric {
  state: MetricState
  /** Numeric value when the read succeeded; null otherwise. */
  value: number | null
  /** Honest one-line definition of what the number measures. */
  definition: string
  /** What the number must NOT be interpreted as (spec section 6 distinctions). */
  caveat: string
  /** Explanation when state is unavailable / not_instrumented. */
  reason?: string
  /** Measurement window for time-boxed metrics. */
  window?: { from: number; to: number }
  /** Data source identifier for transparency / debugging. */
  source?: string
}

function measured(value: number, def: Pick<NumberMetric, "definition" | "caveat" | "source"> & { window?: { from: number; to: number } }): NumberMetric {
  return {
    state: value === 0 ? "measured_zero" : "available",
    value,
    definition: def.definition,
    caveat: def.caveat,
    source: def.source,
    ...(def.window ? { window: def.window } : {}),
  }
}

function unavailable(reason: string, def: Pick<NumberMetric, "definition" | "caveat" | "source">): NumberMetric {
  return { state: "unavailable", value: null, reason, ...def }
}

function notInstrumented(reason: string, def: Pick<NumberMetric, "definition" | "caveat">): NumberMetric {
  return { state: "not_instrumented", value: null, reason, ...def }
}

// ─── View model ─────────────────────────────────────────────────────────────

export interface SiteAvailability {
  /**
   * Deployment state ONLY. `live` means the platform has a recorded
   * successful deployment with a URL — it says nothing about visitors.
   */
  state: "live" | "never_deployed" | "deploy_failed" | "deploy_in_progress"
  url?: string
  lastUpdatedAt?: number
  error?: string
  caveat: string
}

export interface AiPlanDocument {
  id: "seoPlan" | "marketingPlan" | "launchPlan" | "growthPlan" | "marketPositioning" | "brandIdentity"
  label: string
  present: boolean
  characterCount: number
  /**
   * ALWAYS `ai_generated_planning_context` with `executed: false`: this text
   * was produced by Atai's planner during analysis. Its presence never means
   * any campaign, posting, or optimization was run.
   */
  origin: "ai_generated_planning_context"
  executed: false
}

export interface PlanKnowledge {
  hasSpecification: boolean
  /** Plan completeness derived deterministically from the stored spec. */
  health: {
    percent: number
    completeSections: number
    totalSections: number
    missing: Array<{ id: PlanSectionId; label: string }>
    needsWork: Array<{ id: PlanSectionId; label: string }>
  } | null
  targetUsers: string[]
}

export interface OwnerGoals {
  businessGoal?: string
  revenueTarget?: string
  destination?: string
  intent?: string
}

export type GrowthNextStepKind =
  | "create_plan"
  | "complete_plan_section"
  | "review_ai_plan"
  | "deploy"
  | "fix_deployment"
  | "first_users"

export interface GrowthNextStep {
  id: string
  kind: GrowthNextStepKind
  title: string
  detail: string
  /**
   * Every step is derived by deterministic rules from OBSERVED project state.
   * Steps are suggestions, never executed actions.
   */
  basis: "observed_project_state"
  executed: false
  navigation?: { target: "plan" | "runtime" | "collaborate"; projectId: string }
}

export type MetricKey =
  | "runtimeRequests"
  | "checkoutCalls"
  | "completedPayments"
  | "siteVisitors"
  | "conversionRate"
  | "appRevenue"
  | "creditsConsumedByProject"
  | "ownerAccountReferrals"
  | "projectLevelReferrals"

export interface GrowthOverview {
  projectId: string
  projectName: string
  projectState: string
  projectStateLabel: string
  generatedAt: number
  window: { from: number; to: number }
  site: SiteAvailability
  whatAtaiKnows: {
    plan: PlanKnowledge
    ownerGoals: OwnerGoals | null
    aiPlanDocuments: AiPlanDocument[]
  }
  metrics: Record<MetricKey, NumberMetric>
  nextSteps: GrowthNextStep[]
  /** Fixed trust statements rendered with the metrics (spec section 6). */
  trustNotes: string[]
}

export interface GrowthOverviewInput {
  /** Server-resolved session user (never a client-provided id). */
  user: Pick<UserDoc, "id"> & { onboarding?: UserDoc["onboarding"] }
  /** Project already ownership-checked by the caller. */
  project: MirrorProject
}

// ─── Constants ──────────────────────────────────────────────────────────────

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30-day measurement window (< MAX_RANGE_MS 90d)

const AI_PLAN_DOC_DEFS: Array<{ id: AiPlanDocument["id"]; label: string }> = [
  { id: "growthPlan", label: "Growth plan" },
  { id: "marketingPlan", label: "Marketing plan" },
  { id: "launchPlan", label: "Launch plan" },
  { id: "seoPlan", label: "SEO plan" },
  { id: "marketPositioning", label: "Market positioning" },
  { id: "brandIdentity", label: "Brand identity" },
]

const TRUST_NOTES = [
  "Checkout calls are payment capability requests your app made through the Atai runtime — they are not completed payments.",
  "Runtime requests are API calls to the Atai runtime — they are not website visitors or page views.",
  "Credits your project consumed are Atai platform costs — they are not revenue.",
  "Atai cannot see money your app earns; any payments made inside your app are outside Atai's measurement.",
  "Referrals counted here belong to your account and are not attributable to this project.",
  "A successful deployment means your site is live — it does not mean anyone has visited or bought anything.",
  "AI-generated plans are planning context produced during analysis. Nothing in them has been executed.",
]

// ─── Data reads (each independently fail-soft) ──────────────────────────────

async function readRuntimeRequests(projectId: string, window: { from: number; to: number }): Promise<NumberMetric> {
  const def = {
    definition: "API requests your generated app made through the Atai runtime in the last 30 days.",
    caveat: "Not website visitors, page views, or signups.",
    source: "runtime_usage",
  }
  try {
    const summary = await summarizeProjectUsage(projectId, window)
    return measured(summary.requests, { ...def, window })
  } catch (error) {
    logger.warn("marketing.growthOverview", "runtime usage read failed", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return unavailable("Runtime usage data could not be read right now.", def)
  }
}

async function readCheckoutCalls(projectId: string, window: { from: number; to: number }): Promise<NumberMetric> {
  const def = {
    definition: "Calls to Atai runtime payment capabilities made by your app in the last 30 days.",
    caveat: "Checkout requests created ≠ payments completed. Atai does not observe settlement.",
    source: "runtime_usage(capability=payments*)",
  }
  try {
    await ensureRuntimeIndexes()
    const col = await runtimeUsageCol()
    const count = await col.countDocuments({
      projectId,
      capability: { $regex: "^payments" },
      createdAt: { $gte: window.from, $lte: window.to },
    })
    return measured(count, { ...def, window })
  } catch (error) {
    logger.warn("marketing.growthOverview", "checkout capability read failed", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    })
    return unavailable("Payment-capability usage could not be read right now.", def)
  }
}

async function readProjectCredits(user: GrowthOverviewInput["user"], project: MirrorProject): Promise<NumberMetric> {
  const def = {
    definition: "Atai credits debited with this project recorded as the ledger reference.",
    caveat: "Credit consumption is your platform cost — it is not revenue your app generated.",
    source: "credit_ledger(referenceType=project)",
  }
  try {
    const col = await creditLedgerCol()
    const [row] = await col
      .aggregate<{ debits: number; reversals: number; entries: number }>([
        { $match: { userId: user.id, referenceType: "project", referenceId: project.id } },
        {
          $group: {
            _id: null,
            debits: { $sum: { $cond: [{ $eq: ["$direction", "debit"] }, { $ifNull: ["$amount", 0] }, 0] } },
            reversals: { $sum: { $cond: [{ $eq: ["$direction", "credit"] }, { $ifNull: ["$amount", 0] }, 0] } },
            entries: { $sum: 1 },
          },
        },
      ])
      .toArray()
    const consumed = Math.max(0, (row?.debits ?? 0) - (row?.reversals ?? 0))
    return measured(consumed, { ...def })
  } catch (error) {
    logger.warn("marketing.growthOverview", "credit ledger read failed", {
      projectId: project.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return unavailable("Credit ledger data could not be read right now.", def)
  }
}

async function readOwnerReferrals(user: GrowthOverviewInput["user"]): Promise<NumberMetric> {
  const def = {
    definition: "Referrals attributed to your Atai account (all projects combined).",
    caveat: "Account-level only — these cannot be attributed to this specific project.",
    source: "referrals(referrerUserId)",
  }
  try {
    const col = await referralsCol()
    const count = await col.countDocuments({ referrerUserId: user.id })
    return measured(count, { ...def })
  } catch (error) {
    logger.warn("marketing.growthOverview", "referral read failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return unavailable("Referral data could not be read right now.", def)
  }
}

// ─── Deterministic projections (no AI calls, no new writes) ────────────────

export function readSiteAvailability(project: MirrorProject): SiteAvailability {
  const deployment = project.deployment
  const caveat = "Deployment state only. A live site does not imply visitors, signups, or sales."
  if (!deployment || deployment.status === "idle") {
    return { state: "never_deployed", caveat }
  }
  if (deployment.status === "building" || deployment.status === "deploying") {
    return { state: "deploy_in_progress", lastUpdatedAt: deployment.updatedAt, caveat }
  }
  if (deployment.status === "failed") {
    return { state: "deploy_failed", lastUpdatedAt: deployment.updatedAt, error: deployment.error, caveat }
  }
  // status === "success" — only show the URL when one was actually recorded.
  if (deployment.productionUrl) {
    return { state: "live", url: deployment.productionUrl, lastUpdatedAt: deployment.updatedAt, caveat }
  }
  return { state: "live", lastUpdatedAt: deployment.updatedAt, caveat }
}

export function readPlanKnowledge(project: MirrorProject): PlanKnowledge {
  const spec = project.specification as ApplicationSpecification | undefined
  if (!spec) {
    return { hasSpecification: false, health: null, targetUsers: [] }
  }
  const health = computePlanHealth(spec)
  return {
    hasSpecification: true,
    health: {
      percent: health.percent,
      completeSections: health.sections.filter((s) => s.status === "complete").length,
      totalSections: health.sections.length,
      missing: health.sections.filter((s) => s.status === "missing").map((s) => ({ id: s.id, label: s.label })),
      needsWork: health.sections.filter((s) => s.status === "needs_work").map((s) => ({ id: s.id, label: s.label })),
    },
    targetUsers: Array.isArray(spec.targetUsers) ? spec.targetUsers.filter((u) => typeof u === "string" && u.trim().length > 0) : [],
  }
}

export function readAiPlanDocuments(project: MirrorProject): AiPlanDocument[] {
  const spec = project.specification as Partial<ApplicationSpecification> | undefined
  return AI_PLAN_DOC_DEFS.map(({ id, label }) => {
    const raw = spec?.[id]
    const text = typeof raw === "string" ? raw.trim() : ""
    const present = text.length > 0 && !isPlaceholderValue(text)
    return {
      id,
      label,
      present,
      characterCount: present ? text.length : 0,
      origin: "ai_generated_planning_context" as const,
      executed: false as const,
    }
  })
}

export function readOwnerGoals(user: GrowthOverviewInput["user"]): OwnerGoals | null {
  const on = user.onboarding
  if (!on) return null
  const goals: OwnerGoals = {}
  if (on.businessGoal?.trim()) goals.businessGoal = on.businessGoal.trim()
  if (on.revenueTarget?.trim()) goals.revenueTarget = on.revenueTarget.trim()
  if (on.destination?.trim()) goals.destination = on.destination.trim()
  if (on.intent?.trim()) goals.intent = on.intent.trim()
  return Object.keys(goals).length > 0 ? goals : null
}

/**
 * Deterministic next-step derivation from OBSERVED state. These are rule-based
 * suggestions the surface can honestly show; nothing here executes or claims
 * execution.
 */
export function deriveNextSteps(input: {
  project: MirrorProject
  site: SiteAvailability
  plan: PlanKnowledge
  aiPlanDocuments: AiPlanDocument[]
  runtimeRequests: NumberMetric
}): GrowthNextStep[] {
  const { project, site, plan, aiPlanDocuments, runtimeRequests } = input
  const steps: GrowthNextStep[] = []
  const nav = (target: "plan" | "runtime" | "collaborate") => ({ target, projectId: project.id })

  if (!plan.hasSpecification) {
    steps.push({
      id: "create_plan",
      kind: "create_plan",
      title: "Create your application plan",
      detail: "Atai has not produced an application plan for this project yet. The plan is the foundation every growth step builds on.",
      basis: "observed_project_state",
      executed: false,
      navigation: nav("collaborate"),
    })
  } else {
    if (plan.health) {
      for (const section of plan.health.missing.slice(0, 2)) {
        steps.push({
          id: `missing:${section.id}`,
          kind: "complete_plan_section",
          title: `Complete the “${section.label}” plan section`,
          detail: `Your plan is ${plan.health.percent}% complete. “${section.label}” has no content yet — fill it in the plan editor.`,
          basis: "observed_project_state",
          executed: false,
          navigation: nav("plan"),
        })
      }
      if (steps.length === 0 && plan.health.percent < 80) {
        for (const section of plan.health.needsWork.slice(0, 1)) {
          steps.push({
            id: `needswork:${section.id}`,
            kind: "complete_plan_section",
            title: `Tighten the “${section.label}” plan section`,
            detail: `It still reads as placeholder. Sharpen it so the plan reflects what you are really building.`,
            basis: "observed_project_state",
            executed: false,
            navigation: nav("plan"),
          })
        }
      }
    }
    if (aiPlanDocuments.some((d) => d.present)) {
      steps.push({
        id: "review_ai_plan",
        kind: "review_ai_plan",
        title: "Review the AI-generated growth and marketing plans",
        detail:
          "Atai's planner drafted growth, marketing, launch and positioning text during analysis. That text is planning context only — nothing in it has been executed.",
        basis: "observed_project_state",
        executed: false,
        navigation: nav("plan"),
      })
    }
  }

  if (site.state === "deploy_failed") {
    steps.push({
      id: "fix_deployment",
      kind: "fix_deployment",
      title: "Fix the failed deployment",
      detail: "Your last deployment attempt failed. Resolve it from the runtime page so the site can go live.",
      basis: "observed_project_state",
      executed: false,
      navigation: nav("runtime"),
    })
  } else if (site.state === "never_deployed") {
    steps.push({
      id: "deploy",
      kind: "deploy",
      title: "Deploy your project",
      detail: "There is no live deployment yet. Deploying gives you a URL you can share; it does not by itself bring visitors.",
      basis: "observed_project_state",
      executed: false,
      navigation: nav("runtime"),
    })
  } else if (site.state === "live" && runtimeRequests.state === "measured_zero") {
    steps.push({
      id: "first_users",
      kind: "first_users",
      title: "Bring your first users to the live app",
      detail:
        "Your site is deployed and the runtime recorded no API requests in the last 30 days. Share the URL and get real usage flowing — Atai will show genuine request counts as they arrive.",
      basis: "observed_project_state",
      executed: false,
      navigation: nav("runtime"),
    })
  }

  return steps.slice(0, 5)
}

// ─── Assembly ───────────────────────────────────────────────────────────────

export async function getGrowthOverview({ user, project }: GrowthOverviewInput): Promise<GrowthOverview> {
  const now = Date.now()
  const window = clampRange(now - WINDOW_MS, now)

  const site = readSiteAvailability(project)
  const plan = readPlanKnowledge(project)
  const aiPlanDocuments = readAiPlanDocuments(project)
  const ownerGoals = readOwnerGoals(user)

  const [runtimeRequests, checkoutCalls, creditsConsumed, ownerAccountReferrals] = await Promise.all([
    readRuntimeRequests(project.id, window),
    readCheckoutCalls(project.id, window),
    readProjectCredits(user, project),
    readOwnerReferrals(user),
  ])

  const metrics: Record<MetricKey, NumberMetric> = {
    runtimeRequests,
    checkoutCalls,
    completedPayments: notInstrumented(
      "Atai has no visibility into payments completed inside your app. No integration reports this yet.",
      {
        definition: "Payments your app's customers actually completed.",
        caveat: "Cannot be inferred from checkout calls or credits.",
      },
    ),
    siteVisitors: notInstrumented(
      "Atai does not yet collect visitor analytics for generated apps. No fabricated traffic is ever shown.",
      {
        definition: "Unique visitors to your deployed site.",
        caveat: "No ingestion exists yet; runtime requests are NOT visitors.",
      },
    ),
    conversionRate: notInstrumented(
      "Conversion needs both visitor and outcome data. Neither is collected yet, so no rate is estimated.",
      {
        definition: "Share of visitors who took a target action.",
        caveat: "Never estimated from unrelated signals.",
      },
    ),
    appRevenue: notInstrumented(
      "Revenue your app generates is invisible to Atai. Atai platform charges are costs, not your revenue.",
      {
        definition: "Money earned by your generated app.",
        caveat: "Credit consumption ≠ revenue; Atai platform revenue ≠ your app revenue.",
      },
    ),
    creditsConsumedByProject: creditsConsumed,
    ownerAccountReferrals,
    projectLevelReferrals: notInstrumented(
      "The referral system records account-level relationships only; nothing attributes a referral to a specific project.",
      {
        definition: "Referrals that came specifically from this project.",
        caveat: "Owner-level referral counts must not be presented as project results.",
      },
    ),
  }

  return {
    projectId: project.id,
    projectName: project.name,
    projectState: project.state,
    projectStateLabel: STATE_LABELS[project.state] ?? project.state,
    generatedAt: now,
    window,
    site,
    whatAtaiKnows: { plan, ownerGoals, aiPlanDocuments },
    metrics,
    nextSteps: deriveNextSteps({ project, site, plan, aiPlanDocuments, runtimeRequests }),
    trustNotes: TRUST_NOTES,
  }
}
