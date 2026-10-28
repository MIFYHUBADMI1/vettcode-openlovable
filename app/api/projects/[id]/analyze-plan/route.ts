import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { requestRawCompletion } from "@/lib/analysis/raw-chat"
import { logger } from "@/lib/logging/logger"
import { aiTimeoutUserMessage, describeErrorChain } from "@/lib/api/upstream-error"
import {
  buildCollaborateContext,
  COFOUNDER_ANALYZE_SYSTEM,
  parseAnalysisResponse,
  buildProposal,
} from "@/lib/analysis/cofounder"
import { computePlanHealth } from "@/lib/analysis/plan-sections"
import { chargeAnalysisCredits, refundCollaboration } from "@/lib/analysis/collaborate-credits"
import { getCollaborateCosts } from "@/lib/billing/runtime-config"
import type { PlanAnalysis } from "@/lib/types/plan-analysis"
import type { ProjectEvent } from "@/lib/types/project"
import { refuseInsufficientCredits } from "@/lib/api/credit-refusal"

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

import { withAiProtection } from "@/lib/api/ai-protection"
import { aiSignal } from "@/lib/api/ai-context"

export const POST = withAiProtection("analysis", post)

async function post(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      const { planAnalysisCost } = await getCollaborateCosts()
      return refuseInsufficientCredits(
        user.id,
        planAnalysisCost,
        `You need ${planAnalysisCost.toLocaleString()} credits to run an analysis.`,
      )
    }

    const spec = project.specification
    const context = buildCollaborateContext({
      spec,
      preferences: project.preferences,
      decisions: project.planUpdateNotes ?? [],
      conversation: project.conversation ?? [],
      historyLimit: 6,
      founderVision: project.idea,
      sourceUrl: project.sourceUrl,
    })

    let text = ""
    let aiFailure: unknown = null
    try {
      const result = await generateText({
        model: MODEL,
        system: COFOUNDER_ANALYZE_SYSTEM,
        prompt: context,
        maxOutputTokens: 4096,
        maxRetries: 3,
        abortSignal: aiSignal(),
      })
      text = result.text
    } catch (aiError) {
      aiFailure = aiError
    }

    // The SDK can reject a reply the provider really did write (strict schema
    // validation on an odd payload). Read it straight from the provider before
    // treating the run as failed — the founder paid for this analysis.
    if (!text.trim()) {
      const salvaged = await requestRawCompletion({
        system: COFOUNDER_ANALYZE_SYSTEM,
        prompt: context,
        maxOutputTokens: 4096,
      })
      if (salvaged?.text.trim()) {
        text = salvaged.text
        logger.warn("api.projects.analyze-plan", "recovered analysis from the raw provider response", {
          projectId: id,
          detail: aiFailure ? describeErrorChain(aiFailure).join(" <- ") : "empty completion from SDK",
        })
      } else {
        // Refund the charge taken above — a provider outage must not cost the
        // user credits (spec section 43: no false success, no lost money).
        await refundCollaboration(user.id, id, "analysis")
        if (aiFailure) {
          logger.error("api.projects.analyze-plan", "analysis call failed", {
            projectId: id,
            detail: describeErrorChain(aiFailure).join(" <- "),
          })
          throw aiFailure
        }
        return fail("AI_UNAVAILABLE", aiTimeoutUserMessage(), 503)
      }
    }

    const parsed = parseAnalysisResponse(text, spec)
    if (!parsed) {
      // Nothing usable arrived either way, so the founder keeps their credits.
      await refundCollaboration(user.id, id, "analysis")
      logger.warn("api.projects.analyze-plan", "analysis response was unreadable", {
        projectId: id,
        length: text.length,
      })
      return fail("UNKNOWN", "The analysis came back unreadable. No credits were kept — please try again.", 502)
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
