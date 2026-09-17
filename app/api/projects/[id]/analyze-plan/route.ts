import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import {
  buildCollaborateContext,
  COFOUNDER_ANALYZE_SYSTEM,
  parseAnalysisResponse,
  buildProposal,
} from "@/lib/analysis/cofounder"
import { computePlanHealth } from "@/lib/analysis/plan-sections"
import { chargeAnalysisCredits } from "@/lib/analysis/collaborate-credits"
import { getCollaborateCosts } from "@/lib/billing/runtime-config"
import type { PlanAnalysis } from "@/lib/types/plan-analysis"
import type { ProjectEvent } from "@/lib/types/project"

/**
 * POST /api/projects/[id]/analyze-plan
 *
 * Runs the AI Co-Founder plan analysis (structured findings + proposals).
 * Cached in project.planAnalysis — repeat requests within the freshness
 * window return the cached analysis for free (no AI call, no credits).
 *
 * Request body: { refresh?: boolean }
 * Response: { analysis, cached }
 */
const ANALYSIS_FRESHNESS_MS = 1000 * 60 * 30 // 30 minutes

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }
    if (!project.specification) {
      return fail("VALIDATION", "This project has no plan to analyze yet.", 409)
    }

    const body = (await req.json().catch(() => ({}))) as { refresh?: boolean }
    const refresh = body.refresh === true

    // Serve the cached analysis when it is fresh and the plan hasn't changed
    // since it was generated (updatedAt check also covers accepted proposals).
    const cached = project.planAnalysis
    if (
      !refresh &&
      cached &&
      Date.now() - cached.generatedAt < ANALYSIS_FRESHNESS_MS &&
      cached.generatedAt >= project.updatedAt - 1000
    ) {
      return ok({ analysis: cached, cached: true, decisions: (project.planUpdateNotes ?? []).length })
    }

    const charged = await chargeAnalysisCredits(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You don't have enough credits to run an analysis.", 402)
    }

    const spec = project.specification
    const context = buildCollaborateContext({
      spec,
      preferences: project.preferences,
      decisions: project.planUpdateNotes ?? [],
      conversation: project.conversation ?? [],
      historyLimit: 6,
    })

    const { text } = await generateText({
      model: MODEL,
      system: COFOUNDER_ANALYZE_SYSTEM,
      prompt: context,
      maxOutputTokens: 4096,
    })

    const parsed = parseAnalysisResponse(text, spec)
    if (!parsed) {
      return fail("UNKNOWN", "The analysis came back unreadable. Please try again.", 502)
    }

    // Stamp proposals with the REAL current section values.
    const costs = await getCollaborateCosts()
    const analysis: PlanAnalysis = {
      ...parsed,
      proposals: parsed.proposals.map((p) => buildProposal(spec, p, "analysis")),
      creditsCharged: costs.planAnalysisCost,
    }

    await store.updateProject(id, { planAnalysis: analysis })
    const evt: ProjectEvent = {
      id: cryptoId(),
      at: Date.now(),
      level: "info",
      stage: "plan",
      message: `🧠 Plan analyzed — ${analysis.findings.length} findings, ${analysis.proposals.length} suggestions`,
    }
    await store.appendEvent(id, evt)

    return ok({ analysis, cached: false, decisions: (project.planUpdateNotes ?? []).length })
  } catch (e) {
    return handleRouteError("api.projects.analyze-plan", e)
  }
}

/** GET returns the cached analysis without side effects (page load). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }
    return ok({ analysis: project.planAnalysis ?? null, decisions: (project.planUpdateNotes ?? []).length })
  } catch (e) {
    return handleRouteError("api.projects.analyze-plan", e)
  }
}
