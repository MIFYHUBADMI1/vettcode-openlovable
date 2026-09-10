import { cryptoId } from "@/lib/store/id"
import { planningRunsCol } from "@/lib/db/collections"
import type { PlanningRunDoc } from "@/lib/types/db"
import type {
  PlanningRun,
  PipelineMode,
  PipelineStage,
  StageResult,
  RunOutcome,
} from "@/lib/types/planning-run"
import { logger } from "@/lib/logging/logger"

/**
 * Data the caller provides when a stage completes.
 * The tracker merges this with the stored start time to build StageResult.
 *
 * Requirements: 18.3, 18.4
 */
export interface StageCompletionData {
  /** AI model identifier that executed this stage (e.g. "anthropic/claude-3.5-sonnet"). */
  model: string
  /** Total tokens consumed by this stage (input + output). */
  tokens: number
  /** Whether the stage completed successfully. */
  success: boolean
  /** Number of retry attempts made before success or final failure. */
  retries?: number
  /** Error message if the stage failed. */
  error?: string
}

/**
 * PlanningRunTracker
 * ------------------
 * Records execution metadata for planning pipeline runs, capturing timing,
 * model usage, and stage-by-stage results for observability and debugging
 * (Requirements 18.1-18.8).
 *
 * Key responsibilities:
 * - Create Planning_Run records at pipeline start (Req 18.1)
 * - Track stage start times so callers don't manage timing themselves (Req 18.3)
 * - Track stage completions with model/token/duration data (Req 18.2, 18.3)
 * - Track retry attempts per stage (Req 18.4)
 * - Record pipeline outcomes and failures (Req 18.5)
 * - Store with 90-day TTL for performance monitoring (Req 18.6)
 */
