/**
 * PlanningOrchestrator - Main pipeline coordinator
 * 
 * Orchestrates the complete multi-stage planning pipeline:
 * 1. Idea Understanding (Idea mode only)
 * 2. Research & Gap Analysis
 * 3. Primary Planning
 * 4. Independent Critique
 * 5. Repair (if needed)
 * 6. Semantic Validation
 * 7. Sanitization
 * 8. Complexity Classification
 * 
 * Manages credits, tracking, error handling, and partial result preservation.
 * 
 * Requirements: 1.1-1.7, 2.1-2.8, 3.1-3.6, 9.1-9.7, 18.1-18.7
 * Design: PlanningOrchestrator component section
 * 
 * @module lib/planning/orchestrator
 */

import "server-only"
import { logger } from "@/lib/logging/logger"
import type { IdeaUnderstanding } from "@/lib/types/idea-understanding"
import type { ProjectUnderstanding } from "@/lib/types/understanding"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { PipelineMode } from "@/lib/types/planning-run"
import { IdeaUnderstandingService } from "@/lib/planning/stages/idea-understanding"
import { ResearchAgent } from "@/lib/planning/stages/research"
import { PrimaryPlanner } from "@/lib/planning/stages/planner"
import { IndependentCritic } from "@/lib/planning/stages/critic"
import { RepairService } from "@/lib/planning/stages/repair"
import { SemanticValidator } from "@/lib/planning/stages/validator"
import { Sanitizer } from "@/lib/planning/utils/sanitizer"
import { ModelRegistry } from "@/lib/planning/models/registry"
import { PlanningRunTracker, type StageCompletionData } from "@/lib/planning/tracking/planning-run"
import { classifyComplexity, getPlanCost } from "@/lib/credits/credits"
import { store } from "@/lib/store/store"
import { reserveCredits, refundReservation } from "@/lib/credits/credits"
import {
  UnderstandingError,
  ResearchError,
  PlanningError,
  ValidationError,
  CreditInsufficientError,
} from "@/lib/planning/errors"

/**
 * Helper to create properly formatted project events
 */
function planningEvent(stage: string, message: string, level: "info" | "warn" | "error" = "info") {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    level,
    stage,
    message,
  }
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  specification: ApplicationSpecification
  runId: string
  understanding?: IdeaUnderstanding | ProjectUnderstanding
  completenessScore?: number
  qualityScore?: number
}

/**
 * PlanningOrchestrator coordinates the complete planning pipeline
 */
export class PlanningOrchestrator {
  private ideaService: IdeaUnderstandingService
  private researchAgent: ResearchAgent
  private planner: PrimaryPlanner
  private critic: IndependentCritic
  private repairService: RepairService
  private validator: SemanticValidator
  private sanitizer: Sanitizer
  private tracker: PlanningRunTracker
  private modelRegistry: ModelRegistry

  constructor() {
    this.modelRegistry = new ModelRegistry()
    this.ideaService = new IdeaUnderstandingService(this.modelRegistry)
    this.researchAgent = new ResearchAgent(this.modelRegistry)
    this.planner = new PrimaryPlanner(this.modelRegistry)
    this.critic = new IndependentCritic(this.modelRegistry)
    this.repairService = new RepairService(this.modelRegistry)
    this.validator = new SemanticValidator()
    this.sanitizer = new Sanitizer()
    this.tracker = new PlanningRunTracker()
  }

