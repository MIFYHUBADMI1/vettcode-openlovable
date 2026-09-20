/**
 * Unit tests for ModelRegistry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ModelRegistry, type PipelineStage } from './registry'

describe('ModelRegistry', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }

    // Clear ALL model-related env vars so tests start from a clean slate.
    // This prevents .env.local values (e.g. OPENROUTER_FREE_MODEL) from
    // leaking into test assertions.
    delete process.env.OPENROUTER_MODEL
    delete process.env.OPENROUTER_FREE_MODEL
    delete process.env.IDEA_UNDERSTANDING_MODEL
    delete process.env.IDEA_UNDERSTANDING_FALLBACK_MODEL
    delete process.env.RESEARCH_MODEL
    delete process.env.RESEARCH_FALLBACK_MODEL
    delete process.env.PLANNER_MODEL
    delete process.env.PLANNER_FALLBACK_MODEL
    delete process.env.CRITIC_MODEL
    delete process.env.CRITIC_FALLBACK_MODEL
    delete process.env.REPAIR_MODEL
    delete process.env.REPAIR_FALLBACK_MODEL
    delete process.env.PLANNING_STRATEGY
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('getModelForStage', () => {
    it('should return default configuration when no env vars set', () => {
      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config.primary).toBe('openrouter/auto')
      expect(config.fallbacks).toContain('openrouter/auto')
      expect(config.maxTokens).toBe(8000)
      expect(config.temperature).toBe(0.7)
    })

    it('should return configuration for all pipeline stages', () => {
      const registry = new ModelRegistry()
      const stages: PipelineStage[] = ['idea_understanding', 'research', 'planning', 'critique', 'repair']

      stages.forEach(stage => {
        const config = registry.getModelForStage(stage)
        expect(config).toBeDefined()
        expect(config.primary).toBeDefined()
        expect(config.fallbacks).toBeDefined()
        expect(config.maxTokens).toBeGreaterThan(0)
        expect(config.temperature).toBeGreaterThanOrEqual(0)
        expect(config.temperature).toBeLessThanOrEqual(1)
      })
    })

    it('should use OPENROUTER_MODEL as fallback when stage-specific not set', () => {
      process.env.OPENROUTER_MODEL = 'openai/gpt-4o'

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config.primary).toBe('openai/gpt-4o')
    })

    it('should prioritize stage-specific model over OPENROUTER_MODEL', () => {
      process.env.OPENROUTER_MODEL = 'openai/gpt-4o'
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config.primary).toBe('anthropic/claude-3.5-sonnet')
    })

    it('should use different models for different stages', () => {
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'
      process.env.CRITIC_MODEL = 'openai/gpt-4o'
      process.env.RESEARCH_MODEL = 'openai/gpt-4o-mini'

      const registry = new ModelRegistry()

      expect(registry.getModelForStage('planning').primary).toBe('anthropic/claude-3.5-sonnet')
      expect(registry.getModelForStage('critique').primary).toBe('openai/gpt-4o')
      expect(registry.getModelForStage('research').primary).toBe('openai/gpt-4o-mini')
    })
  })

  describe('getFallbackModel', () => {
    it('should return null when attempt 0 is requested (primary, not a fallback)', () => {
      const registry = new ModelRegistry()
      const fallback = registry.getFallbackModel('planning', 0)

      expect(fallback).toBeNull()
    })

    it('should return first fallback for attempt 1', () => {
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'
      process.env.PLANNER_FALLBACK_MODEL = 'openai/gpt-4o'

      const registry = new ModelRegistry()
      const fallback = registry.getFallbackModel('planning', 1)

      expect(fallback).not.toBeNull()
      expect(fallback?.primary).toBe('openai/gpt-4o')
    })

    it('should use the openrouter/auto safety net when no fallback is configured', () => {
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'

      const registry = new ModelRegistry()
      const fallback = registry.getFallbackModel('planning', 1)

      // The implicit safety net is the first (only) fallback.
      expect(fallback).not.toBeNull()
      expect(fallback?.primary).toBe('openrouter/auto')

      // Beyond the safety net there is nothing left.
      expect(registry.getFallbackModel('planning', 2)).toBeNull()
    })

    it('should return null when attempt exceeds available fallbacks', () => {
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'
      process.env.PLANNER_FALLBACK_MODEL = 'openai/gpt-4o'

      const registry = new ModelRegistry()

      // First fallback exists (attempt 1)
      expect(registry.getFallbackModel('planning', 1)).not.toBeNull()

      // Second fallback exists (attempt 2 = openrouter/auto)
      expect(registry.getFallbackModel('planning', 2)).not.toBeNull()

      // Third fallback doesn't exist (attempt 3)
      expect(registry.getFallbackModel('planning', 3)).toBeNull()
    })

    it('should preserve maxTokens and temperature from original config', () => {
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'
      process.env.PLANNER_FALLBACK_MODEL = 'openai/gpt-4o'

      const registry = new ModelRegistry()
      const primary = registry.getModelForStage('planning')
      const fallback = registry.getFallbackModel('planning', 1)

      expect(fallback?.maxTokens).toBe(primary.maxTokens)
      expect(fallback?.temperature).toBe(primary.temperature)
    })
  })

  describe('Environment Variable Precedence', () => {
    it('should prioritize stage-specific model over strategy preset', () => {
      process.env.PLANNING_STRATEGY = 'quality_optimized'
      process.env.CRITIC_MODEL = 'custom/model'

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('critique')

      expect(config.primary).toBe('custom/model')
    })

    it('should prioritize stage-specific model over OPENROUTER_MODEL', () => {
      process.env.OPENROUTER_MODEL = 'openai/gpt-4o'
      process.env.REPAIR_MODEL = 'anthropic/claude-3.5-sonnet'

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('repair')

      expect(config.primary).toBe('anthropic/claude-3.5-sonnet')
    })

    it('should use OPENROUTER_FREE_MODEL as fallback', () => {
      process.env.OPENROUTER_FREE_MODEL = 'free/model'

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config.primary).toBe('free/model')
    })
  })

  describe('Fallback Configuration', () => {
    it('should configure fallbacks from environment variables', () => {
      process.env.RESEARCH_MODEL = 'primary/model'
      process.env.RESEARCH_FALLBACK_MODEL = 'fallback/model'

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('research')

      expect(config.fallbacks).toContain('fallback/model')
      expect(config.fallbacks).toContain('openrouter/auto')
    })

    it('should support all stage-specific fallback variables', () => {
      process.env.IDEA_UNDERSTANDING_FALLBACK_MODEL = 'idea/fallback'
      process.env.RESEARCH_FALLBACK_MODEL = 'research/fallback'
      process.env.PLANNER_FALLBACK_MODEL = 'planner/fallback'
      process.env.CRITIC_FALLBACK_MODEL = 'critic/fallback'
      process.env.REPAIR_FALLBACK_MODEL = 'repair/fallback'

      const registry = new ModelRegistry()

      expect(registry.getModelForStage('idea_understanding').fallbacks[0]).toBe('idea/fallback')
      expect(registry.getModelForStage('research').fallbacks[0]).toBe('research/fallback')
      expect(registry.getModelForStage('planning').fallbacks[0]).toBe('planner/fallback')
      expect(registry.getModelForStage('critique').fallbacks[0]).toBe('critic/fallback')
      expect(registry.getModelForStage('repair').fallbacks[0]).toBe('repair/fallback')
    })
  })

  describe('Model Parameters', () => {
    it('should have reasonable token limits for each stage', () => {
      const registry = new ModelRegistry()

      // Idea understanding needs moderate tokens
      expect(registry.getModelForStage('idea_understanding').maxTokens).toBeGreaterThanOrEqual(4000)

      // Planning needs more tokens for comprehensive specs
      expect(registry.getModelForStage('planning').maxTokens).toBeGreaterThanOrEqual(8000)

      // Critic needs moderate tokens for analysis
      expect(registry.getModelForStage('critique').maxTokens).toBeGreaterThanOrEqual(4000)
    })

    it('should use lower temperature for critic (more deterministic)', () => {
      const registry = new ModelRegistry()

      const criticConfig = registry.getModelForStage('critique')
      const plannerConfig = registry.getModelForStage('planning')

      // Critic should be more deterministic than planner
      expect(criticConfig.temperature).toBeLessThanOrEqual(plannerConfig.temperature)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty environment gracefully', () => {
      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config).toBeDefined()
      expect(config.primary).toBe('openrouter/auto')
    })

    it('should not crash on invalid stage', () => {
      const registry = new ModelRegistry()

      // TypeScript should prevent this, but test runtime behavior
      // @ts-expect-error Testing invalid stage handling
      const config = registry.getModelForStage('invalid_stage')

      expect(config).toBeDefined()
      expect(config.primary).toBeDefined()
    })
  })

  describe('Invalid Model Handling (Req 19.7)', () => {
    it('should fall back to openrouter/auto and warn when stage-specific model is empty string', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
      process.env.PLANNER_MODEL = ''

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config.primary).toBe('openrouter/auto')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PLANNER_MODEL')
      )
      warnSpy.mockRestore()
    })

    it('should fall back to openrouter/auto and warn when fallback model is empty string', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
      process.env.PLANNER_MODEL = 'anthropic/claude-3.5-sonnet'
      process.env.PLANNER_FALLBACK_MODEL = ''

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      // Primary should be untouched
      expect(config.primary).toBe('anthropic/claude-3.5-sonnet')
      // Fallback chain should start with openrouter/auto, not empty string
      expect(config.fallbacks[0]).toBe('openrouter/auto')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PLANNER_FALLBACK_MODEL')
      )
      warnSpy.mockRestore()
    })

    it('should fall back to openrouter/auto and warn when OPENROUTER_MODEL is empty string', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
      process.env.OPENROUTER_MODEL = ''

      const registry = new ModelRegistry()
      // OPENROUTER_MODEL is empty so the default 'openrouter/auto' should remain
      const config = registry.getModelForStage('planning')

      // Empty OPENROUTER_MODEL should not override the default
      expect(config.primary).toBe('openrouter/auto')
      warnSpy.mockRestore()
    })

    it('should trim whitespace-only model names and fall back to openrouter/auto', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
      process.env.PLANNER_MODEL = '   '

      const registry = new ModelRegistry()
      const config = registry.getModelForStage('planning')

      expect(config.primary).toBe('openrouter/auto')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PLANNER_MODEL')
      )
      warnSpy.mockRestore()
    })
  })
})
