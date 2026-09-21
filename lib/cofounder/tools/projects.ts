import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { createUserProject } from "@/lib/projects/create-project"
import { buildPlanSummaryFromSpec } from "../plan-summary"
import { summarizeEvents } from "../context"
import { toToolOutcome } from "../errors"
import { createPendingAction } from "../pending-actions"
import type { ToolDefinition, ToolOutcome, ToolContext } from "../types"
import type { PendingActionRecord } from "../types"
import {
  getProjectSchema,
  getProjectActivitySchema,
  createProjectSchema,
  deleteProjectSchema,
} from "../schemas"
import { logger } from "@/lib/logging/logger"

/**
 * Project tools (spec sections 12–13). Reads are direct store adapters.
 * create_project and delete_project are confirmation tools: prepare() only
 * validates and prices, executeApproved() performs the mutation through the
 * EXISTING services (createUserProject / store.deleteProject) — never a
 * second implementation.
 */

function projectRef(p: { id: string; name: string; state: string; updatedAt: number }) {
  return { id: p.id, name: p.name, state: p.state, updatedAt: p.updatedAt }
}

/** Shared ownership-checked project fetch for tools. */
export async function ownedProject(ctx: ToolContext, projectId: string) {
  const project = await store.getProject(projectId)
  if (!project || project.userId !== ctx.user.id) return null
  return project
}

export function pendingActionMessage(action: PendingActionRecord): ToolOutcome {
  return {
    success: true,
    type: "pending_action",
    data: {
      pendingActionId: action.id,
      toolName: action.toolName,
      risk: action.risk,
      description: action.description,
      ...(action.cost ? { cost: action.cost } : {}),
      ...(action.confirmWord ? { confirmWord: action.confirmWord } : {}),
      ...(action.items ? { items: action.items } : {}),
      expiresAt: action.expiresAt,
    },
    pendingActionId: action.id,
  }
}

