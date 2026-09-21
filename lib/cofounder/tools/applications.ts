import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { toToolOutcome } from "../errors"
import { createPendingAction } from "../pending-actions"
import { ownedProject } from "./projects"
import { startProjectBuild, sendProjectFollowup, startProjectDeploy, stopProjectBuild } from "@/lib/projects/project-actions"
import { getBuildCost } from "@/lib/billing/build-auth"
import { getDeploymentCosts } from "@/lib/billing/runtime-config"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { getDevLogs, getProdLogs, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import type { ToolDefinition, ToolContext } from "../types"
import {
  buildStatusSchema,
  buildLogsSchema,
  buildConversationSchema,
  stopBuildSchema,
  requestBuildSchema,
  requestFollowupEditSchema,
  requestDeploySchema,
} from "../schemas"
import { logger } from "@/lib/logging/logger"

/**
 * Application (build/deploy) tools (spec sections 22–24). Reads adapt the
 * existing Totalum service and project state. Mutations are HARD_CONFIRM —
 * they prepare priced pending actions and execute through the SAME shared
 * services as the REST routes. Credit transparency: every confirmation card
 * shows cost, current balance, and what will happen.
 */

function classifyTier(specComplexity?: string): "simple" | "medium" | "complex" {
  if (specComplexity === "simple" || specComplexity === "medium" || specComplexity === "complex") return specComplexity
  return "medium"
}

async function buildCostForProject(project: { specification?: { complexity?: string } | null }): Promise<{ tier: string; cost: number }> {
  const tier = classifyTier(project.specification?.complexity)
  const cost = await getBuildCost(tier)
  return { tier, cost }
}

export const getBuildStatusTool: ToolDefinition = {
  name: "get_build_status",
  description:
    "Read a project's build state: lifecycle state, whether a Totalum build exists, the last build run status, and the development URL. Use before any build action and when the founder asks about build progress.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: buildStatusSchema,
  async execute(input, ctx) {
    try {
      const parsed = buildStatusSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const runs = await store.listBuildRuns(parsed.projectId, { limit: 1 })
      const last = runs[0]
      return {
        success: true,
        type: "build_status",
        data: {
          projectId: project.id,
          name: project.name,
          state: project.state,
          hasBuiltApp: Boolean(project.totalumProjectId),
          ...(last ? { lastBuildRun: { id: last.id, status: last.status, kind: last.kind, startedAt: last.startedAt, error: last.error } } : {}),
          developmentUrl: project.developmentUrl ?? undefined,
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read the build status right now.")
    }
  },
}

export const getBuildLogsTool: ToolDefinition = {
  name: "get_build_logs",
  description: "Read recent build/production logs for a project that has been built.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: buildLogsSchema,
  async execute(input, ctx) {
    try {
      const parsed = buildLogsSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      if (!project.totalumProjectId) {
        return { success: false, error: { code: "VALIDATION", message: "This project hasn't been built yet, so there are no logs." } }
      }
      if (!isTotalumConfigured()) {
        return { success: false, error: { code: "PROVIDER_NOT_CONFIGURED", message: "The build service isn't connected." } }
      }
      if (parsed.type === "prod") {
        const result = await getProdLogs(project.totalumProjectId)
        return { success: true, type: "build_logs", data: { projectId: project.id, type: "prod", logs: result } }
      }
      const result = await getDevLogs(project.totalumProjectId)
      return { success: true, type: "build_logs", data: { projectId: project.id, type: "dev", logs: result } }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read the logs right now.")
    }
  },
}

export const getBuildConversationTool: ToolDefinition = {
  name: "get_build_conversation",
  description: "Read the build agent's conversation/summary for a built project (what the builder did, credentials needed, next steps).",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: buildConversationSchema,
  async execute(input, ctx) {
    try {
      const parsed = buildConversationSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const convo = project.conversation ?? []
      const recent = convo.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 400) }))
      return {
        success: true,
        type: "build_conversation",
        data: {
          projectId: project.id,
          buildSummary: project.buildSummary ? { message: project.buildSummary.message.slice(0, 1500), createdAt: project.buildSummary.createdAt } : null,
          recentMessages: recent,
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read the build conversation right now.")
    }
  },
}

export const stopBuildTool: ToolDefinition = {
  name: "stop_build",
  description: "Stop the running build agent for a project. Low-risk: stops work without spending or deleting anything.",
  risk: "LOW_RISK_WRITE",
  requiresConfirmation: false,
  inputSchema: stopBuildSchema,
  async execute(input, ctx) {
    try {
      const parsed = stopBuildSchema.parse(input)
      const r = await stopProjectBuild(ctx.user.id, parsed.projectId)
      if (!r.ok) {
        return { success: false, error: { code: r.code, message: r.message ?? "Couldn't stop the build.", ...(r.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) } }
      }
      return {
        success: true,
        type: "build_stopped",
        data: { projectId: parsed.projectId, message: r.message ?? "Build stopped." },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't stop the build.")
    }
  },
}

export const requestBuildTool: ToolDefinition = {
  name: "request_build",
  description:
    "Prepare starting the application build for a project. HARD confirmation: the founder must explicitly approve the confirmation card (showing tier, exact credit cost, and balance) before any build starts. Never assume approval from a question.",
  risk: "HARD_CONFIRM",
  requiresConfirmation: true,
  inputSchema: requestBuildSchema,
  async prepare(input, ctx) {
    try {
      const parsed = requestBuildSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false as const, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      if (!project.specification) {
        return { ok: false as const, error: { code: "VALIDATION", message: "This project has no plan yet — complete the plan first." } }
      }
      if (project.state === "building" || project.state === "deploying") {
        return { ok: false as const, error: { code: "AGENT_RUNNING", message: "This project is already building — wait for it to finish.", fatal: true } }
      }
      const { tier, cost } = await buildCostForProject(project)
      const available = await getAvailableCredits(ctx.user.id)
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "request_build",
        parameters: { projectId: parsed.projectId },
        risk: "HARD_CONFIRM",
        description: `Start building "${project.name}" (${tier} tier). This launches the application builder.`,
        cost: { amount: cost, creditsAvailable: available, label: `Build "${project.name}" (${tier} tier)` },
        ttlMs: 10 * 60 * 1000,
      })
      return { ok: true as const, pending: action }
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: "Invalid build request." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = requestBuildSchema.parse(input)
      const r = await startProjectBuild(ctx.user.id, parsed.projectId)
      if (!r.ok) {
        return { success: false, error: { code: r.code, message: r.message ?? "The build couldn't start.", ...(r.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) } }
      }
      logger.info("cofounder.tool.applications", "build started via cofounder", { projectId: parsed.projectId, userId: ctx.user.id, buildRunId: r.buildRunId })
      return {
        success: true,
        type: "build_started",
        data: { projectId: parsed.projectId, buildRunId: r.buildRunId, tier: r.tier, creditsCharged: r.creditsCharged },
        navigation: { target: "project", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      return toToolOutcome(e, "The build couldn't start. Any reserved credits were refunded.")
    }
  },
}

export const requestFollowupEditTool: ToolDefinition = {
  name: "request_followup_edit",
  description:
    "Prepare sending a change request to the application builder for an already-built project. HARD confirmation with credit cost shown — executes only after the founder approves.",
  risk: "HARD_CONFIRM",
  requiresConfirmation: true,
  inputSchema: requestFollowupEditSchema,
  async prepare(input, ctx) {
    try {
      const parsed = requestFollowupEditSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false as const, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      if (!project.totalumProjectId) {
        return { ok: false as const, error: { code: "VALIDATION", message: "This project hasn't been built yet." } }
      }
      if (project.state === "building" || project.state === "deploying") {
        return { ok: false as const, error: { code: "AGENT_RUNNING", message: "A build or deployment is already running — wait for it to finish.", fatal: true } }
      }
      const { tier, cost } = await buildCostForProject(project)
      const available = await getAvailableCredits(ctx.user.id)
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "request_followup_edit",
        parameters: { projectId: parsed.projectId, prompt: parsed.prompt },
        risk: "HARD_CONFIRM",
        description: `Send this change to the builder for "${project.name}": "${parsed.prompt.slice(0, 200)}"`,
        cost: { amount: cost, creditsAvailable: available, label: `Follow-up edit (${tier} tier)` },
        ttlMs: 10 * 60 * 1000,
      })
      return { ok: true as const, pending: action }
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: "Invalid follow-up edit request." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = requestFollowupEditSchema.parse(input)
      const r = await sendProjectFollowup(ctx.user.id, parsed.projectId, parsed.prompt)
      if (!r.ok) {
        return { success: false, error: { code: r.code, message: r.message ?? "The edit couldn't start.", ...(r.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) } }
      }
      return {
        success: true,
        type: "build_started",
        data: { projectId: parsed.projectId, buildRunId: r.buildRunId, kind: "followup", tier: r.tier, creditsCharged: r.creditsCharged },
        navigation: { target: "project", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      return toToolOutcome(e, "The edit couldn't start. Any reserved credits were refunded.")
    }
  },
}

export const requestDeployTool: ToolDefinition = {
  name: "request_deploy",
  description:
    "Prepare deploying a built project to production. HARD confirmation: shows the project, the deploy credit cost, and the balance. Executes only after explicit approval.",
  risk: "HARD_CONFIRM",
  requiresConfirmation: true,
  inputSchema: requestDeploySchema,
  async prepare(input, ctx) {
    try {
      const parsed = requestDeploySchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false as const, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      if (!project.totalumProjectId) {
        return { ok: false as const, error: { code: "VALIDATION", message: "This project hasn't been built yet — build it first." } }
      }
      const deployCost = (await getDeploymentCosts()).deployCost
      const available = await getAvailableCredits(ctx.user.id)
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "request_deploy",
        parameters: { projectId: parsed.projectId },
        risk: "HARD_CONFIRM",
        description: `Deploy "${project.name}" to production. This publishes the current application.`,
        cost: { amount: deployCost, creditsAvailable: available, label: `Deploy "${project.name}"` },
        ttlMs: 10 * 60 * 1000,
      })
      return { ok: true as const, pending: action }
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: "Invalid deploy request." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = requestDeploySchema.parse(input)
      const r = await startProjectDeploy(ctx.user.id, parsed.projectId)
      if (!r.ok) {
        return { success: false, error: { code: r.code, message: r.message ?? "The deployment couldn't start.", ...(r.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) } }
      }
      return {
        success: true,
        type: "deployment_started",
        data: { projectId: parsed.projectId, deployRunId: r.deployRunId, creditsCharged: r.creditsCharged },
        navigation: { target: "project", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      return toToolOutcome(e, "The deployment couldn't start. Reserved credits were refunded.")
    }
  },
}
