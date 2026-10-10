import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { store } from "@/lib/store/store"
import { isGrowthTasksEnabledForUser } from "@/lib/marketing/feature-flags"
import {
  createGrowthTask,
  listTasks,
  updateTaskStatus,
  updateTaskFields,
  isGrowthTaskStatus,
} from "@/lib/marketing/tasks/service"
import type { GrowthTaskDoc } from "@/lib/types/db"
import { getGrowthOverview } from "@/lib/marketing/growth-overview"
import { z } from "zod"

/**
 * Growth tasks endpoint (Phase 5 — W4).
 *
 * Session-authenticated, fail-closed ownership (uniform 404 — no existence leak),
 * rate limited on writes, and flag-gated. Tasks are FREE — nothing here charges
 * or refunds credits. GET lists the founder's own tasks and the deterministic
 * rule-based next-step seeds (from the trusted growth view) that can be turned
 * into tasks. POST creates a task; the client may ONLY stamp origins
 * "user_created" or "next_step_seed" — the "ai_generated" origin is reserved for
 * the approval-gated `propose_growth_task` cofounder tool and cannot be forged
 * here. PATCH changes status and/or edits title/priority/due; every change is
 * appended to the task's durable history by the service. This manages a LIST —
 * it schedules and runs nothing (no job substrate exists).
 */

/** Origins a client is allowed to create. "ai_generated" is intentionally absent. */
const ClientOrigin = z.enum(["user_created", "next_step_seed"])

const CreateSchema = z
  .object({
    title: z.string().min(3).max(200),
    detail: z.string().max(2000).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueAt: z.number().int().positive().nullable().optional(),
    origin: ClientOrigin.default("user_created"),
    sourceNextStepId: z.string().max(80).optional(),
  })
  .strip()

const PatchSchema = z
  .object({
    taskId: z.string().min(1).max(80),
    status: z.enum(["open", "done", "dismissed"]).optional(),
    title: z.string().min(3).max(200).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueAt: z.number().int().positive().nullable().optional(),
  })
  .strip()

/** Compact, client-safe projection of a stored task. */
function present(doc: Awaited<ReturnType<typeof listTasks>>[number]) {
  return {
    id: doc.id,
    title: doc.title,
    detail: doc.detail ?? null,
    status: doc.status,
    priority: doc.priority,
    dueAt: doc.dueAt,
    origin: doc.origin,
    sourceNextStepId: doc.sourceNextStepId ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
  }
}

/** Compact next-step seed the panel can offer as a one-click task. */
function presentNextStep(step: Awaited<ReturnType<typeof getGrowthOverview>>["nextSteps"][number]) {
  return {
    id: step.id,
    kind: step.kind,
    title: step.title,
    detail: step.detail,
    executed: false,
    navigation: step.navigation ?? null,
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isGrowthTasksEnabledForUser(user.id)) {
      return ok({ enabled: false, tasks: [], nextSteps: [] })
    }

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    const tasks = await listTasks(id)
    const overview = await getGrowthOverview({ user, project })
    return ok({ enabled: true, tasks: tasks.map(present), nextSteps: overview.nextSteps.map(presentNextStep) })
  } catch (e) {
    return handleRouteError("api.projects.tasks.get", e)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    await checkRateLimit({ action: "tasks_create", identifier: user.id, limit: 60, windowMs: 60 * 60 * 1000 })

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isGrowthTasksEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "Growth tasks aren't available for this account yet.", 403)
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "A task needs a short title.", 422)

    const task = await createGrowthTask({
      userId: user.id,
      projectId: id,
      title: parsed.data.title,
      detail: parsed.data.detail,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ?? null,
      origin: parsed.data.origin,
      sourceNextStepId: parsed.data.sourceNextStepId,
    })
    return ok(present(task))
  } catch (e) {
    return handleRouteError("api.projects.tasks.post", e)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    await checkRateLimit({ action: "tasks_update", identifier: user.id, limit: 120, windowMs: 60 * 60 * 1000 })

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isGrowthTasksEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "Growth tasks aren't available for this account yet.", 403)
    }

    const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please provide a valid update.", 422)
    const { taskId, status, title, priority, dueAt } = parsed.data

    const wantsFieldEdit = title !== undefined || priority !== undefined || dueAt !== undefined
    if (!status && !wantsFieldEdit) return fail("VALIDATION", "Nothing to update.", 422)

    let updated: GrowthTaskDoc | null = null

    if (wantsFieldEdit) {
      updated = await updateTaskFields({
        userId: user.id,
        projectId: id,
        taskId,
        ...(title !== undefined ? { title } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
      })
    }
    if (status && isGrowthTaskStatus(status)) {
      updated = await updateTaskStatus({ userId: user.id, projectId: id, taskId, status })
    }
    if (!updated) return fail("VALIDATION", "Nothing to update.", 422)
    return ok(present(updated))
  } catch (e) {
    return handleRouteError("api.projects.tasks.patch", e)
  }
}
