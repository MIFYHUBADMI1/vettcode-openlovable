/**
 * Error taxonomy for the AI Planning Pipeline
 * Provides structured error classes for each pipeline stage and failure type
 *
 * Requirements: 11.3
 * Design: Error Taxonomy section
 */

// ─── Base Class ───────────────────────────────────────────────────────────────

/**
 * Base class for all planning pipeline errors.
 * Carries the stage name and an optional planning-run identifier so that
 * callers and logging infra can correlate errors to specific executions.
 */
export class PipelineError extends Error {
  /** The pipeline stage that produced this error (e.g. 'understanding', 'research') */
  readonly stage: string

  /** Human-readable message shown to the end-user (may differ from technical `message`) */
  readonly userMessage: string

  /** Whether the error is expected to be transient and worth retrying */
  readonly retryable: boolean

  /** Optional reference to the Planning_Run record in progress when the error occurred */
  readonly runId?: string

  constructor(
    message: string,
    stage: string,
    retryable: boolean,
    userMessage: string,
    runId?: string,
  ) {
    super(message)
    this.name = 'PipelineError'
    this.stage = stage
    this.retryable = retryable
    this.userMessage = userMessage
    this.runId = runId

    // Restore prototype chain (required when extending built-in Error in TS)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Stage-Specific Errors ────────────────────────────────────────────────────

/**
 * Thrown when the Idea or Website understanding stage fails to produce a
 * structured understanding object from user input or crawled evidence.
 *
 * Classified as RETRYABLE — the underlying AI call may succeed on retry.
 */
export class UnderstandingError extends PipelineError {
  constructor(message: string, runId?: string) {
    super(
      message,
      'understanding',
      true,
      'We had trouble analysing your idea. Please try again.',
      runId,
    )
    this.name = 'UnderstandingError'
  }
}

/**
 * Thrown when the ResearchAgent fails to analyse the understanding object for
 * product gaps, security concerns, or technical risks.
 *
 * Classified as RETRYABLE — the research stage is also optional in the
 * pipeline, so the orchestrator may choose to continue with empty findings.
 */
export class ResearchError extends PipelineError {
  constructor(message: string, runId?: string) {
    super(
      message,
      'research',
      true,
      'Research analysis encountered an issue. Pipeline will continue with partial results.',
      runId,
    )
    this.name = 'ResearchError'
  }
}

/**
 * Thrown when the PrimaryPlanner fails to generate an ApplicationSpecification.
 *
 * Classified as RETRYABLE — transient AI-provider errors are the most common cause.
 */
export class PlanningError extends PipelineError {
  constructor(message: string, runId?: string) {
    super(
      message,
      'planning',
      true,
      'Specification generation failed. Please try again.',
      runId,
    )
    this.name = 'PlanningError'
  }
}

/**
 * Thrown when the IndependentCritic fails to produce a CritiqueReport.
 *
 * Classified as RETRYABLE — a fresh AI call may produce a valid report.
 */
export class CritiqueError extends PipelineError {
  constructor(message: string, runId?: string) {
    super(
      message,
      'critique',
      true,
      'Specification critique encountered an issue. Please try again.',
      runId,
    )
    this.name = 'CritiqueError'
  }
}

/**
 * Thrown when the RepairService fails to address issues identified by the critic.
 *
 * Classified as RETRYABLE — the repair prompt may succeed on a subsequent attempt.
 */
export class RepairError extends PipelineError {
  constructor(message: string, runId?: string) {
    super(
      message,
      'repair',
      true,
      'Automatic repair of specification issues failed. Please try again.',
      runId,
    )
    this.name = 'RepairError'
  }
}

// ─── Structured Validation Error ──────────────────────────────────────────────

/**
 * Describes a single validation issue, optionally anchored to a specific
 * field within the specification using JSONPath notation.
 */
export interface ValidationIssue {
  /** JSONPath to the offending field, e.g. `$.dataEntities[2].name` */
  fieldPath: string
  /** Human-readable explanation of why the field is invalid */
  message: string
  /** Severity level of this particular issue */
  severity: 'critical' | 'warning'
}

/**
 * Thrown when the SemanticValidator (or schema parsing) finds one or more
 * structural or semantic inconsistencies in an ApplicationSpecification.
 *
 * Carries a structured `details` array so callers can surface precise field
 * paths to the user or to the RepairService.
 *
 * Classified as NON_RETRYABLE — the spec itself must be corrected; retrying
 * the same input will produce the same errors.
 */
export class ValidationError extends PipelineError {
  /** Structured list of individual validation issues with field paths */
  readonly details: ValidationIssue[]

  constructor(message: string, details: ValidationIssue[] = [], runId?: string) {
    super(
      message,
      'validation',
      false,
      'Generated specification has validation errors. See details for affected fields.',
      runId,
    )
    this.name = 'ValidationError'
    this.details = details
  }
}

// ─── Billing Error ────────────────────────────────────────────────────────────

/**
 * Thrown when the user does not have enough credits to cover the cost of a
 * planning operation.
 *
 * Classified as FATAL — retrying will not resolve the billing shortfall.
 * The pipeline should halt immediately and refund any reserved credits.
 */
export class CreditInsufficientError extends PipelineError {
  /** Number of credits required for the operation */
  readonly required: number
  /** Number of credits currently available to the user */
  readonly available: number

  constructor(required: number, available: number, runId?: string) {
    super(
      `Insufficient credits: required ${required}, available ${available}`,
      'credit_check',
      false,
      `Insufficient credits. Please add ${required - available} more credits to continue.`,
      runId,
    )
    this.name = 'CreditInsufficientError'
    this.required = required
    this.available = available
  }
}

// ─── Transient / Infrastructure Errors ────────────────────────────────────────

/**
 * Thrown when an AI provider responds with a rate-limit error (HTTP 429 or
 * equivalent).
 *
 * Classified as RETRYABLE — exponential back-off should resolve it.
 */
export class RateLimitError extends PipelineError {
  constructor(message = 'Rate limit exceeded', runId?: string) {
    super(
      message,
      'ai_provider',
      true,
      'The AI service is currently busy. Retrying shortly…',
      runId,
    )
    this.name = 'RateLimitError'
  }
}

/**
 * Thrown when an operation exceeds its configured time budget.
 *
 * Classified as RETRYABLE — a subsequent attempt may complete within the
 * allowed window, especially after the back-off delay.
 *
 * NOTE: `retry.ts` also exports a `TimeoutError` for internal timeout
 * wrapping. Both share the same `name` so that `classifyError` can match
 * either without importing from both files.
 */
export class TimeoutError extends PipelineError {
  constructor(message = 'Operation timed out', runId?: string) {
    super(
      message,
      'timeout',
      true,
      'The operation took too long. Retrying…',
      runId,
    )
    this.name = 'TimeoutError'
  }
}
