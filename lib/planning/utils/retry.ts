/**
 * Retry utilities for the AI Planning Pipeline
 * Implements error classification, exponential backoff, and timeout handling
 *
 * Requirements: 11.1, 11.2
 * Design: Error Handling Flow, Retry Strategy
 */

import {
  CreditInsufficientError,
  RateLimitError,
  TimeoutError as PipelineTimeoutError,
  ValidationError as PipelineValidationError,
} from './errors'

/**
 * Error type classification for determining retry behavior
 */
export enum ErrorType {
  /** Error is temporary and should be retried (rate limits, timeouts, network issues) */
  RETRYABLE = 'retryable',

  /** Error is permanent and should not be retried (validation errors, invalid input) */
  NON_RETRYABLE = 'non_retryable',

  /** Error is critical and pipeline should halt immediately (credit insufficient, auth failure) */
  FATAL = 'fatal',
}

/**
 * Configuration for retry behavior with exponential backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number

  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number

  /** Maximum delay in milliseconds between retries */
  maxDelayMs: number

  /** Multiplier for exponential backoff (delay *= backoffMultiplier for each retry) */
  backoffMultiplier: number

  /** Timeout in milliseconds for each attempt (optional) */
  timeoutMs?: number
}

/**
 * Default retry configuration based on design requirements
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

/**
 * Classifies an error to determine retry behavior.
 *
 * Checks are ordered from most specific (typed error classes) to least
 * specific (string heuristics) so that named pipeline errors always win.
 *
 * @param error - The error to classify
 * @returns ErrorType indicating whether the error should be retried
 */
export function classifyError(error: Error): ErrorType {
  // ── Typed pipeline errors (highest priority) ──────────────────────────────

  // CreditInsufficientError → FATAL: billing issues must halt the pipeline
  if (error instanceof CreditInsufficientError) {
    return ErrorType.FATAL
  }

  // ValidationError (pipeline) → NON_RETRYABLE: spec must be fixed, not retried
  if (error instanceof PipelineValidationError) {
    return ErrorType.NON_RETRYABLE
  }

  // RateLimitError / PipelineTimeoutError → RETRYABLE
  if (error instanceof RateLimitError || error instanceof PipelineTimeoutError) {
    return ErrorType.RETRYABLE
  }

  // ── String / name heuristics (fallback for non-typed errors) ─────────────

  const errorMessage = error.message.toLowerCase()
  const errorName = error.name.toLowerCase()

  // Fatal errors - halt pipeline immediately
  if (
    errorMessage.includes('insufficient credits') ||
    (errorMessage.includes('credit') && errorMessage.includes('unavailable')) ||
    errorName === 'creditinsufficienterror'
  ) {
    return ErrorType.FATAL
  }

  if (
    errorMessage.includes('authentication failed') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('invalid api key')
  ) {
    return ErrorType.FATAL
  }

  // Non-retryable errors - permanent failures
  if (
    errorName === 'validationerror' ||
    errorName === 'schemaerror' ||
    errorMessage.includes('validation failed') ||
    errorMessage.includes('invalid schema')
  ) {
    return ErrorType.NON_RETRYABLE
  }

  if (
    errorMessage.includes('invalid input') ||
    errorMessage.includes('malformed') ||
    errorMessage.includes('parse error')
  ) {
    return ErrorType.NON_RETRYABLE
  }

  // Retryable errors - temporary issues
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  ) {
    return ErrorType.RETRYABLE
  }

  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorName === 'timeouterror'
  ) {
    return ErrorType.RETRYABLE
  }

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound')
  ) {
    return ErrorType.RETRYABLE
  }

  if (
    errorMessage.includes('503') ||
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('temporarily unavailable')
  ) {
    return ErrorType.RETRYABLE
  }

  if (
    errorMessage.includes('502') ||
    errorMessage.includes('bad gateway') ||
    errorMessage.includes('504') ||
    errorMessage.includes('gateway timeout')
  ) {
    return ErrorType.RETRYABLE
  }

  // Default to retryable for unknown errors (safer to retry than fail permanently)
  return ErrorType.RETRYABLE
}

/**
 * Sleep utility for implementing delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Executes a function with retry logic and exponential backoff
 * 
 * Implements retry strategy with:
 * - Error classification to determine if retry is appropriate
 * - Exponential backoff with configurable multiplier and max delay
 * - Optional timeout for each attempt
 * - Fatal error immediate failure
 * - Max retry limit enforcement
 * 
 * @param fn - The async function to execute with retry logic
 * @param config - Retry configuration (defaults to DEFAULT_RETRY_CONFIG)
 * @returns Promise resolving to the function result
 * @throws The last error encountered if all retries are exhausted
 * 
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   async () => await callAIModel(prompt),
 *   { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 }
 * )
 * ```
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      // Apply timeout if configured
      if (config.timeoutMs) {
        return await executeWithTimeout(fn, config.timeoutMs)
      }

      return await fn()
    } catch (error) {
      lastError = error as Error

      // Classify the error to determine if we should retry
      const errorType = classifyError(lastError)

      // Fatal errors: halt immediately without retrying
      if (errorType === ErrorType.FATAL) {
        throw lastError
      }

      // Non-retryable errors: fail immediately without retrying
      if (errorType === ErrorType.NON_RETRYABLE) {
        throw lastError
      }

      // If this was the last attempt, throw the error
      if (attempt >= config.maxAttempts - 1) {
        throw lastError
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      )

      // Wait before retrying
      await sleep(delay)
    }
  }

  // This should never be reached due to the throw in the loop,
  // but TypeScript requires it for type safety
  throw lastError ?? new Error('Unknown error during retry execution')
}

/**
 * Executes a function with a timeout
 * 
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise resolving to the function result
 * @throws TimeoutError if the function exceeds the timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Set up the timeout
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    // Execute the function
    fn()
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Retry configuration for different pipeline stages (based on design requirements)
 */
export const STAGE_RETRY_CONFIGS: Record<string, RetryConfig> = {
  understanding: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    timeoutMs: 30000, // 30 seconds
  },
  research: {
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
    timeoutMs: 45000, // 45 seconds
  },
  planning: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    timeoutMs: 60000, // 60 seconds
  },
  critique: {
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
    timeoutMs: 30000, // 30 seconds
  },
  repair: {
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
    timeoutMs: 30000, // 30 seconds
  },
  validation: {
    maxAttempts: 1, // Validation should not be retried
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    timeoutMs: 10000, // 10 seconds
  },
  sanitization: {
    maxAttempts: 1, // Sanitization should not be retried
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    timeoutMs: 5000, // 5 seconds
  },
}
