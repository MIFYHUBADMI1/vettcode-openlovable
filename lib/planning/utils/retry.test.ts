/**
 * Unit tests for retry utilities
 * Tests error classification, exponential backoff, timeout handling, and retry limits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ErrorType,
  classifyError,
  executeWithRetry,
  TimeoutError,
  DEFAULT_RETRY_CONFIG,
  STAGE_RETRY_CONFIGS,
} from './retry'

describe('classifyError', () => {
  describe('FATAL errors', () => {
    it('should classify insufficient credits as FATAL', () => {
      const error = new Error('Insufficient credits')
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
    
    it('should classify credit unavailable as FATAL', () => {
      const error = new Error('Credit service unavailable')
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
    
    it('should classify authentication failed as FATAL', () => {
      const error = new Error('Authentication failed')
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
    
    it('should classify unauthorized as FATAL', () => {
      const error = new Error('Unauthorized request')
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
    
    it('should classify invalid API key as FATAL', () => {
      const error = new Error('Invalid API key')
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
    
    it('should classify CreditInsufficientError by name as FATAL', () => {
      const error = new Error('Some message')
      error.name = 'CreditInsufficientError'
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
  })
  
  describe('NON_RETRYABLE errors', () => {
    it('should classify ValidationError by name as NON_RETRYABLE', () => {
      const error = new Error('Some validation issue')
      error.name = 'ValidationError'
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
    
    it('should classify SchemaError as NON_RETRYABLE', () => {
      const error = new Error('Schema mismatch')
      error.name = 'SchemaError'
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
    
    it('should classify validation failed message as NON_RETRYABLE', () => {
      const error = new Error('Validation failed: field is required')
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
    
    it('should classify invalid schema as NON_RETRYABLE', () => {
      const error = new Error('Invalid schema provided')
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
    
    it('should classify invalid input as NON_RETRYABLE', () => {
      const error = new Error('Invalid input provided')
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
    
    it('should classify malformed data as NON_RETRYABLE', () => {
      const error = new Error('Malformed JSON data')
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
    
    it('should classify parse error as NON_RETRYABLE', () => {
      const error = new Error('Parse error at line 5')
      expect(classifyError(error)).toBe(ErrorType.NON_RETRYABLE)
    })
  })
  
  describe('RETRYABLE errors', () => {
    it('should classify rate limit as RETRYABLE', () => {
      const error = new Error('Rate limit exceeded')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify too many requests as RETRYABLE', () => {
      const error = new Error('Too many requests')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify 429 status as RETRYABLE', () => {
      const error = new Error('HTTP 429 error')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify timeout as RETRYABLE', () => {
      const error = new Error('Request timeout')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify timed out as RETRYABLE', () => {
      const error = new Error('Operation timed out')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify TimeoutError by name as RETRYABLE', () => {
      const error = new TimeoutError('Timeout occurred')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify network errors as RETRYABLE', () => {
      const error = new Error('Network error occurred')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify connection errors as RETRYABLE', () => {
      const error = new Error('Connection refused')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify ECONNREFUSED as RETRYABLE', () => {
      const error = new Error('ECONNREFUSED')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify ENOTFOUND as RETRYABLE', () => {
      const error = new Error('ENOTFOUND: dns lookup failed')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify 503 service unavailable as RETRYABLE', () => {
      const error = new Error('503 Service unavailable')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify temporarily unavailable as RETRYABLE', () => {
      const error = new Error('Service temporarily unavailable')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify 502 bad gateway as RETRYABLE', () => {
      const error = new Error('502 Bad gateway')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify 504 gateway timeout as RETRYABLE', () => {
      const error = new Error('504 Gateway timeout')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should classify unknown errors as RETRYABLE by default', () => {
      const error = new Error('Some unknown error')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
  })
  
  describe('case insensitivity', () => {
    it('should handle uppercase error messages', () => {
      const error = new Error('RATE LIMIT EXCEEDED')
      expect(classifyError(error)).toBe(ErrorType.RETRYABLE)
    })
    
    it('should handle mixed case error messages', () => {
      const error = new Error('Insufficient Credits Available')
      expect(classifyError(error)).toBe(ErrorType.FATAL)
    })
  })
})

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  
  describe('successful execution', () => {
    it('should return result on first attempt if successful', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      
      const promise = executeWithRetry(fn)
      await vi.runAllTimersAsync()
      const result = await promise
      
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should return result without delay on immediate success', async () => {
      const fn = vi.fn().mockResolvedValue(42)
      
      const promise = executeWithRetry(fn)
      const result = await promise
      
      expect(result).toBe(42)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('retry behavior', () => {
    it('should retry retryable errors up to maxAttempts', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce('success')
      
      const promise = executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      })
      
      await vi.runAllTimersAsync()
      const result = await promise
      
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })
    
    it('should throw error after exhausting all retries', async () => {
      const error = new Error('Rate limit exceeded')
      const fn = vi.fn().mockRejectedValue(error)
      
      const promise = executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      })
      
      // Attach the rejection handler BEFORE timers fire so the rejection
      // never goes unhandled while fake timers flush.
      const expectation = expect(promise).rejects.toThrow('Rate limit exceeded')

      await vi.runAllTimersAsync()
      await expectation
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })
  
  describe('exponential backoff', () => {
    it('should implement exponential backoff with correct delays', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce('success')
      
      const config = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      }
      
      const promise = executeWithRetry(fn, config)
      
      // First call happens immediately
      expect(fn).toHaveBeenCalledTimes(1)
      
      // Advance by first delay (1000ms)
      await vi.advanceTimersByTimeAsync(1000)
      expect(fn).toHaveBeenCalledTimes(2)
      
      // Advance by second delay (2000ms = 1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000)
      expect(fn).toHaveBeenCalledTimes(3)
      
      const result = await promise
      expect(result).toBe('success')
    })
    
    it('should respect maxDelayMs cap', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce('success')
      
      const config = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 1500, // Cap at 1500ms
        backoffMultiplier: 2,
      }
      
      const promise = executeWithRetry(fn, config)
      
      // First call happens immediately
      expect(fn).toHaveBeenCalledTimes(1)
      
      // Advance by first delay (1000ms)
      await vi.advanceTimersByTimeAsync(1000)
      expect(fn).toHaveBeenCalledTimes(2)
      
      // Second delay should be capped at 1500ms instead of 2000ms
      await vi.advanceTimersByTimeAsync(1500)
      expect(fn).toHaveBeenCalledTimes(3)
      
      const result = await promise
      expect(result).toBe('success')
    })
  })
  
  describe('fatal error handling', () => {
    it('should immediately throw fatal errors without retry', async () => {
      const error = new Error('Insufficient credits')
      const fn = vi.fn().mockRejectedValue(error)
      
      await expect(executeWithRetry(fn)).rejects.toThrow('Insufficient credits')
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should not delay before throwing fatal error', async () => {
      const error = new Error('Authentication failed')
      const fn = vi.fn().mockRejectedValue(error)
      
      const promise = executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 5000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      })
      
      await expect(promise).rejects.toThrow('Authentication failed')
      expect(fn).toHaveBeenCalledTimes(1)
      
      // No timers should have been created
      expect(vi.getTimerCount()).toBe(0)
    })
  })
  
  describe('non-retryable error handling', () => {
    it('should immediately throw non-retryable errors without retry', async () => {
      const error = new Error('Validation failed')
      error.name = 'ValidationError'
      const fn = vi.fn().mockRejectedValue(error)
      
      await expect(executeWithRetry(fn)).rejects.toThrow('Validation failed')
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should not delay before throwing non-retryable error', async () => {
      const error = new Error('Invalid input provided')
      const fn = vi.fn().mockRejectedValue(error)
      
      const promise = executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 5000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      })
      
      await expect(promise).rejects.toThrow('Invalid input provided')
      expect(fn).toHaveBeenCalledTimes(1)
      
      // No timers should have been created
      expect(vi.getTimerCount()).toBe(0)
    })
  })
  
  describe('timeout handling', () => {
    it('should timeout if function exceeds timeoutMs', async () => {
      const fn = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          // Never resolves
        })
      })
      
      const promise = executeWithRetry(fn, {
        maxAttempts: 1,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        timeoutMs: 5000,
      })
      
      // Advance timers past the timeout
      // Attach the rejection handler BEFORE advancing timers so the
      // rejection never goes unhandled while fake timers flush.
      const expectation = expect(promise).rejects.toThrow('Operation timed out after 5000ms')

      await vi.advanceTimersByTimeAsync(5000)
      await expectation
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should retry after timeout if error is retryable', async () => {
      const fn = vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => {
          // Never resolves (will timeout)
        }))
        .mockResolvedValueOnce('success')
      
      const config = {
        maxAttempts: 2,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        timeoutMs: 2000,
      }
      
      const promise = executeWithRetry(fn, config)
      
      // First attempt times out
      await vi.advanceTimersByTimeAsync(2000)
      expect(fn).toHaveBeenCalledTimes(1)
      
      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(1000)
      
      // Second attempt succeeds
      const result = await promise
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })
    
    it('should work without timeout when timeoutMs is not provided', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      
      const promise = executeWithRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        // No timeoutMs provided
      })
      
      const result = await promise
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('default configuration', () => {
    it('should use DEFAULT_RETRY_CONFIG when no config provided', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce('success')
      
      const promise = executeWithRetry(fn)
      
      expect(fn).toHaveBeenCalledTimes(1)
      
      // Should use default initialDelayMs of 1000ms
      await vi.advanceTimersByTimeAsync(1000)
      expect(fn).toHaveBeenCalledTimes(2)
      
      const result = await promise
      expect(result).toBe('success')
    })
  })
})

describe('STAGE_RETRY_CONFIGS', () => {
  it('should have configuration for all expected stages', () => {
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('understanding')
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('research')
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('planning')
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('critique')
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('repair')
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('validation')
    expect(STAGE_RETRY_CONFIGS).toHaveProperty('sanitization')
  })
  
  it('should have timeouts matching design requirements', () => {
    expect(STAGE_RETRY_CONFIGS.understanding.timeoutMs).toBe(30000)
    expect(STAGE_RETRY_CONFIGS.research.timeoutMs).toBe(45000)
    expect(STAGE_RETRY_CONFIGS.planning.timeoutMs).toBe(60000)
    expect(STAGE_RETRY_CONFIGS.critique.timeoutMs).toBe(30000)
    expect(STAGE_RETRY_CONFIGS.repair.timeoutMs).toBe(30000)
    expect(STAGE_RETRY_CONFIGS.validation.timeoutMs).toBe(10000)
    expect(STAGE_RETRY_CONFIGS.sanitization.timeoutMs).toBe(5000)
  })
  
  it('should have maxAttempts <= 3 for all stages', () => {
    Object.entries(STAGE_RETRY_CONFIGS).forEach(([stage, config]) => {
      expect(config.maxAttempts).toBeLessThanOrEqual(3)
      expect(config.maxAttempts).toBeGreaterThanOrEqual(1)
    })
  })
  
  it('should not retry validation and sanitization stages', () => {
    expect(STAGE_RETRY_CONFIGS.validation.maxAttempts).toBe(1)
    expect(STAGE_RETRY_CONFIGS.sanitization.maxAttempts).toBe(1)
  })
})

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_RETRY_CONFIG).toEqual({
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    })
  })
})

describe('TimeoutError', () => {
  it('should be an instance of Error', () => {
    const error = new TimeoutError('Test timeout')
    expect(error).toBeInstanceOf(Error)
  })
  
  it('should have correct name', () => {
    const error = new TimeoutError('Test timeout')
    expect(error.name).toBe('TimeoutError')
  })
  
  it('should preserve error message', () => {
    const error = new TimeoutError('Operation timed out')
    expect(error.message).toBe('Operation timed out')
  })
})