export const getProjectTool: ToolDefinition = {
  name: "get_project",
  description:
    "Read one project's details: name, mode, lifecycle state, idea, source URL, plan health, build state, and deployment URL. Only works for the founder's own projects.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: getProjectSchema,
  async execute(input, ctx) {
    try {
      const parsed = getProjectSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      return {
        success: true,
        type: "project",
        data: {
          id: project.id,
          name: project.name,
          mode: project.mode,
          state: project.state,
          idea: project.idea ?? undefined,
          sourceUrl: project.sourceUrl ?? undefined,
          plan: project.specification ? buildPlanSummaryFromSpec(project.specification, project.planUpdateNotes ?? []) : { hasPlan: false, completedSections: [], missingSections: [], recentDecisions: [] },
          build: { state: project.state, totalumProjectId: project.totalumProjectId ?? undefined, developmentUrl: project.developmentUrl ?? undefined },
          deployment: {
            status: project.deployment?.status ?? "idle",
            productionUrl: project.deployment?.productionUrl ?? undefined,
          },
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read that project right now. Please try again.")
    }
  },
}

export const getProjectActivityTool: ToolDefinition = {
  name: "get_project_activity",
  description: "Read a project's recent activity events (what Atai did, build progress, plan changes).",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: getProjectActivitySchema,
  async execute(input, ctx) {
    try {
      const parsed = getProjectActivitySchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      return {
        success: true,
        type: "project_activity",
        data: {
          projectId: project.id,
          name: project.name,
          state: project.state,
          events: summarizeEvents(project.events, parsed.limit ?? 10),
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read that project's activity right now.")
    }
  },
}

export const createProjectTool: ToolDefinition = {
  name: "create_project",
  description:
    "Prepare creating a new Atai project for the founder. Requires confirmation — this only PREPARES the project creation; it runs after the founder approves the confirmation card. Supports modes: 'scratch' (from an idea), 'website' (mirror a URL), 'github' (clone/extend a repo).",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: createProjectSchema,
  async prepare(input, ctx) {
    try {
      const parsed = createProjectSchema.parse(input)
      if (parsed.mode === "scratch" && !parsed.idea) {
        return { ok: false as const, error: { code: "VALIDATION", message: "An idea description is required for a scratch project." } }
      }
      if (parsed.mode === "website" && !parsed.url) {
        return { ok: false as const, error: { code: "VALIDATION", message: "A website URL is required." } }
      }
      if (parsed.mode === "github" && (!parsed.githubRepoOwner || !parsed.githubRepoName)) {
        return { ok: false as const, error: { code: "VALIDATION", message: "The GitHub repository owner and name are required." } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "create_project",
        parameters: parsed as unknown as Record<string, unknown>,
        risk: "CONFIRM",
        description: parsed.appName
          ? `Create project "${parsed.appName}"${parsed.mode === "website" ? ` from ${parsed.url}` : parsed.mode === "github" ? ` from ${parsed.githubRepoOwner}/${parsed.githubRepoName}` : ""}`
          : `Create a new ${parsed.mode} project`,
        conversationId: undefined,
      })
      return { ok: true as const, pending: action }
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: e instanceof Error ? e.message : "Invalid project details." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = createProjectSchema.parse(input)
      // Existing project creation pipeline — analysis, idempotency, rate
      // limits, and event recording all live there.
      const result = await createUserProject(ctx.user.id, {
        mode: parsed.mode,
        ...(parsed.idea ? { idea: parsed.idea } : {}),
        ...(parsed.url ? { url: parsed.url } : {}),
        ...(parsed.githubRepoOwner ? { githubRepoOwner: parsed.githubRepoOwner } : {}),
        ...(parsed.githubRepoName ? { githubRepoName: parsed.githubRepoName } : {}),
        ...(parsed.githubBranch ? { githubBranch: parsed.githubBranch } : {}),
        ...(parsed.appName ? { preferences: { appName: parsed.appName } } : {}),
        skipAnalysis: false,
      })
      if ("error" in result && result.error) {
        const errBody = (result.error as unknown as { status?: number; code?: string; message?: string })
        return {
          success: false,
          error: { code: errBody.code ?? "UNKNOWN", message: errBody.message ?? "I couldn't create the project." },
        }
      }
      const project = result.project
      await store.appendEvent(project.id, {
        id: cryptoId(),
        at: Date.now(),
        level: "info",
        stage: "cofounder",
        message: `✦ Project created via Co-founder: "${project.name}"`,
      })
      return {
        success: true,
        type: "project_created",
        data: { project: projectRef(project) },
        navigation: { target: "project", projectId: project.id },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't create the project.")
    }
  },
}

export const deleteProjectTool: ToolDefinition = {
  name: "delete_project",
  description:
    "Prepare PERMANENT deletion of a project and all of its data (build runs, plans, activity). Destructive and irreversible — the founder must type DELETE to confirm. This only PREPARES the deletion.",
  risk: "HARD_CONFIRM",
  requiresConfirmation: true,
  inputSchema: deleteProjectSchema,
  async prepare(input, ctx) {
    try {
      const parsed = deleteProjectSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false as const, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "delete_project",
        parameters: { projectId: parsed.projectId, confirmWord: "DELETE" },
        risk: "HARD_CONFIRM",
        description: `Permanently delete "${project.name}" and all of its data. This cannot be undone.`,
        confirmWord: "DELETE",
      })
      return { ok: true as const, pending: action }
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: "Invalid deletion request." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = deleteProjectSchema.parse(input)
      if (parsed.confirmWord !== "DELETE") {
        return { success: false, error: { code: "VALIDATION", message: "Deletion requires typing DELETE." } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const deleted = await store.deleteProject(parsed.projectId, ctx.user.id)
      if (!deleted) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't find that project." } }
      }
      logger.info("cofounder.tool.projects", "project deleted via cofounder", { projectId: parsed.projectId, userId: ctx.user.id })
      return {
        success: true,
        type: "project_deleted",
        data: { projectId: parsed.projectId, name: project.name },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't delete the project.")
    }
  },
}
