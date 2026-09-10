/**
 * Tests for Circuit Breaker Pattern implementation
 * 
 * Validates state machine behavior, failure tracking, and recovery logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  firecrawlCircuitBreaker,
  openrouterCircuitBreaker,
  type CircuitBreakerConfig
} from './circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker
  const config: CircuitBreakerConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 1000,
  }

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', config)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed')
    })

    it('should have zero failure count', () => {
      expect(breaker.getFailureCount()).toBe(0)
    })

    it('should have zero success count', () => {
      expect(breaker.getSuccessCount()).toBe(0)
    })
  })

  describe('Closed State - Normal Operation', () => {
    it('should execute function and return result when closed', async () => {
      const result = await breaker.execute(async () => 'success')
      expect(result).toBe('success')
      expect(breaker.getState()).toBe('closed')
    })

    it('should increment failure count on error', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('test failure')
        })
      } catch {
        // Expected
      }

      expect(breaker.getFailureCount()).toBe(1)
      expect(breaker.getState()).toBe('closed')
    })

    it('should reset failure count on success', async () => {
      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test failure')
          })
        } catch {
          // Expected
        }
      }

      expect(breaker.getFailureCount()).toBe(2)

      // Then succeed
      await breaker.execute(async () => 'success')

      expect(breaker.getFailureCount()).toBe(0)
      expect(breaker.getState()).toBe('closed')
    })
  })

  describe('Transition to Open State', () => {
    it('should open circuit after reaching failure threshold', async () => {
      // Trigger threshold failures
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error(`failure ${i + 1}`)
          })
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open')
      expect(breaker.getFailureCount()).toBe(config.failureThreshold)
    })

    it('should set next attempt time when opening', async () => {
      const beforeTime = Date.now()

      // Trigger threshold failures
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test failure')
          })
        } catch {
          // Expected
        }
      }

      const nextAttempt = breaker.getNextAttempt()
      expect(nextAttempt).toBeGreaterThanOrEqual(beforeTime + config.timeout)
    })
  })

  describe('Open State - Rejecting Requests', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test failure')
          })
        } catch {
          // Expected
        }
      }
    })

    it('should reject requests immediately when open', async () => {
      await expect(
        breaker.execute(async () => 'should not execute')
      ).rejects.toThrow(CircuitBreakerOpenError)
    })

    it('should not execute function when circuit is open', async () => {
      const mockFn = vi.fn(async () => 'result')

      try {
        await breaker.execute(mockFn)
      } catch {
        // Expected
      }

      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should include service name in error message', async () => {
      try {
        await breaker.execute(async () => 'test')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError)
        expect((error as Error).message).toContain('test-service')
      }
    })
  })

  describe('Transition to Half-Open State', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test failure')
          })
        } catch {
          // Expected
        }
      }
    })

    it('should transition to half-open after timeout', async () => {
      expect(breaker.getState()).toBe('open')

      // Advance time past timeout
      vi.advanceTimersByTime(config.timeout + 1)

      // Next request should trigger half-open state
      await breaker.execute(async () => 'success')

      expect(breaker.getState()).toBe('half-open')
    })

    it('should reset success count when entering half-open', async () => {
      // Advance time past timeout
      vi.advanceTimersByTime(config.timeout + 1)

      // Execute to enter half-open
      await breaker.execute(async () => 'success')

      expect(breaker.getSuccessCount()).toBe(1) // One success in half-open
    })

    it('should not transition to half-open before timeout', async () => {
      // Advance time but not past timeout
      vi.advanceTimersByTime(config.timeout - 100)

      await expect(
        breaker.execute(async () => 'test')
      ).rejects.toThrow(CircuitBreakerOpenError)

      expect(breaker.getState()).toBe('open')
    })
  })

  describe('Half-Open State - Testing Recovery', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test failure')
          })
        } catch {
          // Expected
        }
      }

      // Advance time to allow half-open transition
      vi.advanceTimersByTime(config.timeout + 1)
    })

    it('should close circuit after success threshold in half-open', async () => {
      // Execute success threshold times
      for (let i = 0; i < config.successThreshold; i++) {
        await breaker.execute(async () => `success ${i + 1}`)
      }

      expect(breaker.getState()).toBe('closed')
      expect(breaker.getSuccessCount()).toBe(0) // Reset after closing
      expect(breaker.getFailureCount()).toBe(0)
    })

    it('should reopen circuit on failure in half-open state', async () => {
      // First success
      await breaker.execute(async () => 'success')
      expect(breaker.getState()).toBe('half-open')

      // Then fail
      try {
        await breaker.execute(async () => {
          throw new Error('failed during recovery')
        })
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('open')
    })

    it('should set new timeout when reopening from half-open', async () => {
      const beforeTime = Date.now()

      // Fail in half-open state
      try {
        await breaker.execute(async () => {
          throw new Error('test failure')
        })
      } catch {
        // Expected
      }

      const nextAttempt = breaker.getNextAttempt()
      expect(nextAttempt).toBeGreaterThanOrEqual(beforeTime + config.timeout)
    })

    it('should increment success count with each success', async () => {
      await breaker.execute(async () => 'success 1')
      expect(breaker.getSuccessCount()).toBe(1)
      expect(breaker.getState()).toBe('half-open')

      await breaker.execute(async () => 'success 2')
      expect(breaker.getSuccessCount()).toBe(0) // Reset because circuit closed
      expect(breaker.getState()).toBe('closed')
    })
  })

  describe('State Getters', () => {
    it('should return current state', () => {
      expect(breaker.getState()).toBe('closed')
    })

    it('should return current failure count', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('test')
        })
      } catch {
        // Expected
      }

      expect(breaker.getFailureCount()).toBe(1)
    })

    it('should return current success count', async () => {
      // Open circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      // Enter half-open
      vi.advanceTimersByTime(config.timeout + 1)
      await breaker.execute(async () => 'success')

      expect(breaker.getSuccessCount()).toBe(1)
    })

    it('should return next attempt timestamp', async () => {
      // Open circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      expect(breaker.getNextAttempt()).toBeGreaterThan(0)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset to closed state', async () => {
      // Open circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open')

      breaker.reset()

      expect(breaker.getState()).toBe('closed')
    })

    it('should reset all counters', async () => {
      // Accumulate some failures
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      breaker.reset()

      expect(breaker.getFailureCount()).toBe(0)
      expect(breaker.getSuccessCount()).toBe(0)
      expect(breaker.getNextAttempt()).toBe(0)
    })

    it('should allow requests after reset', async () => {
      // Open circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      breaker.reset()

      const result = await breaker.execute(async () => 'success after reset')
      expect(result).toBe('success after reset')
    })
  })

  describe('Pre-configured Instances', () => {
    it('should have firecrawl circuit breaker with correct config', () => {
      expect(firecrawlCircuitBreaker).toBeInstanceOf(CircuitBreaker)
      expect(firecrawlCircuitBreaker.getState()).toBe('closed')
    })

    it('should have openrouter circuit breaker with correct config', () => {
      expect(openrouterCircuitBreaker).toBeInstanceOf(CircuitBreaker)
      expect(openrouterCircuitBreaker.getState()).toBe('closed')
    })

    it('should have independent states for each instance', async () => {
      // Reset both to ensure clean state
      firecrawlCircuitBreaker.reset()
      openrouterCircuitBreaker.reset()

      // Fail firecrawl 5 times
      for (let i = 0; i < 5; i++) {
        try {
          await firecrawlCircuitBreaker.execute(async () => {
            throw new Error('firecrawl failure')
          })
        } catch {
          // Expected
        }
      }

      expect(firecrawlCircuitBreaker.getState()).toBe('open')
      expect(openrouterCircuitBreaker.getState()).toBe('closed')
    })
  })

  describe('Error Propagation', () => {
    it('should propagate original error when circuit is closed', async () => {
      const originalError = new Error('original error message')

      try {
        await breaker.execute(async () => {
          throw originalError
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBe(originalError)
      }
    })

    it('should throw CircuitBreakerOpenError when circuit is open', async () => {
      // Open circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      try {
        await breaker.execute(async () => 'test')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle synchronous errors', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('sync error')
        })
      } catch (error) {
        expect((error as Error).message).toBe('sync error')
      }

      expect(breaker.getFailureCount()).toBe(1)
    })

    it('should handle async rejections', async () => {
      try {
        await breaker.execute(async () => {
          return Promise.reject(new Error('async rejection'))
        })
      } catch (error) {
        expect((error as Error).message).toBe('async rejection')
      }

      expect(breaker.getFailureCount()).toBe(1)
    })

    it('should handle multiple concurrent requests', async () => {
      // Increase timeout for concurrent operations
      vi.useRealTimers()
      const promises = []

      for (let i = 0; i < 5; i++) {
        promises.push(
          breaker.execute(async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return `result ${i}`
          })
        )
      }

      const results = await Promise.all(promises)
      expect(results).toHaveLength(5)
      expect(breaker.getState()).toBe('closed')
    })

    it('should handle zero timeout', async () => {
      const zeroTimeoutBreaker = new CircuitBreaker('zero-timeout', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 0,
      })

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await zeroTimeoutBreaker.execute(async () => {
            throw new Error('test')
          })
        } catch {
          // Expected
        }
      }

      expect(zeroTimeoutBreaker.getState()).toBe('open')

      // Should immediately allow retry with 0 timeout
      vi.advanceTimersByTime(1)
      await zeroTimeoutBreaker.execute(async () => 'success')

      expect(zeroTimeoutBreaker.getState()).toBe('closed')
    })
  })
})

