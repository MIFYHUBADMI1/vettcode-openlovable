import { z } from "zod"

/**
 * Planning_Run
 * ------------
 * Tracks execution of the planning pipeline with metadata for observability,
 * debugging, and performance monitoring (Requirements 18.1-18.8).
 */

export const PipelineStageSchema = z.enum([
  "idea_understanding",
  "website_understanding",
  "research",
  "planning",
  "critique",
  "repair",
  "semantic_validation",
  "sanitization",
  "complexity_classification",
])
export type PipelineStage = z.infer<typeof PipelineStageSchema>

export const RunStatusSchema = z.enum(["running", "completed", "failed"])
export type RunStatus = z.infer<typeof RunStatusSchema>

export const PipelineModeSchema = z.enum(["idea", "website", "deepCrawl"])
export type PipelineMode = z.infer<typeof PipelineModeSchema>

export const StageResultSchema = z.object({
  stage: PipelineStageSchema,
  model: z.string(),
  startedAt: z.number(),
  completedAt: z.number(),
  durationMs: z.number(),
  tokens: z.number(),
  success: z.boolean(),
  retries: z.number().default(0),
  error: z.string().optional(),
})
export type StageResult = z.infer<typeof StageResultSchema>

export const RunOutcomeSchema = z.object({
  specificationId: z.string().optional(),
  qualityScore: z.number().optional(),
  completenessScore: z.number().optional(),
  legacy: z.boolean().optional(),
})
export type RunOutcome = z.infer<typeof RunOutcomeSchema>

export const PlanningRunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  mode: PipelineModeSchema,
  startedAt: z.number(),
  completedAt: z.number().optional(),
  status: RunStatusSchema,

  stageResults: z.array(StageResultSchema).default([]),

  totalTokens: z.number().default(0),
  totalDurationMs: z.number().default(0),

  outcome: RunOutcomeSchema.optional(),
  error: z.string().optional(),
  createdAt: z.number(),
})
export type PlanningRun = z.infer<typeof PlanningRunSchema>
