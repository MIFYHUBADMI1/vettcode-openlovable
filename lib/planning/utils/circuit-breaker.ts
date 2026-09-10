/**
 * Circuit Breaker Pattern implementation for external service resilience
 * 
 * Implements the circuit breaker pattern to prevent cascading failures when
 * external services (Firecrawl, OpenRouter) experience outages or degradation.
 * 
 * The circuit breaker has three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 * 
 * State transitions:
 * - CLOSED -> OPEN: After reaching failure threshold
 * - OPEN -> HALF_OPEN: After timeout period expires
 * - HALF_OPEN -> CLOSED: After reaching success threshold
 * - HALF_OPEN -> OPEN: If any failure occurs during testing
 * 
 * Requirements: 11.6
 * Design: Circuit Breaker Pattern section
 */

import { logger } from '@/lib/logging/logger'

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures required to open the circuit */
  failureThreshold: number
  
  /** Number of consecutive successes required to close the circuit from half-open state */
  successThreshold: number
  
  /** Time in milliseconds to wait before attempting to close an open circuit */
  timeout: number
}

/**
 * Circuit breaker implementation for protecting external service calls
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker('firecrawl', {
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * })
 * 
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await callExternalService()
 *   })
 * } catch (error) {
 *   // Handle error or circuit open
 * }
 * ```
 */
export class CircuitBreaker {
  private failureCount = 0
  private successCount = 0
  private state: CircuitBreakerState = 'closed'
  private nextAttempt = 0
  
  /**
   * Creates a new circuit breaker
   * 
   * @param service - Name of the service being protected (for logging)
   * @param config - Circuit breaker configuration
   */
  constructor(
    private readonly service: string,
    private readonly config: CircuitBreakerConfig
  ) {}
  
  /**
   * Executes a function with circuit breaker protection
   * 
   * @param fn - The async function to execute
   * @returns Promise resolving to the function result
   * @throws Error if circuit is open or function execution fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker open for ${this.service}. Next attempt at ${new Date(this.nextAttempt).toISOString()}`
        )
      }
      // Timeout has expired, transition to half-open
      this.state = 'half-open'
      this.successCount = 0
      logger.info('circuit_breaker', `Circuit half-open for ${this.service}, testing recovery`)
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  /**
   * Handles successful execution
   * Updates state and counters based on current circuit state
   */
  private onSuccess(): void {
    this.failureCount = 0
    
    if (this.state === 'half-open') {
      this.successCount++
      
      if (this.successCount >= this.config.successThreshold) {
        // Service has recovered, close the circuit
        this.state = 'closed'
        this.successCount = 0
        logger.info('circuit_breaker', `Circuit closed for ${this.service}, service recovered`, {
          service: this.service,
          successThreshold: this.config.successThreshold,
        })
      } else {
        logger.info('circuit_breaker', `Success in half-open state for ${this.service}`, {
          service: this.service,
          successCount: this.successCount,
          successThreshold: this.config.successThreshold,
        })
      }
    }
  }
  
  /**
   * Handles failed execution
   * Updates state and counters, potentially opening the circuit
   */
  private onFailure(): void {
    this.successCount = 0
    
    if (this.state === 'half-open') {
      // Failure during testing means service is still unhealthy
      this.state = 'open'
      this.nextAttempt = Date.now() + this.config.timeout
      this.failureCount = this.config.failureThreshold // Reset to threshold to avoid premature recovery
      
      logger.warn('circuit_breaker', `Circuit opened from half-open for ${this.service}, service still unhealthy`, {
        service: this.service,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      })
    } else {
      this.failureCount++
      
      if (this.failureCount >= this.config.failureThreshold) {
        // Threshold reached, open the circuit
        this.state = 'open'
        this.nextAttempt = Date.now() + this.config.timeout
        
        logger.warn('circuit_breaker', `Circuit opened for ${this.service}`, {
          service: this.service,
          failures: this.failureCount,
          threshold: this.config.failureThreshold,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
        })
      } else {
        logger.info('circuit_breaker', `Failure recorded for ${this.service}`, {
          service: this.service,
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold,
        })
      }
    }
  }
  
  /**
   * Gets the current state of the circuit breaker
   */
  getState(): CircuitBreakerState {
    return this.state
  }
  
  /**
   * Gets the current failure count
   */
  getFailureCount(): number {
    return this.failureCount
  }
  
  /**
   * Gets the current success count (in half-open state)
   */
  getSuccessCount(): number {
    return this.successCount
  }
  
  /**
   * Gets the timestamp of the next allowed attempt (when circuit is open)
   */
  getNextAttempt(): number {
    return this.nextAttempt
  }
  
  /**
   * Resets the circuit breaker to closed state
   * Useful for testing or manual intervention
   */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = 0
    
    logger.info('circuit_breaker', `Circuit breaker reset for ${this.service}`, {
      service: this.service,
    })
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CircuitBreakerOpenError'
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircuitBreakerOpenError)
    }
  }
}

/**
 * Pre-configured circuit breaker for Firecrawl service
 * 
 * Configuration:
 * - 5 failures trigger circuit open
 * - 2 successes in half-open state close circuit
 * - 60 second timeout before testing recovery
 */
export const firecrawlCircuitBreaker = new CircuitBreaker('firecrawl', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
})

/**
 * Pre-configured circuit breaker for OpenRouter service
 * 
 * Configuration:
 * - 5 failures trigger circuit open
 * - 2 successes in half-open state close circuit
 * - 30 second timeout before testing recovery
 */
export const openrouterCircuitBreaker = new CircuitBreaker('openrouter', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
})
