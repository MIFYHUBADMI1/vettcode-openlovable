import { z } from "zod"

/**
 * Zod input schemas for every Co-founder tool. The registry converts these to
 * the JSON Schema the model sees, and EVERY execution path validates model
 * input through them again (agent loop and approval endpoint alike).
 */

export const emptySchema = z.object({}).strip()

export const projectIdSchema = z.object({}).strip()

export const workspaceOverviewSchema = z.object({}).strip()

export const getProjectSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const getProjectActivitySchema = z.object({
  projectId: z.string().min(1).max(80),
  limit: z.number().int().min(1).max(50).optional(),
}).strip()

export const navigationSchema = z.object({
  target: z.string().min(1).max(40),
  projectId: z.string().min(1).max(80).optional(),
}).strip()

export const createProjectSchema = z.object({
  mode: z.enum(["scratch", "website", "github"]),
  idea: z.string().min(8).max(4000).optional(),
  url: z.string().min(3).max(2000).optional(),
  githubRepoOwner: z.string().min(1).max(120).optional(),
  githubRepoName: z.string().min(1).max(120).optional(),
  githubBranch: z.string().min(1).max(120).optional(),
  appName: z.string().min(1).max(80).optional(),
}).strip()

export const deleteProjectSchema = z.object({
  projectId: z.string().min(1).max(80),
  confirmWord: z.literal("DELETE"),
}).strip()

export const getPlanSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const proposePlanUpdateSchema = z.object({
  projectId: z.string().min(1).max(80),
  changes: z
    .array(
      z.object({
        section: z.string().min(1).max(80),
        proposedValue: z.string().min(1).max(20000),
        reason: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(5),
}).strip()

export const applyPlanUpdateSchema = z.object({
  projectId: z.string().min(1).max(80),
  changes: z
    .array(
      z.object({
        section: z.string().min(1).max(80),
        value: z.string().min(1).max(20000),
      }),
    )
    .min(1)
    .max(5),
  /** Present when applying an accepted proposal (decision-note bookkeeping). */
  acceptedProposalId: z.string().min(1).max(80).optional(),
}).strip()

export const analyzePlanSchema = z.object({
  projectId: z.string().min(1).max(80),
  refresh: z.boolean().optional(),
}).strip()

export const autoCompletePlanSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const buildStatusSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const buildLogsSchema = z.object({
  projectId: z.string().min(1).max(80),
  type: z.enum(["dev", "prod"]).optional(),
}).strip()

export const buildConversationSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const stopBuildSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const requestBuildSchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const requestFollowupEditSchema = z.object({
  projectId: z.string().min(1).max(80),
  prompt: z.string().min(2).max(4000),
}).strip()

export const requestDeploySchema = z.object({
  projectId: z.string().min(1).max(80),
}).strip()

export const accountSummarySchema = z.object({}).strip()
export const creditCostsSchema = z.object({}).strip()