export class PlanningRunTracker {
  /**
   * In-memory store of stage start timestamps.
   * Key: `${runId}:${stage}` — cleared when the stage result is persisted.
   */
  private readonly stageStartTimes = new Map<string, number>()
  /**
   * Create a new Planning_Run record at the start of pipeline execution.
   *
   * Requirements: 18.1, 18.2
   *
   * @param projectId - The project being planned
   * @param userId - The user initiating the plan
   * @param mode - The planning mode (idea | website | deepCrawl)
   * @returns The unique run ID for tracking
   */
  async startRun(
    projectId: string,
    userId: string,
    mode: PipelineMode
  ): Promise<string> {
    const runId = cryptoId()
    const now = Date.now()

    const doc = {
      id: runId,
      projectId,
      userId,
      mode,
      startedAt: now,
      status: "running" as const,
      stageResults: [],
      totalTokens: 0,
      totalDurationMs: 0,
      createdAt: now,
    }

    try {
      const col = await planningRunsCol()
      await col.insertOne(doc as unknown as PlanningRunDoc)

      logger.info("planning.run.started", `Planning run started: ${runId}`, {
        runId,
        projectId,
        userId,
        mode,
      })

      return runId
    } catch (error) {
      logger.error("planning.run.start_failed", "Failed to create planning run", {
        runId,
        projectId,
        userId,
        mode,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Record the start of a pipeline stage, capturing the start timestamp.
   * Call this immediately before invoking the stage's AI/processing work.
   *
   * Requirements: 18.3
   *
   * @param runId - The planning run ID
   * @param stage - The stage that is starting
   */
  recordStageStart(runId: string, stage: PipelineStage): void {
    const key = `${runId}:${stage}`
    this.stageStartTimes.set(key, Date.now())

    logger.info("planning.stage.started", `Stage ${stage} started`, {
      runId,
      stage,
    })
  }

  /**
   * Record the completion of a pipeline stage with model, token, and retry data.
   * Uses the start time recorded by recordStageStart to compute durationMs
   * automatically — callers do not need to track timing themselves.
   *
   * If recordStageStart was not called for this stage, falls back to the
   * current timestamp so durationMs will be 0 rather than crashing.
   *
   * Requirements: 18.2, 18.3, 18.4
   *
   * @param runId - The planning run ID
   * @param stage - The stage that completed
   * @param data - Completion data: model used, tokens consumed, success flag, retry count, error
   */
  async recordStageCompletion(
    runId: string,
    stage: PipelineStage,
    data: StageCompletionData
  ): Promise<void> {
    const key = `${runId}:${stage}`
    const startedAt = this.stageStartTimes.get(key) ?? Date.now()
    const completedAt = Date.now()
    const durationMs = completedAt - startedAt

    // Clean up the in-memory entry now that we have the duration
    this.stageStartTimes.delete(key)

    const result: StageResult = {
      stage,
      model: data.model,
      startedAt,
      completedAt,
      durationMs,
      tokens: data.tokens,
      success: data.success,
      retries: data.retries ?? 0,
      error: data.error,
    }

    try {
      const col = await planningRunsCol()

      // Push the full stage result and increment run-level totals
      await col.updateOne(
        { id: runId },
        {
          $push: { stageResults: result },
          $inc: {
            totalTokens: result.tokens,
            totalDurationMs: result.durationMs,
          },
        }
      )

      logger.info("planning.stage.completed", `Stage ${stage} completed`, {
        runId,
        stage,
        model: result.model,
        durationMs: result.durationMs,
        tokens: result.tokens,
        success: result.success,
        retries: result.retries,
      })
    } catch (error) {
      logger.error("planning.stage.record_failed", "Failed to record stage completion", {
        runId,
        stage,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - we don't want tracking failures to break the pipeline
    }
  }

  /**
   * Mark a planning run as successfully completed with outcome metadata.
   *
   * Requirements: 18.2, 18.5
   *
   * @param runId - The planning run ID
   * @param outcome - Final outcome with quality metrics
   */
  async completeRun(runId: string, outcome: RunOutcome): Promise<void> {
    try {
      const col = await planningRunsCol()
      const now = Date.now()

      await col.updateOne(
        { id: runId },
        {
          $set: {
            status: "completed",
            completedAt: now,
            outcome,
          },
        }
      )

      logger.info("planning.run.completed", `Planning run completed: ${runId}`, {
        runId,
        specificationId: outcome.specificationId,
        qualityScore: outcome.qualityScore,
      })
    } catch (error) {
      logger.error("planning.run.complete_failed", "Failed to mark run as completed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - we don't want tracking failures to break the pipeline
    }
  }

  /**
   * Mark a planning run as failed with error details and the failing stage.
   *
   * Requirements: 18.5
   *
   * @param runId - The planning run ID
   * @param error - The error that caused failure
   * @param failedStage - The stage where failure occurred
   */
  async failRun(
    runId: string,
    error: Error,
    failedStage: PipelineStage
  ): Promise<void> {
    try {
      const col = await planningRunsCol()
      const now = Date.now()

      const errorMessage = error.message || String(error)

      await col.updateOne(
        { id: runId },
        {
          $set: {
            status: "failed",
            completedAt: now,
            error: errorMessage,
          },
        }
      )

      logger.error("planning.run.failed", `Planning run failed: ${runId}`, {
        runId,
        failedStage,
        error: errorMessage,
      })
    } catch (err) {
      logger.error("planning.run.fail_record_failed", "Failed to mark run as failed", {
        runId,
        failedStage,
        originalError: error.message,
        recordError: err instanceof Error ? err.message : String(err),
      })
      // Don't throw - we don't want tracking failures to break error handling
    }
  }

  /**
   * Retrieve a planning run by ID for monitoring and debugging.
   *
   * Requirements: 18.7
   *
   * @param runId - The planning run ID
   * @returns The planning run data or null if not found
   */
  async getRun(runId: string): Promise<PlanningRun | null> {
    try {
      const col = await planningRunsCol()
      const doc = await col.findOne({ id: runId })

      if (!doc) {
        return null
      }

      // Convert MongoDB document to PlanningRun type
      return {
        id: doc.id,
        projectId: doc.projectId,
        userId: doc.userId,
        mode: doc.mode,
        startedAt: doc.startedAt,
        completedAt: doc.completedAt,
        status: doc.status,
        stageResults: doc.stageResults as StageResult[],
        totalTokens: doc.totalTokens,
        totalDurationMs: doc.totalDurationMs,
        outcome: doc.outcome as RunOutcome | undefined,
        error: doc.error,
        createdAt: doc.createdAt,
      }
    } catch (error) {
      logger.error("planning.run.get_failed", "Failed to retrieve planning run", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Retrieve planning runs for a specific project.
   *
   * Requirements: 18.7
   *
   * @param projectId - The project ID
   * @param limit - Maximum number of runs to return (default: 10)
   * @returns Array of planning runs
   */
  async getByProjectId(projectId: string, limit = 10): Promise<PlanningRun[]> {
    try {
      const col = await planningRunsCol()
      const docs = await col
        .find({ projectId })
        .sort({ startedAt: -1 })
        .limit(limit)
        .toArray()

      return docs.map((doc) => ({
        id: doc.id,
        projectId: doc.projectId,
        userId: doc.userId,
        mode: doc.mode,
        startedAt: doc.startedAt,
        completedAt: doc.completedAt,
        status: doc.status,
        stageResults: doc.stageResults as StageResult[],
        totalTokens: doc.totalTokens,
        totalDurationMs: doc.totalDurationMs,
        outcome: doc.outcome as RunOutcome | undefined,
        error: doc.error,
        createdAt: doc.createdAt,
      }))
    } catch (error) {
      logger.error("planning.run.get_by_project_failed", "Failed to retrieve planning runs by project", {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Retrieve planning runs for a specific user.
   *
   * Requirements: 18.7
   *
   * @param userId - The user ID
   * @param limit - Maximum number of runs to return (default: 10)
   * @returns Array of planning runs
   */
  async getByUserId(userId: string, limit = 10): Promise<PlanningRun[]> {
    try {
      const col = await planningRunsCol()
      const docs = await col
        .find({ userId })
        .sort({ startedAt: -1 })
        .limit(limit)
        .toArray()

      return docs.map((doc) => ({
        id: doc.id,
        projectId: doc.projectId,
        userId: doc.userId,
        mode: doc.mode,
        startedAt: doc.startedAt,
        completedAt: doc.completedAt,
        status: doc.status,
        stageResults: doc.stageResults as StageResult[],
        totalTokens: doc.totalTokens,
        totalDurationMs: doc.totalDurationMs,
        outcome: doc.outcome as RunOutcome | undefined,
        error: doc.error,
        createdAt: doc.createdAt,
      }))
    } catch (error) {
      logger.error("planning.run.get_by_user_failed", "Failed to retrieve planning runs by user", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }
}
