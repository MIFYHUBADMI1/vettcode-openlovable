import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { logger } from "@/lib/logging/logger"
import { ProjectUnderstandingSchema } from "@/lib/types/understanding"
import { ApplicationSpecificationSchema } from "@/lib/types/specification"
import { singleFlight } from "@/lib/cache/single-flight"
import {
  getPlanSection,
  validatePlanSectionValue,
  applySectionUpdate,
  computePlanHealth,
  type PlanSectionId,
} from "@/lib/analysis/plan-sections"
import { decisionForProposal } from "@/lib/analysis/cofounder"
import type { PlanProposal, PlanFinding } from "@/lib/types/plan-analysis"
import type { ProjectEvent } from "@/lib/types/project"

/** Validated plan-section update request (accepted AI proposal or manual
 * section edit from the Collaborate workspace). The section allow-list and
 * value shape are enforced server-side — the AI never gains arbitrary
 * mutation capability (spec section 31). */
interface SectionUpdateRequest {
  section: string
  value: unknown
  /** When provided, this proposal is being accepted: recorded as a decision
   * and (if present) removed from the cached analysis proposal list. */
  acceptedProposal?: { id: string } | null
}

/** Returns a project the caller owns. Ownership is enforced server-side — a
 * user can never read another user's project (spec section 26).
 *
 * Single-flight deduplication prevents thundering herds when many SWR clients
 * poll the same project simultaneously (e.g. during a build).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const fetcher = singleFlight<Response>(`api.projects.get:${id}`)
    return fetcher(async () => {
      const project = await store.getProject(id)
      if (!project || project.userId !== user.id)
        return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
      return ok({ project })
    })
  } catch (e) {
    return handleRouteError("api.projects.get", e)
  }
}

/** Saves user-reviewed project context or specification with ownership checks. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    const body = (await req.json().catch(() => ({}))) as {
      understanding?: unknown
      specification?: unknown
      sectionUpdate?: SectionUpdateRequest
      /** Durable dismissal of a cached analysis proposal. */
      dismissProposalId?: string
    }

    // ── Dismiss a cached analysis proposal (rejection must persist) ──
    if (typeof body.dismissProposalId === "string" && body.dismissProposalId) {
      if (project.planAnalysis) {
        const dismissed = project.planAnalysis.proposals.some((p) => p.id === body.dismissProposalId)
        if (dismissed) {
          const updated = await store.updateProject(id, {
            planAnalysis: {
              ...project.planAnalysis,
              proposals: project.planAnalysis.proposals.filter((p) => p.id !== body.dismissProposalId),
            },
          })
          return ok({ project: updated })
        }
      }
      return ok({ project }) // unknown id — nothing to do
    }

    const patch: Record<string, unknown> = {}
    if (body.understanding !== undefined) {
      const parsed = ProjectUnderstandingSchema.safeParse(body.understanding)
      if (!parsed.success) return fail("VALIDATION", "The project context is invalid.", 422)
      patch.understanding = parsed.data
    }
    if (body.specification !== undefined) {
      const parsed = ApplicationSpecificationSchema.safeParse(body.specification)
      if (!parsed.success) return fail("VALIDATION", "The application plan is invalid.", 422)
      patch.specification = parsed.data
    }

    // ── Section update (accepted proposal or targeted manual edit) ──
    let decisionNote: string | null = null
    let acceptedProposal: PlanProposal | null = null
    if (body.sectionUpdate !== undefined) {
      const su = body.sectionUpdate
      const section = typeof su?.section === "string" ? su.section : ""
      if (!getPlanSection(section)) return fail("VALIDATION", "Unknown plan section.", 422)
      const validated = validatePlanSectionValue(section, su?.value)
      if (!validated.ok) return fail("VALIDATION", validated.error, 422)

      const current = project.specification
      if (!current) return fail("VALIDATION", "This project has no plan yet.", 409)
      const nextSpec = applySectionUpdate(current, section as PlanSectionId, validated.value)
      const reparsed = ApplicationSpecificationSchema.safeParse(nextSpec)
      if (!reparsed.success) return fail("VALIDATION", "The proposed value is invalid for this section.", 422)
      patch.specification = reparsed.data
      patch.specSanitized = false

      if (su.acceptedProposal) {
        acceptedProposal =
          (project.planAnalysis?.proposals ?? []).find((p) => p.id === su.acceptedProposal?.id) ?? null
        decisionNote = acceptedProposal
          ? decisionForProposal(acceptedProposal)
          : `Updated ${getPlanSection(section)?.label ?? section}`
      }
    }

    if (!Object.keys(patch).length) return fail("VALIDATION", "No editable project data was provided.", 422)

    // ── Derived bookkeeping when the plan changed ──
    if (patch.specification) {
      const nextSpec = patch.specification as NonNullable<typeof project.specification>

      // 1. Record the accepted decision (AI context, spec section 45).
      if (decisionNote) {
        const notes = [...(project.planUpdateNotes ?? []), decisionNote].slice(-50)
        patch.planUpdateNotes = notes
      }

      // 2. Drop the accepted proposal and refresh cached analysis status so
      //    stale findings don't linger after the plan changed.
      if (project.planAnalysis) {
        const remainingProposals = (project.planAnalysis.proposals ?? []).filter(
          (p) => !(acceptedProposal && p.id === acceptedProposal.id) && p.section !== (body.sectionUpdate?.section ?? ""),
        )
        const health = computePlanHealth(nextSpec)
        patch.planAnalysis = {
          ...project.planAnalysis,
          healthPercent: health.percent,
          proposals: remainingProposals,
          findings: project.planAnalysis.findings.filter(
            (f: PlanFinding) => f.section !== body.sectionUpdate?.section,
          ),
        }
      }

      // 3. Audit trail event.
      const evt: ProjectEvent = {
        id: cryptoId(),
        at: Date.now(),
        level: "info",
        stage: "plan",
        message: decisionNote ?? `📝 Plan section updated: ${body.sectionUpdate?.section ?? "spec"}`,
      }
      await store.appendEvent(id, evt)
    }

    const updated = await store.updateProject(id, patch)
    return ok({ project: updated })
  } catch (e) {
    return handleRouteError("api.projects.update", e)
  }
}

/** Permanently deletes a project the caller owns, cascading to its build
 * runs. Ownership is enforced server-side (spec section 26). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    logger.info("api.projects.delete", "request received", { id, userId: user.id })
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      logger.warn("api.projects.delete", "ownership check failed", { id, userId: user.id })
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }
    const deleted = await store.deleteProject(id, user.id)
    logger.info("api.projects.delete", "result", { id, deleted })
    if (!deleted) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError("api.projects.delete", e)
  }
}
