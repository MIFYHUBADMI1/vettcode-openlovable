import "server-only"

/**
 * Growth task tools (Phase 5 — W4).
 *
 * `propose_growth_task` is a CONFIRM-tier write: it turns an AI suggestion (or a
 * founder's request) into a durable, change-logged task — but ONLY after the
 * founder approves a reviewable card. prepare() validates and gates (flag +
 * ownership) and creates the pending action WITHOUT persisting anything;
 * executeApproved() re-gates and creates the task. Tasks are FREE — unlike the
 * Studio, there is no charge/refund path here. Ownership is re-derived from the
 * session (ctx.user.id) on every step and re-asserted inside the service.
 *
 * `list_growth_tasks` is READ: it returns the founder's own open tasks (bounded
 * projection) through the same ownedProject gate. Neither tool executes anything
 * on a timer — the job substrate (Phase 0) does not exist and is not faked; this
 * is a task LIST the founder works through manually.
 */

import { createPendingAction } from "../pending-actions"
import { toToolOutcome } from "../errors"
import type { ToolDefinition, PrepareOutcome, ToolOutcome } from "../types"
import { proposeGrowthTaskSchema, listGrowthTasksSchema } from "../schemas"
import { ownedProject } from "./projects"
import { isGrowthTasksEnabledForUser } from "@/lib/marketing/feature-flags"
import { createGrowthTask, listTasks } from "@/lib/marketing/tasks/service"
import { logger } from "@/lib/logging/logger"

export const proposeGrowthTaskTool: ToolDefinition = {
  name: "propose_growth_task",
  description:
    "Suggest a concrete growth action for one of the founder's own projects and add it to their task list. This creates a confirmation card first — nothing is saved until the founder approves. Use when the founder asks what to do next or wants a follow-up action captured. The task is a free, manual to-do (it does NOT run anything automatically), an AI proposal the founder can edit or dismiss, and never a measured result. A short imperative title and optional detail/priority are enough.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: proposeGrowthTaskSchema,
  async prepare(input, ctx): Promise<PrepareOutcome> {
    try {
      const parsed = proposeGrowthTaskSchema.parse(input)
      if (!isGrowthTasksEnabledForUser(ctx.user.id)) {
        return { ok: false, error: { code: "FEATURE_DISABLED", message: "Growth tasks aren't available for this account yet.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "propose_growth_task",
        parameters: {
          projectId: parsed.projectId,
          title: parsed.title,
          ...(parsed.detail ? { detail: parsed.detail } : {}),
          ...(parsed.priority ? { priority: parsed.priority } : {}),
          ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
        },
        risk: "CONFIRM",
        description: `Add task "${parsed.title.trim()}" to ${project.name}'s growth list.`,
        conversationId: ctx.conversationId,
      })
      return { ok: true, pending: action }
    } catch (e) {
      logger.warn("cofounder.tool.tasks", "prepare failed", { message: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: { code: "VALIDATION", message: "I couldn't set up that task." } }
    }
  },
  async executeApproved(input, ctx): Promise<ToolOutcome> {
    try {
      // The approval endpoint re-passes the ORIGINAL stored parameters.
      const parsed = proposeGrowthTaskSchema.parse(input)
      if (!isGrowthTasksEnabledForUser(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "Growth tasks aren't available for this account.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }

      const task = await createGrowthTask({
        userId: ctx.user.id,
        projectId: parsed.projectId,
        title: parsed.title,
        detail: parsed.detail,
        priority: parsed.priority,
        dueAt: parsed.dueAt ?? null,
        origin: "ai_generated",
      })

      return {
        success: true,
        type: "growth_task",
        data: {
          taskId: task.id,
          projectId: task.projectId,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
          note: "AI-proposed task added to the growth list. Nothing runs automatically — the founder works through it manually.",
        },
        navigation: { target: "tasks", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      logger.warn("cofounder.tool.tasks", "executeApproved failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "The task couldn't be added. Please try again.")
    }
  },
}

export const listGrowthTasksTool: ToolDefinition = {
  name: "list_growth_tasks",
  description:
    "Read the founder's own growth task list for one project — open follow-up actions with status, priority, and due date (or none). Strictly read-only: it never creates, edits, completes, or runs anything. Use when the founder asks what's on their plate or what to do next. Tasks are manual to-dos, not measured outcomes.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: listGrowthTasksSchema,
  async execute(input, ctx) {
    try {
      const parsed = listGrowthTasksSchema.parse(input)
      if (!isGrowthTasksEnabledForUser(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "Growth tasks aren't available for this account yet.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const tasks = await listTasks(parsed.projectId, {
        ...(parsed.status ? { status: parsed.status } : {}),
        limit: parsed.limit ?? 20,
      })
      return {
        success: true,
        type: "growth_tasks_list",
        data: {
          projectId: parsed.projectId,
          projectName: project.name,
          count: tasks.length,
          tasks: tasks.slice(0, 20).map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueAt: t.dueAt,
            origin: t.origin,
          })),
        },
        navigation: { target: "tasks", projectId: parsed.projectId },
      }
    } catch (e) {
      logger.warn("cofounder.tool.tasks", "list failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "I couldn't read the task list right now.")
    }
  },
}
