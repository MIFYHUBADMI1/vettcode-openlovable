/**
 * Core Types Schema Tests
 * Tests Requirements 1.1-24.8
 */

import { describe, it, expect } from 'vitest'
import {
  PipelineStageSchema,
  PipelineModeSchema,
  ModelConfigSchema,
  ModelStrategySchema,
  ModelConfigurationSchema,
  ConfidenceLevelSchema,
  SeverityLevelSchema,
  ErrorType,
  DEFAULT_RETRY_CONFIG,
  TOTALUM_STACK,
  STACK_REPLACEMENTS,
  PLANNING_COSTS,
  STAGE_TIMEOUTS,
  RATE_LIMITS,
  type PipelineStage,
  type PipelineMode,
  type ModelConfig,
  type ModelStrategy,
  type ExecutionContext,
  type RetryConfig,
} from './core-types'

describe('Core Types', () => {
  describe('PipelineStageSchema', () => {
    it('should accept all valid pipeline stages', () => {
      const validStages = [
        'idea_understanding',
        'website_understanding',
        'research',
        'planning',
        'critique',
        'repair',
        'validation',
        'sanitization',
      ]
      
      validStages.forEach(stage => {
        expect(() => PipelineStageSchema.parse(stage)).not.toThrow()
      })
    })

    it('should reject invalid pipeline stages', () => {
      expect(() => PipelineStageSchema.parse('invalid')).toThrow()
      expect(() => PipelineStageSchema.parse('testing')).toThrow()
    })
  })

  describe('PipelineModeSchema', () => {
    it('should accept all valid pipeline modes', () => {
      const validModes = ['idea', 'website', 'deepCrawl']
      
      validModes.forEach(mode => {
        expect(() => PipelineModeSchema.parse(mode)).not.toThrow()
      })
    })

    it('should reject invalid pipeline modes', () => {
      expect(() => PipelineModeSchema.parse('invalid')).toThrow()
      expect(() => PipelineModeSchema.parse('custom')).toThrow()
    })
  })

  describe('ModelConfigSchema', () => {
    it('should validate complete model config', () => {
      const config = {
        primary: 'anthropic/claude-3.5-sonnet',
        fallbacks: ['openai/gpt-4', 'openrouter/auto'],
        maxTokens: 4096,
        temperature: 0.7,
      }
      
      expect(() => ModelConfigSchema.parse(config)).not.toThrow()
    })

    it('should default fallbacks to empty array', () => {
      const config = {
        primary: 'anthropic/claude-3.5-sonnet',
      }
      
      const parsed = ModelConfigSchema.parse(config)
      expect(parsed.fallbacks).toEqual([])
    })

    it('should default maxTokens and temperature', () => {
      const config = {
        primary: 'anthropic/claude-3.5-sonnet',
      }
      
      const parsed = ModelConfigSchema.parse(config)
      expect(parsed.maxTokens).toBe(4096)
      expect(parsed.temperature).toBe(0.7)
    })

    it('should enforce temperature range', () => {
      const tooLow = {
        primary: 'test',
        temperature: -0.1,
      }
      expect(() => ModelConfigSchema.parse(tooLow)).toThrow()
      
      const tooHigh = {
        primary: 'test',
        temperature: 2.1,
      }
      expect(() => ModelConfigSchema.parse(tooHigh)).toThrow()
    })
  })

  describe('ModelStrategySchema', () => {
    it('should accept all valid strategies', () => {
      const validStrategies = ['cost_optimized', 'quality_optimized', 'speed_optimized']
      
      validStrategies.forEach(strategy => {
        expect(() => ModelStrategySchema.parse(strategy)).not.toThrow()
      })
    })

    it('should reject invalid strategies', () => {
      expect(() => ModelStrategySchema.parse('balanced')).toThrow()
      expect(() => ModelStrategySchema.parse('custom')).toThrow()
    })
  })

  describe('ModelConfigurationSchema', () => {
    it('should validate complete model configuration', () => {
      const config = {
        primaryPlanner: {
          primary: 'anthropic/claude-3.5-sonnet',
          fallbacks: ['openai/gpt-4'],
          maxTokens: 4096,
          temperature: 0.7,
        },
        researchAgent: {
          primary: 'anthropic/claude-3-haiku',
          fallbacks: [],
          maxTokens: 2048,
          temperature: 0.5,
        },
        critic: {
          primary: 'openai/gpt-4',
          fallbacks: ['anthropic/claude-3.5-sonnet'],
          maxTokens: 4096,
          temperature: 0.3,
        },
        repairService: {
          primary: 'anthropic/claude-3.5-sonnet',
          fallbacks: [],
          maxTokens: 4096,
          temperature: 0.7,
        },
        strategy: 'quality_optimized',
      }
      
      expect(() => ModelConfigurationSchema.parse(config)).not.toThrow()
    })
  })

  describe('ConfidenceLevelSchema', () => {
    it('should accept all valid confidence levels', () => {
      const validLevels = ['explicit', 'inferred', 'observed', 'suggested']
      
      validLevels.forEach(level => {
        expect(() => ConfidenceLevelSchema.parse(level)).not.toThrow()
      })
    })

    it('should reject invalid confidence levels', () => {
      expect(() => ConfidenceLevelSchema.parse('unknown')).toThrow()
      expect(() => ConfidenceLevelSchema.parse('guessed')).toThrow()
    })
  })

  describe('SeverityLevelSchema', () => {
    it('should accept all valid severity levels', () => {
      const validLevels = ['critical', 'warning', 'info']
      
      validLevels.forEach(level => {
        expect(() => SeverityLevelSchema.parse(level)).not.toThrow()
      })
    })

    it('should reject invalid severity levels', () => {
      expect(() => SeverityLevelSchema.parse('error')).toThrow()
      expect(() => SeverityLevelSchema.parse('notice')).toThrow()
    })
  })

  describe('ErrorType', () => {
    it('should have all error type values', () => {
      expect(ErrorType.RETRYABLE).toBe('retryable')
      expect(ErrorType.NON_RETRYABLE).toBe('non_retryable')
      expect(ErrorType.FATAL).toBe('fatal')
    })
  })

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have valid retry configuration', () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3)
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000)
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000)
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2)
    })
  })

  describe('TOTALUM_STACK', () => {
    it('should define all stack categories', () => {
      expect(TOTALUM_STACK.frontend).toContain('React')
      expect(TOTALUM_STACK.frontend).toContain('Next.js')
      expect(TOTALUM_STACK.frontend).toContain('Tailwind CSS')
      expect(TOTALUM_STACK.backend).toContain('Next.js API routes')
      expect(TOTALUM_STACK.backend).toContain('Totalum SDK')
      expect(TOTALUM_STACK.database).toContain('Totalum SDK database')
    })
  })

  describe('STACK_REPLACEMENTS', () => {
    it('should define replacement rules for unsupported technologies', () => {
      expect(STACK_REPLACEMENTS.length).toBeGreaterThan(0)
      
      STACK_REPLACEMENTS.forEach(rule => {
        expect(rule.pattern).toBeInstanceOf(RegExp)
        expect(rule.replacement).toBeDefined()
        expect(rule.reason).toBeDefined()
      })
    })

    it('should have patterns for common database technologies', () => {
      const dbRule = STACK_REPLACEMENTS.find(r => 
        r.pattern.source.includes('postgresql')
      )
      expect(dbRule).toBeDefined()
      expect(dbRule?.replacement).toContain('Totalum SDK')
    })

    it('should have patterns for common ORMs', () => {
      const ormRule = STACK_REPLACEMENTS.find(r => 
        r.pattern.source.includes('prisma')
      )
      expect(ormRule).toBeDefined()
      expect(ormRule?.replacement).toContain('Totalum SDK')
    })

    it('should have patterns for backend frameworks', () => {
      const backendRule = STACK_REPLACEMENTS.find(r => 
        r.pattern.source.includes('express')
      )
      expect(backendRule).toBeDefined()
      expect(backendRule?.replacement).toContain('Next.js')
    })
  })

  describe('PLANNING_COSTS', () => {
    it('should define all cost constants', () => {
      expect(PLANNING_COSTS.SCRAPE_COST).toBe(5)
      expect(PLANNING_COSTS.PLAN_COST).toBe(10)
      expect(PLANNING_COSTS.DEEP_CRAWL_COST).toBe(20)
    })
  })

  describe('STAGE_TIMEOUTS', () => {
    it('should define timeouts for all stages', () => {
      expect(STAGE_TIMEOUTS.idea_understanding).toBe(30000)
      expect(STAGE_TIMEOUTS.website_understanding).toBe(45000)
      expect(STAGE_TIMEOUTS.research).toBe(45000)
      expect(STAGE_TIMEOUTS.planning).toBe(60000)
      expect(STAGE_TIMEOUTS.critique).toBe(30000)
      expect(STAGE_TIMEOUTS.repair).toBe(30000)
      expect(STAGE_TIMEOUTS.validation).toBe(10000)
      expect(STAGE_TIMEOUTS.sanitization).toBe(5000)
    })

    it('should have all timeouts in milliseconds', () => {
      Object.values(STAGE_TIMEOUTS).forEach(timeout => {
        expect(timeout).toBeGreaterThan(0)
        expect(timeout).toBeLessThanOrEqual(120000) // max 2 minutes
      })
    })
  })

  describe('RATE_LIMITS', () => {
    it('should define all rate limit constants', () => {
      expect(RATE_LIMITS.PLANNING_REQUESTS_PER_HOUR).toBe(10)
      expect(RATE_LIMITS.PLANNING_REQUESTS_PER_DAY).toBe(50)
      expect(RATE_LIMITS.MAX_IDEA_LENGTH).toBe(5000)
      expect(RATE_LIMITS.MIN_IDEA_LENGTH).toBe(50)
    })

    it('should have sensible rate limits', () => {
      expect(RATE_LIMITS.PLANNING_REQUESTS_PER_HOUR).toBeLessThanOrEqual(RATE_LIMITS.PLANNING_REQUESTS_PER_DAY)
      expect(RATE_LIMITS.MIN_IDEA_LENGTH).toBeLessThan(RATE_LIMITS.MAX_IDEA_LENGTH)
    })
  })

  describe('Type Guards and Interfaces', () => {
    it('should define ExecutionContext interface', () => {
      const context: ExecutionContext = {
        projectId: 'test-project',
        userId: 'test-user',
        runId: 'test-run',
        attempt: 1,
        metadata: { key: 'value' },
      }
      
      expect(context.projectId).toBe('test-project')
      expect(context.userId).toBe('test-user')
      expect(context.runId).toBe('test-run')
      expect(context.attempt).toBe(1)
      expect(context.metadata).toEqual({ key: 'value' })
    })

    it('should define RetryConfig interface', () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        initialDelayMs: 500,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
      }
      
      expect(config.maxAttempts).toBe(5)
      expect(config.initialDelayMs).toBe(500)
      expect(config.maxDelayMs).toBe(15000)
      expect(config.backoffMultiplier).toBe(2)
    })
  })
})
