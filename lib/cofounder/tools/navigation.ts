import "server-only"
import { store } from "@/lib/store/store"
import { resolveNavigationTarget, isKnownTarget, isProjectTarget } from "@/lib/navigation/routes"
import { toToolOutcome } from "../errors"
import { buildCreditCosts } from "../context"
import { ownedProject } from "./projects"
import { navigationSchema, accountSummarySchema, creditCostsSchema } from "../schemas"
import type { ToolDefinition } from "../types"

/**
 * Navigation tool (spec sections 25–26): returns a STRUCTURED target the
 * client resolves through the route registry. The model never authors an
 * href. Account tools (spec section 52–53) are read-only.
 */

export const navigateTool: ToolDefinition = {
  name: "navigate",
  description:
    "Navigate the founder to an Atai surface. Project destinations (project, plan, collaborate, database, edit, source, tree, repoCode, readme, runtime) REQUIRE a projectId from list_projects or get_workspace_overview. Workspace destinations (dashboard, projects, newProject, explore, featureRequests, billing, settings) don't. Only navigate after the destination is verified — for a project the founder described, confirm the match first.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: navigationSchema,
  async execute(input, ctx) {
    try {
      const parsed = navigationSchema.parse(input)
      if (!isKnownTarget(parsed.target)) {
        return { success: false, error: { code: "VALIDATION", message: `Unknown destination "${parsed.target}".` } }
      }
      if (isProjectTarget(parsed.target)) {
        if (!parsed.projectId) {
          return { success: false, error: { code: "VALIDATION", message: "That destination needs a projectId — find it with list_projects first." } }
        }
        // Verify the project exists AND belongs to this user before offering
        // navigation — never navigate to another user's project.
        const project = await ownedProject(ctx, parsed.projectId)
        if (!project) {
          return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
        }
        return {
          success: true,
          type: "navigation",
          data: { destination: project.name, projectId: project.id },
          navigation: { target: parsed.target as never, projectId: project.id },
        }
      }
      return {
        success: true,
        type: "navigation",
        data: { destination: parsed.target },
        navigation: { target: parsed.target as never },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't navigate there.")
    }
  },
}

export const getAccountSummaryTool: ToolDefinition = {
  name: "get_account_summary",
  description: "Read the founder's account summary: name, email, verification status, and credit balance breakdown. Read-only.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: accountSummarySchema,
  async execute(input, ctx) {
    try {
      return {
        success: true,
        type: "account_summary",
        data: {
          name: ctx.user.name,
          email: ctx.user.email,
          emailVerified: ctx.user.emailVerified,
          creditsAvailable: ctx.credits.available,
          creditsBalance: ctx.credits.balance,
          creditsReserved: ctx.credits.reserved,
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read your account right now.")
    }
  },
}

export const getCreditCostsTool: ToolDefinition = {
  name: "get_credit_costs",
  description:
    "Read the current credit costs (chat messages, plan analysis, auto-complete, build tiers, deployment) from the platform configuration. Use this to answer pricing questions accurately — never estimate costs yourself.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: creditCostsSchema,
  async execute(input, ctx) {
    try {
      void ctx
      const costs = await buildCreditCosts()
      return { success: true, type: "credit_costs", data: costs as unknown as Record<string, unknown> }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read the credit costs right now.")
    }
  },
}
