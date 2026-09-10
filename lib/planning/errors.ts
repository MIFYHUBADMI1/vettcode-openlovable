/**
 * Error taxonomy for the AI Planning Pipeline
 * 
 * Defines stage-specific errors with retry behavior and user-friendly messages.
 * Implements Requirement 11.3: Error Handling and Resilience
 * 
 * @module lib/planning/errors
 */

/**
 * Pipeline stages where errors can occur
 */
export type PipelineStage =
  | 'understanding'
  | 'research'
  | 'planning'
  | 'critique'
  | 'repair'
  | 'validation'
  | 'sanitization'
  | 'credit_check'

/**
 * Validation error detail for specific field issues
 */
export interface ValidationErrorDetail {
  /** JSONPath to the invalid field (e.g., "$.dataEntities[2].name") */
  fieldPath: string
  /** Human-readable error message */
  message: string
  /** Severity of the validation issue */
  severity: 'critical' | 'warning'
  /** Current invalid value, if applicable */
  currentValue?: string
  /** Suggested valid value, if applicable */
  suggestedValue?: string
}

/**
 * Base error class for all planning pipeline errors
 * 
 * Provides consistent error handling with stage tracking, retry behavior,
 * and user-friendly messaging.
 */
export class PipelineError extends Error {
  /**
   * Creates a new pipeline error
   * 
   * @param message - Technical error message for logging
   * @param stage - Pipeline stage where the error occurred
   * @param retryable - Whether this error can be retried
   * @param userMessage - User-friendly error message
   */
  constructor(
    message: string,
    public readonly stage: PipelineStage,
    public readonly retryable: boolean,
    public readonly userMessage: string
  ) {
    super(message)
    this.name = 'PipelineError'

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Error during the understanding stage (idea or website analysis)
 * 
 * Thrown when the system cannot generate a structured understanding
 * from user input. This error is retryable.
 */
export class UnderstandingError extends PipelineError {
  /**
   * Creates an understanding stage error
   * 
   * @param message - Technical error message for logging
   * @param userMessage - User-friendly explanation of what went wrong
   */
  constructor(message: string, userMessage: string) {
    super(message, 'understanding', true, userMessage)
    this.name = 'UnderstandingError'
  }
}

/**
 * Error during the research stage (adaptive gap analysis)
 * 
 * Thrown when research analysis fails. This is a non-critical error -
 * the pipeline can continue without research findings.
 */
export class ResearchError extends PipelineError {
  constructor(message: string, userMessage?: string) {
    super(
      message,
      'research',
      true,
      userMessage ?? 'Research analysis encountered an issue but will continue'
    )
    this.name = 'ResearchError'
  }
}

/**
 * Error during the planning stage (specification generation)
 * 
 * Thrown when the primary planner cannot generate a valid
 * ApplicationSpecification. This error is retryable.
 */
export class PlanningError extends PipelineError {
  constructor(message: string, userMessage?: string) {
    super(
      message,
      'planning',
      true,
      userMessage ?? 'Specification generation failed. Please try again.'
    )
    this.name = 'PlanningError'
  }
}

/**
 * Error during validation (semantic consistency check)
 * 
 * Thrown when the generated specification has validation errors.
 * This error is not retryable - the specification needs repair.
 * Includes detailed field-level error information.
 */
export class ValidationError extends PipelineError {
  constructor(
    message: string,
    userMessageOrErrors: string | ValidationErrorDetail[],
    public readonly errors: ValidationErrorDetail[] = []
  ) {
    const userMessage = typeof userMessageOrErrors === 'string'
      ? userMessageOrErrors
      : 'Generated specification has validation errors'
    const errorList = typeof userMessageOrErrors === 'string' ? errors : userMessageOrErrors
    super(message, 'validation', false, userMessage)
    this.errors = errorList
    this.name = 'ValidationError'
  }

  /**
   * Gets all critical validation errors
   */
  getCriticalErrors(): ValidationErrorDetail[] {
    return this.errors.filter(e => e.severity === 'critical')
  }

  /**
   * Gets all warning-level validation errors
   */
  getWarnings(): ValidationErrorDetail[] {
    return this.errors.filter(e => e.severity === 'warning')
  }

  /**
   * Formats errors as a user-readable summary
   */
  formatErrorSummary(): string {
    const critical = this.getCriticalErrors()
    const warnings = this.getWarnings()

    const parts: string[] = []

    if (critical.length > 0) {
      parts.push(`${critical.length} critical issue${critical.length === 1 ? '' : 's'}`)
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`)
    }

    return parts.length > 0
      ? `Validation failed: ${parts.join(', ')}`
      : 'Validation failed'
  }
}

/**
 * Error when user has insufficient credits for an operation
 * 
 * Thrown during credit checks before starting chargeable operations.
 * This error is not retryable - user must add credits first.
 */
export class CreditInsufficientError extends PipelineError {
  constructor(message: string, userMessage: string) {
    super(message, 'credit_check', false, userMessage)
    this.name = 'CreditInsufficientError'
  }
}
