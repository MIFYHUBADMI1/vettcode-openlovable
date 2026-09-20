import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { activatePlan, getProjectInfrastructure } from "@/lib/infrastructure/service"
import { getInfrastructurePlanWithRuntimePrice, ALL_PLAN_ORDER } from "@/lib/infrastructure/plans"
import type { InfrastructurePlanId } from "@/lib/infrastructure/plans"

/**
 * GET /api/projects/:id/infrastructure
 * Returns the project's current infrastructure subscription and available plans.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED", "Project not found.", 404)

    const subscription = await getProjectInfrastructure(id)

    // Build available plans list (with admin-configured prices)
    const plans = (
      await Promise.all(ALL_PLAN_ORDER.map(async (planId) => {
        const plan = await getInfrastructurePlanWithRuntimePrice(planId)
        if (!plan) return null
        return {
          id: plan.id,
          name: plan.name,
          storageLabel: plan.storageLabel,
          storageBytes: plan.storageBytes,
          AtaiPrice: plan.AtaiPrice,
          description: plan.description,
          isPaid: plan.isPaid,
          isCurrent: subscription?.planId === plan.id,
        }
      }))
    ).filter(Boolean)

    return ok({
      subscription,
      plans,
      hasTotalumProject: Boolean(project.totalumProjectId),
    })
  } catch (e) {
    return handleRouteError("api.projects.infrastructure", e)
  }
}

/**
 * POST /api/projects/:id/infrastructure
 * Subscribe to or change an infrastructure plan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const body = (await req.json().catch(() => ({}))) as { planId?: string }
    const planId = body.planId?.trim().toLowerCase()

    if (!planId) return fail("VALIDATION", "Plan ID is required.", 422)

    const plan = await getInfrastructurePlanWithRuntimePrice(planId)
    if (!plan) return fail("VALIDATION", "Invalid plan.", 422)

    const result = await activatePlan(id, user.id, planId as InfrastructurePlanId)

    if (!result.success) return fail("ACTIVATION_FAILED", result.message, 400)

    return ok({ message: result.message, planId: plan.id })
  } catch (e) {
    return handleRouteError("api.projects.infrastructure.subscribe", e)
  }
}