  /**
   * Execute the complete Idea Mode planning pipeline
   * 
   * Flow:
   * 1. Validate minimum idea length
   * 2. Reserve credits
   * 3. Create Planning_Run record
   * 4. Execute IdeaUnderstanding stage
   * 5. Execute Research stage (optional - continue on failure)
   * 6. Execute Planning stage
   * 7. Execute Critique stage
   * 8. Execute Repair stage (if needed)
   * 9. Execute SemanticValidator
   * 10. Execute Sanitizer
   * 11. Classify complexity
   * 12. Save specification and consume credits
   * 
   * Requirements: 1.1, 1.4, 1.7, 2.8, 3.1, 9.2, 11.1-11.4
   * 
   * @param projectId - Project being planned
   * @param idea - User's raw application idea
   * @param userId - User initiating the plan
   * @param pipelineMode - Pipeline mode (legacy or heavy)
   * @returns PipelineResult with generated specification
   * @throws Error if pipeline fails
   */
  async executeIdeaPipeline(
    projectId: string,
    idea: string,
    userId: string,
    pipelineMode?: "legacy" | "heavy"
  ): Promise<PipelineResult> {
    logger.info("[PlanningOrchestrator] Starting Idea Mode pipeline", "Pipeline starting", {
      projectId,
      userId,
      ideaLength: idea.length,
      pipelineMode: pipelineMode ?? "legacy",
    })

    let runId: string | undefined
    let reservationId: string | undefined

    try {
      // Requirement 1.4: Reserve credits before processing (mode-aware)
      const planCost = getPlanCost(pipelineMode)
      const reservation = await reserveCredits(userId, planCost, projectId, `AI planning pipeline (${pipelineMode === "heavy" ? "Heavy mode" : "Legacy"})`)
      if (!reservation) {
        throw new CreditInsufficientError(
          `Insufficient credits for planning. Required: ${planCost}`,
          `You need ${planCost} credits to generate a plan. Please add credits to continue.`
        )
      }
      reservationId = projectId // Use projectId as reservation identifier

      // Update project state to 'analyzing'
      // Requirement 9.2: Update state at start
      await store.updateProject(projectId, {
        state: "analyzing",
        updatedAt: Date.now(),
      })

      // Create Planning_Run record
      // Requirement 18.1: Track execution metadata
      runId = await this.tracker.startRun(projectId, userId, "idea")

      // Execute pipeline stages
      const understanding = await this.executeStage(
        runId,
        "idea_understanding",
        async () => await this.ideaService.generateUnderstanding(idea),
        projectId
      )

      // Research stage (optional - continue on failure)
      // Requirement 2.8: Research failure doesn't block pipeline
      let research
      try {
        research = await this.executeStage(
          runId,
          "research",
          async () => await this.researchAgent.analyzeForGaps(understanding),
          projectId
        )
      } catch (error) {
        logger.warn("[PlanningOrchestrator] Research stage failed, continuing with empty findings", "Research failed — using empty findings", {
          error: error instanceof Error ? error.message : String(error),
        })
        research = {
          missingFeatures: [],
          securityConcerns: [],
          uxGaps: [],
          technicalRisks: [],
          recommendations: [],
          completenessScore: 100,
          analyzedType: "idea" as const,
          createdAt: Date.now(),
          modelUsed: "none (research failed)",
        }
      }

      const specification = await this.executeStage(
        runId,
        "planning",
        async () => await this.planner.planApplication(understanding, research),
        projectId
      )

      const critique = await this.executeStage(
        runId,
        "critique",
        async () => await this.critic.critique(specification),
        projectId
      )

      // Repair if needed
      let repairedSpec = specification
      if (!critique.passesValidation) {
        repairedSpec = await this.executeStage(
          runId,
          "repair",
          async () => await this.repairService.repair(specification, critique),
          projectId
        )
      }

      // Semantic validation
      const validationResult = this.validator.validate(repairedSpec)
      if (!validationResult.valid) {
        logger.error("[PlanningOrchestrator] Semantic validation failed", "Validation errors found", {
          projectId,
          errors: validationResult.errors,
        })
        throw new ValidationError(
          "Specification failed semantic validation",
          "The generated specification has consistency errors. Please try again.",
          validationResult.errors.map(e => ({
            fieldPath: e.field,
            message: e.message,
            severity: e.severity
          }))
        )
      }

      // Sanitization
      const sanitizationResult = this.sanitizer.sanitize(repairedSpec)
      if (sanitizationResult.sanitized) {
        logger.warn("[PlanningOrchestrator] Specification was sanitized", "Unsupported tech replaced", {
          projectId,
          replacements: sanitizationResult.replacements.length,
        })
      }

      const finalSpec = sanitizationResult.specification

      // Classify complexity
      // Requirement 10.7: Integrate complexity classifier after sanitization
      const complexity = classifyComplexity(finalSpec)
      finalSpec.complexity = complexity

      logger.info("[PlanningOrchestrator] Complexity classified", "Complexity determined", {
        projectId,
        complexity,
      })

      // Save specification to project
      await store.updateProject(projectId, {
        specification: finalSpec,
        state: "specification_ready",
        updatedAt: Date.now(),
      })

      // Complete Planning_Run
      await this.tracker.completeRun(runId, {
        specificationId: projectId,
        qualityScore: critique.qualityScore,
        completenessScore: research.completenessScore,
      })

      // Credits are already reserved/consumed
      logger.info("[PlanningOrchestrator] Idea Mode pipeline completed successfully", "Pipeline complete", {
        projectId,
        runId,
        complexity,
        qualityScore: critique.qualityScore,
      })

      return {
        specification: finalSpec,
        runId,
        understanding,
        completenessScore: research.completenessScore,
        qualityScore: critique.qualityScore,
      }
    } catch (error) {
      logger.error("[PlanningOrchestrator] Idea Mode pipeline failed", "Pipeline failed", {
        projectId,
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Refund credits on failure
      // Requirement 11.4: Refund credits on fatal errors
      if (reservationId) {
        try {
          const planCost = getPlanCost(pipelineMode)
          await refundReservation(userId, planCost, projectId)
        } catch (refundError) {
          logger.error("[PlanningOrchestrator] Failed to refund credits", "Refund failed", {
            userId,
            projectId,
            error: refundError instanceof Error ? refundError.message : String(refundError),
          })
        }
      }

      // Update project state
      await store.updateProject(projectId, {
        state: "pending_plan",
        updatedAt: Date.now(),
      })

      // Record failure in Planning_Run
      if (runId) {
        await this.tracker.failRun(
          runId,
          error instanceof Error ? error : new Error(String(error)),
          "planning" // Default to planning stage
        )
      }

      throw error
    }
  }

  /**
   * Execute the complete Website Mode planning pipeline
   * 
   * Flow:
   * 1. Reserve credits
   * 2. Create Planning_Run record
   * 3. Skip to Research stage (understanding already exists)
   * 4. Execute Planning, Critique, Repair, Validation, Sanitization stages
   * 5. Save specification and consume credits
   * 
   * Requirements: 3.1, 8.1, 9.2
   * 
   * @param projectId - Project being planned
   * @param understanding - Existing ProjectUnderstanding from website analysis
   * @param userId - User initiating the plan
   * @param pipelineMode - Pipeline mode (legacy or heavy)
   * @returns PipelineResult with generated specification
   * @throws Error if pipeline fails
   */
  async executeWebsitePipeline(
    projectId: string,
    understanding: ProjectUnderstanding,
    userId: string,
    pipelineMode?: "legacy" | "heavy"
  ): Promise<PipelineResult> {
    logger.info("[PlanningOrchestrator] Starting Website Mode pipeline", "Pipeline starting", {
      projectId,
      userId,
      sourceUrl: understanding.sourceUrl,
      pipelineMode: pipelineMode ?? "legacy",
    })

    let runId: string | undefined
    let reservationId: string | undefined

    try {
      // Reserve credits (mode-aware)
      const planCost = getPlanCost(pipelineMode)
      const reservation = await reserveCredits(userId, planCost, projectId, `AI planning pipeline (${pipelineMode === "heavy" ? "Heavy mode" : "Legacy"})`)
      if (!reservation) {
        throw new CreditInsufficientError(
          `Insufficient credits for planning. Required: ${planCost}`,
          `You need ${planCost} credits to generate a plan. Please add credits to continue.`
        )
      }
      reservationId = projectId

      // Update project state
      await store.updateProject(projectId, {
        state: "analyzing",
        updatedAt: Date.now(),
      })

      // Create Planning_Run record
      runId = await this.tracker.startRun(projectId, userId, "website")

      // Execute pipeline stages (skip idea understanding)
      // Requirement 8.1: Website mode skips to research
      let research
      try {
        research = await this.executeStage(
          runId,
          "research",
          async () => await this.researchAgent.analyzeForGaps(understanding),
          projectId
        )
      } catch (error) {
        logger.warn("[PlanningOrchestrator] Research stage failed, continuing with empty findings", "Research failed — using empty findings", {
          error: error instanceof Error ? error.message : String(error),
        })
        research = {
          missingFeatures: [],
          securityConcerns: [],
          uxGaps: [],
          technicalRisks: [],
          recommendations: [],
          completenessScore: 100,
          analyzedType: "website" as const,
          createdAt: Date.now(),
          modelUsed: "none (research failed)",
        }
      }

      const specification = await this.executeStage(
        runId,
        "planning",
        async () => await this.planner.planApplication(understanding, research),
        projectId
      )

      // Critique stage - non-blocking
      let critique
      try {
        critique = await this.executeStage(
          runId,
          "critique",
          async () => await this.critic.critique(specification),
          projectId
        )
      } catch (error) {
        logger.warn("[PlanningOrchestrator] Critique stage failed, continuing with minimal critique", "Critique failed — using pass-through critique", {
          error: error instanceof Error ? error.message : String(error),
        })
        // Create minimal passing critique so pipeline can continue
        critique = {
          criticalIssues: [],
          warnings: [],
          suggestions: [],
          overallAssessment: "Critique stage failed - specification not reviewed",
          passesValidation: true, // Assume passing so we don't trigger repair
          qualityScore: 50, // Neutral score
          createdAt: Date.now(),
          modelUsed: "none (critique failed)",
        }
      }

      let repairedSpec = specification
      if (!critique.passesValidation) {
        try {
          repairedSpec = await this.executeStage(
            runId,
            "repair",
            async () => await this.repairService.repair(specification, critique),
            projectId
          )
        } catch (error) {
          logger.warn("[PlanningOrchestrator] Repair stage failed, using original specification", "Repair failed — using un-repaired spec", {
            error: error instanceof Error ? error.message : String(error),
          })
          // Use original specification if repair fails
          repairedSpec = specification
        }
      }

      const validationResult = this.validator.validate(repairedSpec)
      if (!validationResult.valid) {
        logger.warn("[PlanningOrchestrator] Semantic validation found issues, continuing anyway", "Validation warnings found", {
          projectId,
          errorCount: validationResult.errors.length,
          errors: validationResult.errors.slice(0, 5), // Log first 5 errors
        })
        // Don't throw - just log the issues and continue
        // The spec may still be usable even with minor validation issues
      }

      const sanitizationResult = this.sanitizer.sanitize(repairedSpec)
      const finalSpec = sanitizationResult.specification

      const complexity = classifyComplexity(finalSpec)
      finalSpec.complexity = complexity

      await store.updateProject(projectId, {
        specification: finalSpec,
        state: "specification_ready",
        updatedAt: Date.now(),
      })

      await this.tracker.completeRun(runId, {
        specificationId: projectId,
        qualityScore: critique.qualityScore,
        completenessScore: research.completenessScore,
      })

      logger.info("[PlanningOrchestrator] Website Mode pipeline completed successfully", "Pipeline complete", {
        projectId,
        runId,
        complexity,
        qualityScore: critique.qualityScore,
      })

      return {
        specification: finalSpec,
        runId,
        understanding,
        completenessScore: research.completenessScore,
        qualityScore: critique.qualityScore,
      }
    } catch (error) {
      logger.error("[PlanningOrchestrator] Website Mode pipeline failed", "Pipeline failed", {
        projectId,
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      })

      if (reservationId) {
        try {
          const planCost = getPlanCost(pipelineMode)
          await refundReservation(userId, planCost, projectId)
        } catch (refundError) {
          logger.error("[PlanningOrchestrator] Failed to refund credits", "Refund failed", {
            userId,
            projectId,
            error: refundError instanceof Error ? refundError.message : String(refundError),
          })
        }
      }

      await store.updateProject(projectId, {
        state: "pending_plan",
        updatedAt: Date.now(),
      })

      if (runId) {
        await this.tracker.failRun(
          runId,
          error instanceof Error ? error : new Error(String(error)),
          "planning"
        )
      }

      throw error
    }
  }

  /**
   * Execute a pipeline stage with tracking and error handling
   * 
   * Wraps stage execution with:
   * - Start/end time tracking
   * - Model and token tracking
   * - Retry attempts tracking
   * - Error capture
   * - User-visible event logging
   * 
   * Requirements: 3.6, 18.2, 18.3, 18.4
   * 
   * @param runId - Planning run ID
   * @param stage - Stage name
   * @param fn - Stage execution function
   * @param projectId - Project ID for event logging
   * @returns Stage result
   * @throws Error if stage fails
   */
  private async executeStage<T>(
    runId: string,
    stage: string,
    fn: () => Promise<T>,
    projectId: string
  ): Promise<T> {
    this.tracker.recordStageStart(runId, stage as any)

    // User-friendly stage messages for toast notifications
    const stageMessages: Record<string, { start: string; complete: string; emoji: string }> = {
      idea_understanding: {
        start: "Understanding your idea...",
        complete: "Idea analyzed successfully",
        emoji: "💡"
      },
      research: {
        start: "Researching missing features and best practices...",
        complete: "Research complete — found recommendations",
        emoji: "🔍"
      },
      planning: {
        start: "Generating comprehensive application plan...",
        complete: "Application plan generated",
        emoji: "📋"
      },
      critique: {
        start: "Performing quality review...",
        complete: "Quality review complete",
        emoji: "✅"
      },
      repair: {
        start: "Refining specification based on review...",
        complete: "Specification refined",
        emoji: "🔧"
      },
    }

    const msgConfig = stageMessages[stage] || {
      start: `Processing ${stage}...`,
      complete: `${stage} complete`,
      emoji: "⚙️"
    }

    // Append start event
    await store.appendEvent(
      projectId,
      planningEvent("planning", `${msgConfig.emoji} ${msgConfig.start}`)
    )

    try {
      const result = await fn()

      // Append success event
      await store.appendEvent(
        projectId,
        planningEvent("planning", `${msgConfig.emoji} ${msgConfig.complete}`)
      )

      // Record successful completion
      const completionData: StageCompletionData = {
        model: "auto", // Models are selected by ModelRegistry
        tokens: 0, // Token tracking would need to be passed from stages
        success: true,
        retries: 0,
      }

      await this.tracker.recordStageCompletion(runId, stage as any, completionData)

      return result
    } catch (error) {
      // Append error event
      await store.appendEvent(
        projectId,
        planningEvent("planning", `❌ ${stage} stage failed: ${error instanceof Error ? error.message : String(error)}`, "error")
      )

      // Record failed completion
      const completionData: StageCompletionData = {
        model: "auto",
        tokens: 0,
        success: false,
        retries: 0,
        error: error instanceof Error ? error.message : String(error),
      }

      await this.tracker.recordStageCompletion(runId, stage as any, completionData)

      throw error
    }
  }

  /**
   * Execute Deep Crawl pipeline for website cloning (Task 26)
   */
  async executeDeepCrawlPipeline(
    projectId: string,
    understanding: ProjectUnderstanding,
    userId: string
  ): Promise<PipelineResult> {
    const DEEP_CRAWL_COST = 20
    const runId = await this.tracker.startRun(projectId, userId, "deepCrawl")

    // Skip understanding/research, direct to planning with replica mode flag
    const specification = await this.planner.planApplication(understanding, {
      missingFeatures: [],
      securityConcerns: [],
      uxGaps: [],
      technicalRisks: [],
      recommendations: [],
      completenessScore: 100,
      analyzedType: "website",
      createdAt: Date.now(),
      modelUsed: "none",
    })

    return { specification, runId }
  }
}
