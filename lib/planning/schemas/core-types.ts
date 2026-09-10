import { z } from "zod"

/**
 * Core Types for Planning Pipeline
 * ---------------------------------
 * Shared type definitions and schemas used across all planning pipeline stages.
 * These types provide the foundation for the multi-stage validated planning
 * architecture (Requirements 1.1-24.8).
 */

/**
 * Pipeline Stages
 * ---------------
 * Enumeration of all stages in the planning pipeline.
 */
export const PipelineStageSchema = z.enum([
  "idea_understanding",
  "website_understanding",
  "research",
  "planning",
  "critique",
  "repair",
  "validation",
  "sanitization",
])
export type PipelineStage = z.infer<typeof PipelineStageSchema>

/**
 * Pipeline Modes
 * --------------
 * Different execution modes for the planning pipeline.
 */
export const PipelineModeSchema = z.enum(["idea", "website", "deepCrawl"])
export type PipelineMode = z.infer<typeof PipelineModeSchema>

/**
 * Execution Context
 * -----------------
 * Context information passed through pipeline stages for tracking and logging.
 */
export interface ExecutionContext {
  projectId: string
  userId: string
  runId: string
  attempt: number
  metadata: Record<string, unknown>
}

/**
 * Model Configuration
 * -------------------
 * Configuration for AI model selection and parameters.
 */
export const ModelConfigSchema = z.object({
  primary: z.string(), // e.g., "anthropic/claude-3.5-sonnet"
  fallbacks: z.array(z.string()).default([]), // e.g., ["openai/gpt-4", "openrouter/auto"]
  maxTokens: z.number().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
})
export type ModelConfig = z.infer<typeof ModelConfigSchema>

/**
 * Model Strategy Presets
 * ----------------------
 * Predefined model selection strategies for different optimization goals.
 */
export const ModelStrategySchema = z.enum([
  "cost_optimized",
  "quality_optimized",
  "speed_optimized",
])
export type ModelStrategy = z.infer<typeof ModelStrategySchema>

/**
 * Model Configuration for All Stages
 * -----------------------------------
 * Complete model configuration covering all pipeline stages.
 */
export const ModelConfigurationSchema = z.object({
  primaryPlanner: ModelConfigSchema,
  researchAgent: ModelConfigSchema,
  critic: ModelConfigSchema,
  repairService: ModelConfigSchema,
  strategy: ModelStrategySchema,
})
export type ModelConfiguration = z.infer<typeof ModelConfigurationSchema>

/**
 * Confidence Levels
 * -----------------
 * Levels of confidence for understanding data sources.
 */
export const ConfidenceLevelSchema = z.enum(["explicit", "inferred", "observed", "suggested"])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>

/**
 * Severity Levels
 * ---------------
 * Severity classification for issues, gaps, and concerns.
 */
export const SeverityLevelSchema = z.enum(["critical", "warning", "info"])
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>

/**
 * Error Types
 * -----------
 * Classification of errors for retry and recovery logic.
 */
export enum ErrorType {
  RETRYABLE = "retryable",         // Rate limits, timeouts
  NON_RETRYABLE = "non_retryable", // Invalid input, schema validation
  FATAL = "fatal",                 // Credit insufficient, auth failure
}

/**
 * Retry Configuration
 * -------------------
 * Configuration for retry behavior with exponential backoff.
 */
export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

/**
 * Generation Request
 * ------------------
 * Request structure for AI model text generation.
 */
export interface GenerationRequest {
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
  responseFormat?: "json" | "text"
}

/**
 * Generation Response
 * -------------------
 * Response structure from AI model text generation.
 */
export interface GenerationResponse {
  text: string
  tokens: {
    input: number
    output: number
    total: number
  }
  model: string
  finishReason: "stop" | "length" | "error"
}

/**
 * Pipeline Stage Interface
 * ------------------------
 * Generic interface for all pipeline stages with common lifecycle methods.
 */
export interface PipelineStageInterface<TInput, TOutput> {
  readonly stageName: string
  readonly timeoutMs: number
  readonly retryable: boolean

  execute(input: TInput, context: ExecutionContext): Promise<TOutput>

  onSuccess?(output: TOutput, context: ExecutionContext): Promise<void>
  onFailure?(error: Error, context: ExecutionContext): Promise<void>
  shouldRetry?(error: Error, attempt: number): boolean
}

/**
 * Sanitization Result
 * -------------------
 * Result from technology stack sanitization.
 */
export interface SanitizationResult {
  sanitized: boolean
  changes: SanitizationChange[]
  spec: any // ApplicationSpecification after sanitization
}

/**
 * Sanitization Change
 * -------------------
 * Record of a single sanitization modification.
 */
export interface SanitizationChange {
  field: string
  original: string
  replacement: string
  reason: string
}

/**
 * Technology Stack Constraints
 * ----------------------------
 * Allowed technologies for Totalum SDK compatibility.
 */
export const TOTALUM_STACK = {
  frontend: ["React", "Next.js", "Tailwind CSS"],
  backend: ["Next.js API routes", "Totalum SDK"],
  database: ["Totalum SDK database"],
  auth: ["Totalum SDK authentication"],
  storage: ["Totalum SDK storage"],
} as const

/**
 * Stack Replacement Rules
 * -----------------------
 * Mapping of unsupported technologies to Totalum SDK equivalents.
 */
export const STACK_REPLACEMENTS = [
  {
    pattern: /\b(postgresql|postgres|mysql|sqlite|mongodb|mongo)\b/gi,
    replacement: "Totalum SDK database",
    reason: "External database replaced with Totalum SDK"
  },
  {
    pattern: /\b(prisma|mongoose|sequelize|typeorm|drizzle)\b/gi,
    replacement: "Totalum SDK",
    reason: "ORM replaced with Totalum SDK"
  },
  {
    pattern: /\b(express|fastify|nestjs|koa|hapi)\b/gi,
    replacement: "Next.js API routes",
    reason: "Backend framework replaced with Next.js"
  },
  {
    pattern: /\b(firebase|supabase)\b/gi,
    replacement: "Totalum SDK",
    reason: "BaaS platform replaced with Totalum SDK"
  },
  {
    pattern: /\b(aws|amazon web services|azure|google cloud platform|gcp)\b/gi,
    replacement: "Totalum SDK infrastructure",
    reason: "Cloud platform replaced with Totalum SDK"
  },
] as const

/**
 * Planning Cost Constants
 * -----------------------
 * Credit costs for various planning operations.
 */
export const PLANNING_COSTS = {
  SCRAPE_COST: 5,
  PLAN_COST: 10,
  DEEP_CRAWL_COST: 20,
} as const

/**
 * Pipeline Timeouts
 * -----------------
 * Default timeout values for different pipeline stages.
 */
export const STAGE_TIMEOUTS = {
  idea_understanding: 30000,    // 30 seconds
  website_understanding: 45000, // 45 seconds
  research: 45000,              // 45 seconds
  planning: 60000,              // 60 seconds
  critique: 30000,              // 30 seconds
  repair: 30000,                // 30 seconds
  validation: 10000,            // 10 seconds
  sanitization: 5000,           // 5 seconds
} as const

/**
 * Rate Limits
 * -----------
 * Rate limiting constraints for planning operations.
 */
export const RATE_LIMITS = {
  PLANNING_REQUESTS_PER_HOUR: 10,
  PLANNING_REQUESTS_PER_DAY: 50,
  MAX_IDEA_LENGTH: 5000,
  MIN_IDEA_LENGTH: 50,
} as const
