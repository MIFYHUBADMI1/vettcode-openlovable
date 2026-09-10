/**
 * Planning_Run Schema Tests
 * Tests Requirements 18.1-18.8, 22.4, 22.8
 */

import { describe, it, expect } from 'vitest'
import {
  PlanningRunSchema,
  StageResultSchema,
  RunOutcomeSchema,
  PipelineStageSchema,
  RunStatusSchema,
  PipelineModeSchema,
  type PlanningRun,
  type StageResult,
  type RunOutcome,
} from './planning-run'
import { testRoundTrip } from './schema-utils'

describe('Planning_Run Schema', () => {
  describe('PipelineStageSchema', () => {
    it('should accept all valid pipeline stages', () => {
      const stages = [
        'idea_understanding',
        'website_understanding',
        'research',
        'planning',
        'critique',
        'repair',
        'semantic_validation',
        'sanitization',
        'complexity_classification',
      ] as const

      stages.forEach(stage => {
        expect(PipelineStageSchema.parse(stage)).toBe(stage)
      })
    })

    it('should reject invalid stage names', () => {
      expect(() => PipelineStageSchema.parse('unknown_stage')).toThrow()
      expect(() => PipelineStageSchema.parse('validation')).toThrow()
    })
  })

  describe('RunStatusSchema', () => {
    it('should accept all valid statuses', () => {
      expect(RunStatusSchema.parse('running')).toBe('running')
      expect(RunStatusSchema.parse('completed')).toBe('completed')
      expect(RunStatusSchema.parse('failed')).toBe('failed')
    })

    it('should reject invalid statuses', () => {
      expect(() => RunStatusSchema.parse('pending')).toThrow()
      expect(() => RunStatusSchema.parse('cancelled')).toThrow()
    })
  })

  describe('PipelineModeSchema', () => {
    it('should accept all valid modes', () => {
      expect(PipelineModeSchema.parse('idea')).toBe('idea')
      expect(PipelineModeSchema.parse('website')).toBe('website')
      expect(PipelineModeSchema.parse('deepCrawl')).toBe('deepCrawl')
    })

    it('should reject invalid modes', () => {
      expect(() => PipelineModeSchema.parse('scratch')).toThrow()
    })
  })

  describe('StageResultSchema', () => {
    it('should validate complete stage result', () => {
      const result: StageResult = {
        stage: 'planning',
        model: 'anthropic/claude-3.5-sonnet',
        startedAt: 1704067200000,
        completedAt: 1704067260000,
        durationMs: 60000,
        tokens: 15000,
        success: true,
        retries: 0,
      }
      expect(() => StageResultSchema.parse(result)).not.toThrow()
    })

    it('should default retries to 0', () => {
      const result = {
        stage: 'research',
        model: 'anthropic/claude-3.5-sonnet',
        startedAt: Date.now(),
        completedAt: Date.now() + 1000,
        durationMs: 1000,
        tokens: 5000,
        success: true,
      }
      const parsed = StageResultSchema.parse(result)
      expect(parsed.retries).toBe(0)
    })

    it('should include error message for failed stages', () => {
      const result: StageResult = {
        stage: 'critique',
        model: 'openai/gpt-4',
        startedAt: Date.now(),
        completedAt: Date.now() + 5000,
        durationMs: 5000,
        tokens: 0,
        success: false,
        retries: 2,
        error: 'Rate limit exceeded',
      }
      expect(() => StageResultSchema.parse(result)).not.toThrow()
    })

    it('should allow error to be optional', () => {
      const result: StageResult = {
        stage: 'semantic_validation',
        model: 'internal',
        startedAt: Date.now(),
        completedAt: Date.now() + 1000,
        durationMs: 1000,
        tokens: 0,
        success: true,
        retries: 0,
      }
      const parsed = StageResultSchema.parse(result)
      expect(parsed.error).toBeUndefined()
    })
  })

  describe('RunOutcomeSchema', () => {
    it('should validate outcome with all optional fields', () => {
      const outcome: RunOutcome = {
        specificationId: 'spec_abc123',
        qualityScore: 87,
        completenessScore: 92,
      }
      expect(() => RunOutcomeSchema.parse(outcome)).not.toThrow()
    })

    it('should validate outcome with legacy flag', () => {
      const outcome: RunOutcome = {
        legacy: true,
      }
      expect(() => RunOutcomeSchema.parse(outcome)).not.toThrow()
    })

    it('should validate empty outcome object', () => {
      const outcome: RunOutcome = {}
      expect(() => RunOutcomeSchema.parse(outcome)).not.toThrow()
    })

    it('should allow all fields to be optional', () => {
      const parsed = RunOutcomeSchema.parse({})
      expect(parsed.specificationId).toBeUndefined()
      expect(parsed.qualityScore).toBeUndefined()
      expect(parsed.completenessScore).toBeUndefined()
      expect(parsed.legacy).toBeUndefined()
    })
  })

  describe('PlanningRunSchema - Complete Object', () => {
    const now = 1704067200000

    const validRun: PlanningRun = {
      id: 'run_123456',
      projectId: 'proj_abc123',
      userId: 'user_xyz789',
      mode: 'idea',
      startedAt: now,
      completedAt: now + 180000,
      status: 'completed',
      stageResults: [
        {
          stage: 'idea_understanding',
          model: 'anthropic/claude-3.5-sonnet',
          startedAt: now,
          completedAt: now + 30000,
          durationMs: 30000,
          tokens: 5000,
          success: true,
          retries: 0,
        },
        {
          stage: 'research',
          model: 'anthropic/claude-3.5-sonnet',
          startedAt: now + 30000,
          completedAt: now + 70000,
          durationMs: 40000,
          tokens: 8000,
          success: true,
          retries: 1,
        },
        {
          stage: 'planning',
          model: 'anthropic/claude-3.5-sonnet',
          startedAt: now + 70000,
          completedAt: now + 130000,
          durationMs: 60000,
          tokens: 15000,
          success: true,
          retries: 0,
        },
      ],
      totalTokens: 28000,
      totalDurationMs: 180000,
      outcome: {
        specificationId: 'spec_xyz789',
        qualityScore: 87,
        completenessScore: 92,
      },
      createdAt: now,
    }

    it('should validate complete PlanningRun object', () => {
      expect(() => PlanningRunSchema.parse(validRun)).not.toThrow()
    })

    it('should require all mandatory fields', () => {
      const incomplete = { ...validRun }
      delete (incomplete as any).projectId
      expect(() => PlanningRunSchema.parse(incomplete)).toThrow()
    })

    it('should require createdAt field', () => {
      const withoutCreatedAt = { ...validRun }
      delete (withoutCreatedAt as any).createdAt
      expect(() => PlanningRunSchema.parse(withoutCreatedAt)).toThrow()
    })

    it('should make completedAt optional for running status', () => {
      const running: PlanningRun = {
        id: 'run_running',
        projectId: 'proj_123',
        userId: 'user_456',
        mode: 'website',
        startedAt: now,
        status: 'running',
        stageResults: [],
        totalTokens: 0,
        totalDurationMs: 0,
        createdAt: now,
      }
      const parsed = PlanningRunSchema.parse(running)
      expect(parsed.completedAt).toBeUndefined()
    })

    it('should default totalTokens and totalDurationMs to 0', () => {
      const minimal = {
        id: 'run_minimal',
        projectId: 'proj_123',
        userId: 'user_456',
        mode: 'idea',
        startedAt: now,
        status: 'running',
        createdAt: now,
      }
      const parsed = PlanningRunSchema.parse(minimal)
      expect(parsed.totalTokens).toBe(0)
      expect(parsed.totalDurationMs).toBe(0)
      expect(parsed.stageResults).toEqual([])
    })

    it('should allow outcome to be optional', () => {
      const running = { ...validRun, status: 'running' as const }
      delete (running as any).outcome
      const parsed = PlanningRunSchema.parse(running)
      expect(parsed.outcome).toBeUndefined()
    })

    it('should track error for failed runs', () => {
      const failed: PlanningRun = {
        id: 'run_failed',
        projectId: 'proj_123',
        userId: 'user_456',
        mode: 'idea',
        startedAt: now,
        completedAt: now + 10000,
        status: 'failed',
        stageResults: [
          {
            stage: 'idea_understanding',
            model: 'test/model',
            startedAt: now,
            completedAt: now + 5000,
            durationMs: 5000,
            tokens: 1000,
            success: false,
            retries: 3,
            error: 'Max retries exceeded',
          },
        ],
        totalTokens: 1000,
        totalDurationMs: 5000,
        error: 'Pipeline failed at idea_understanding stage',
        createdAt: now,
      }
      expect(() => PlanningRunSchema.parse(failed)).not.toThrow()
    })
  })

  describe('Mode-Specific Scenarios', () => {
    const now = Date.now()

    it('should validate idea mode run', () => {
      const ideaRun: PlanningRun = {
        id: 'run_idea',
        projectId: 'proj_idea',
        userId: 'user_123',
        mode: 'idea',
        startedAt: now,
        status: 'running',
        stageResults: [
          {
            stage: 'idea_understanding',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now,
            completedAt: now + 30000,
            durationMs: 30000,
            tokens: 5000,
            success: true,
            retries: 0,
          },
        ],
        totalTokens: 5000,
        totalDurationMs: 30000,
        createdAt: now,
      }
      expect(() => PlanningRunSchema.parse(ideaRun)).not.toThrow()
    })

    it('should validate website mode run', () => {
      const websiteRun: PlanningRun = {
        id: 'run_website',
        projectId: 'proj_website',
        userId: 'user_123',
        mode: 'website',
        startedAt: now,
        status: 'running',
        stageResults: [
          {
            stage: 'website_understanding',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now,
            completedAt: now + 45000,
            durationMs: 45000,
            tokens: 8000,
            success: true,
            retries: 0,
          },
        ],
        totalTokens: 8000,
        totalDurationMs: 45000,
        createdAt: now,
      }
      expect(() => PlanningRunSchema.parse(websiteRun)).not.toThrow()
    })

    it('should validate deepCrawl mode run', () => {
      const deepCrawlRun: PlanningRun = {
        id: 'run_deepcrawl',
        projectId: 'proj_deepcrawl',
        userId: 'user_123',
        mode: 'deepCrawl',
        startedAt: now,
        completedAt: now + 120000,
        status: 'completed',
        stageResults: [
          {
            stage: 'planning',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now,
            completedAt: now + 90000,
            durationMs: 90000,
            tokens: 20000,
            success: true,
            retries: 0,
          },
        ],
        totalTokens: 20000,
        totalDurationMs: 120000,
        outcome: {
          specificationId: 'spec_deepcrawl_1',
          qualityScore: 75,
        },
        createdAt: now,
      }
      expect(() => PlanningRunSchema.parse(deepCrawlRun)).not.toThrow()
    })
  })

  describe('Stage Result Tracking', () => {
    const now = 1704067200000

    it('should track multiple stage results in order', () => {
      const run: PlanningRun = {
        id: 'run_multi',
        projectId: 'proj_123',
        userId: 'user_456',
        mode: 'idea',
        startedAt: now,
        status: 'running',
        stageResults: [
          {
            stage: 'idea_understanding',
            model: 'model1',
            startedAt: now,
            completedAt: now + 30000,
            durationMs: 30000,
            tokens: 5000,
            success: true,
            retries: 0,
          },
          {
            stage: 'research',
            model: 'model2',
            startedAt: now + 30000,
            completedAt: now + 70000,
            durationMs: 40000,
            tokens: 8000,
            success: true,
            retries: 0,
          },
          {
            stage: 'planning',
            model: 'model1',
            startedAt: now + 70000,
            completedAt: now + 130000,
            durationMs: 60000,
            tokens: 15000,
            success: true,
            retries: 0,
          },
          {
            stage: 'critique',
            model: 'model2',
            startedAt: now + 130000,
            completedAt: now + 160000,
            durationMs: 30000,
            tokens: 7000,
            success: true,
            retries: 0,
          },
        ],
        totalTokens: 35000,
        totalDurationMs: 160000,
        createdAt: now,
      }
      expect(() => PlanningRunSchema.parse(run)).not.toThrow()
    })

    it('should track retry attempts per stage', () => {
      const result: StageResult = {
        stage: 'research',
        model: 'anthropic/claude-3.5-sonnet',
        startedAt: Date.now(),
        completedAt: Date.now() + 120000,
        durationMs: 120000,
        tokens: 8000,
        success: true,
        retries: 3, // Succeeded after 3 retries
      }
      expect(() => StageResultSchema.parse(result)).not.toThrow()
    })

    it('should validate semantic_validation and complexity_classification stages', () => {
      const now = Date.now()
      const validationResult: StageResult = {
        stage: 'semantic_validation',
        model: 'internal',
        startedAt: now,
        completedAt: now + 1000,
        durationMs: 1000,
        tokens: 0,
        success: true,
        retries: 0,
      }
      const complexityResult: StageResult = {
        stage: 'complexity_classification',
        model: 'internal',
        startedAt: now + 1000,
        completedAt: now + 2000,
        durationMs: 1000,
        tokens: 0,
        success: true,
        retries: 0,
      }
      expect(() => StageResultSchema.parse(validationResult)).not.toThrow()
      expect(() => StageResultSchema.parse(complexityResult)).not.toThrow()
    })
  })

  describe('Round-Trip Serialization (Requirement 22.4, 22.8)', () => {
    const now = 1704067200000

    it('should preserve complete run through JSON round-trip', () => {
      const run: PlanningRun = {
        id: 'run_complete',
        projectId: 'proj_ecommerce',
        userId: 'user_alice',
        mode: 'idea',
        startedAt: now,
        completedAt: now + 180000,
        status: 'completed',
        stageResults: [
          {
            stage: 'idea_understanding',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now,
            completedAt: now + 30000,
            durationMs: 30000,
            tokens: 5000,
            success: true,
            retries: 0,
          },
          {
            stage: 'research',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now + 30000,
            completedAt: now + 75000,
            durationMs: 45000,
            tokens: 8500,
            success: true,
            retries: 1,
          },
          {
            stage: 'planning',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now + 75000,
            completedAt: now + 135000,
            durationMs: 60000,
            tokens: 15000,
            success: true,
            retries: 0,
          },
          {
            stage: 'critique',
            model: 'openai/gpt-4',
            startedAt: now + 135000,
            completedAt: now + 160000,
            durationMs: 25000,
            tokens: 7000,
            success: true,
            retries: 0,
          },
          {
            stage: 'semantic_validation',
            model: 'internal',
            startedAt: now + 160000,
            completedAt: now + 165000,
            durationMs: 5000,
            tokens: 0,
            success: true,
            retries: 0,
          },
          {
            stage: 'sanitization',
            model: 'internal',
            startedAt: now + 165000,
            completedAt: now + 170000,
            durationMs: 5000,
            tokens: 0,
            success: true,
            retries: 0,
          },
          {
            stage: 'complexity_classification',
            model: 'internal',
            startedAt: now + 170000,
            completedAt: now + 172000,
            durationMs: 2000,
            tokens: 0,
            success: true,
            retries: 0,
          },
        ],
        totalTokens: 35500,
        totalDurationMs: 180000,
        outcome: {
          specificationId: 'spec_ecommerce_1',
          qualityScore: 87,
          completenessScore: 92,
        },
        createdAt: now,
      }

      const result = testRoundTrip(PlanningRunSchema, run)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should preserve failed run through round-trip', () => {
      const now = 1704067200000
      const failed: PlanningRun = {
        id: 'run_failed',
        projectId: 'proj_failed',
        userId: 'user_bob',
        mode: 'website',
        startedAt: now,
        completedAt: now + 15000,
        status: 'failed',
        stageResults: [
          {
            stage: 'website_understanding',
            model: 'anthropic/claude-3.5-sonnet',
            startedAt: now,
            completedAt: now + 10000,
            durationMs: 10000,
            tokens: 2000,
            success: false,
            retries: 3,
            error: 'Max retries exceeded: Rate limit error',
          },
        ],
        totalTokens: 2000,
        totalDurationMs: 15000,
        error: 'Pipeline failed at website_understanding stage after 3 retries',
        createdAt: now,
      }

      const result = testRoundTrip(PlanningRunSchema, failed)
      expect(result.success).toBe(true)
    })

    it('should preserve minimal running state through round-trip', () => {
      const now = Date.now()
      const running: PlanningRun = {
        id: 'run_minimal',
        projectId: 'proj_123',
        userId: 'user_456',
        mode: 'deepCrawl',
        startedAt: now,
        status: 'running',
        stageResults: [],
        totalTokens: 0,
        totalDurationMs: 0,
        createdAt: now,
      }

      const result = testRoundTrip(PlanningRunSchema, running)
      expect(result.success).toBe(true)
    })

    it('should preserve outcome quality metrics through round-trip', () => {
      const now = Date.now()
      const run: PlanningRun = {
        id: 'run_with_outcome',
        projectId: 'proj_123',
        userId: 'user_456',
        mode: 'idea',
        startedAt: now,
        completedAt: now + 90000,
        status: 'completed',
        stageResults: [],
        totalTokens: 10000,
        totalDurationMs: 90000,
        outcome: {
          specificationId: 'spec_abc123',
          qualityScore: 95,
          completenessScore: 88,
          legacy: false,
        },
        createdAt: now,
      }

      const result = testRoundTrip(PlanningRunSchema, run)
      expect(result.success).toBe(true)

      // Verify the schema parses the outcome fields correctly after round-trip
      const reparsed = PlanningRunSchema.parse(
        JSON.parse(JSON.stringify(run))
      )
      expect(reparsed.outcome?.qualityScore).toBe(95)
      expect(reparsed.outcome?.completenessScore).toBe(88)
    })
  })
})
