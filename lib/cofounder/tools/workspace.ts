import "server-only"
import { store } from "@/lib/store/store"
import { buildWorkspaceOverview, summarizeEvents } from "../context"
import { toToolOutcome } from "../errors"
import type { ToolDefinition } from "../types"
import { workspaceOverviewSchema, projectIdSchema } from "../schemas"
import { logger } from "@/lib/logging/logger"

/**
 * Workspace-level READ tools. Thin adapters over the existing store + credit
 * service — no second query system (spec sections 11, 14).
 */

export const getWorkspaceOverviewTool: ToolDefinition = {
  name: "get_workspace_overview",
  description:
    "Get a compact snapshot of the founder's workspace: who they are, their credit balance, their projects with states, and a suggested active project. Use this when the founder is unsure what to work on, asks what they have, or when you need orientation.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: workspaceOverviewSchema,
  async execute(input, ctx) {
    try {
      const overview = await buildWorkspaceOverview(ctx.user.id)
      const recentEvents = overview.projects.length
        ? summarizeEvents((await store.getProject(overview.suggestedActiveProject?.id ?? overview.projects[0].id))?.events, 5)
        : []
      return {
        success: true,
        type: "workspace_overview",
        data: {
          creditsAvailable: overview.creditsAvailable,
          projectCount: overview.projects.length,
          projects: overview.projects,
          suggestedActiveProjectId: overview.suggestedActiveProject?.id ?? null,
          recentActivity: recentEvents,
        },
      }
    } catch (e) {
      logger.warn("cofounder.tool.workspace", "overview failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "I couldn't read your workspace right now. Please try again.")
    }
  },
}

export const listProjectsTool: ToolDefinition = {
  name: "list_projects",
  description:
    "List the founder's projects with name, state, and last-updated time. Use to find a project by name, answer 'what projects do I have', or before navigating anywhere project-specific. Never guess a project ID — pick IDs only from this list.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: projectIdSchema,
  async execute(input, ctx) {
    try {
      const projects = await store.listProjects(ctx.user.id, 50)
      return {
        success: true,
        type: "projects_list",
        data: {
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            state: p.state,
            mode: p.mode,
            idea: p.idea ? p.idea.slice(0, 160) : undefined,
            updatedAt: p.updatedAt,
          })),
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't list your projects right now. Please try again.")
    }
  },
}
