/**
 * ResearchFindings Schema Tests
 * Tests Requirements 16.1-16.8, 22.2, 22.8
 */

import { describe, it, expect } from 'vitest'
import {
  ResearchFindingsSchema,
  ProductGapSchema,
  SecurityGapSchema,
  UXGapSchema,
  TechnicalRiskSchema,
  RecommendationSchema,
  SeverityLevelSchema,
  calculateCompletenessScore,
  type ResearchFindings,
} from './research-findings'
import { testRoundTrip } from './schema-utils'

describe('ResearchFindings Schema', () => {
  describe('SeverityLevelSchema', () => {
    it('should accept all valid severity levels', () => {
      expect(SeverityLevelSchema.parse('critical')).toBe('critical')
      expect(SeverityLevelSchema.parse('warning')).toBe('warning')
      expect(SeverityLevelSchema.parse('info')).toBe('info')
    })

    it('should reject invalid severity levels', () => {
      expect(() => SeverityLevelSchema.parse('high')).toThrow()
      expect(() => SeverityLevelSchema.parse('low')).toThrow()
    })
  })

  describe('ProductGapSchema', () => {
    it('should validate complete product gap', () => {
      const gap = {
        category: 'missing_feature' as const,
        description: 'No user profile management',
        severity: 'critical' as const,
        recommendation: 'Add profile edit functionality',
        affectedAreas: ['user management', 'settings'],
      }
      expect(() => ProductGapSchema.parse(gap)).not.toThrow()
    })

    it('should accept all valid categories', () => {
      const categories = ['missing_feature', 'incomplete_flow', 'undefined_state', 'edge_case'] as const
      categories.forEach(category => {
        const gap = {
          category,
          description: 'Test gap',
          severity: 'warning' as const,
          recommendation: 'Fix it',
        }
        expect(() => ProductGapSchema.parse(gap)).not.toThrow()
      })
    })

    it('should default affectedAreas to empty array', () => {
      const gap = {
        category: 'missing_feature' as const,
        description: 'Test',
        severity: 'info' as const,
        recommendation: 'Test',
      }
      const parsed = ProductGapSchema.parse(gap)
      expect(parsed.affectedAreas).toEqual([])
    })
  })

  describe('SecurityGapSchema', () => {
    it('should validate security gap with all fields', () => {
      const gap = {
        category: 'authentication' as const,
        description: 'No password strength requirements',
        severity: 'critical' as const,
        recommendation: 'Implement password validation',
        affectedFeatures: ['signup', 'password reset'],
      }
      expect(() => SecurityGapSchema.parse(gap)).not.toThrow()
    })

    it('should accept all security categories', () => {
      const categories = ['authentication', 'authorization', 'data_validation', 'injection_risk'] as const
      categories.forEach(category => {
        const gap = {
          category,
          description: 'Security issue',
          severity: 'critical' as const,
          recommendation: 'Fix security',
        }
        expect(() => SecurityGapSchema.parse(gap)).not.toThrow()
      })
    })
  })

  describe('UXGapSchema', () => {
    it('should validate UX gap', () => {
      const gap = {
        category: 'error_handling' as const,
        description: 'No error messages for form validation',
        severity: 'warning' as const,
        recommendation: 'Add inline error messages',
        affectedFlows: ['user registration', 'contact form'],
      }
      expect(() => UXGapSchema.parse(gap)).not.toThrow()
    })

    it('should accept all UX categories', () => {
      const categories = ['error_handling', 'loading_state', 'empty_state', 'navigation', 'feedback'] as const
      categories.forEach(category => {
        const gap = {
          category,
          description: 'UX issue',
          severity: 'info' as const,
          recommendation: 'Improve UX',
        }
        expect(() => UXGapSchema.parse(gap)).not.toThrow()
      })
    })
  })

  describe('TechnicalRiskSchema', () => {
    it('should validate technical risk', () => {
      const risk = {
        category: 'stack_violation' as const,
        description: 'Using PostgreSQL instead of Totalum SDK',
        severity: 'critical' as const,
        mitigation: 'Replace with Totalum SDK database',
      }
      expect(() => TechnicalRiskSchema.parse(risk)).not.toThrow()
    })

    it('should accept all risk categories', () => {
      const categories = ['stack_violation', 'integration_conflict', 'scalability', 'performance'] as const
      categories.forEach(category => {
        const risk = {
          category,
          description: 'Technical issue',
          severity: 'warning' as const,
          mitigation: 'Fix technical issue',
        }
        expect(() => TechnicalRiskSchema.parse(risk)).not.toThrow()
      })
    })
  })

  describe('RecommendationSchema', () => {
    it('should validate recommendation', () => {
      const rec = {
        priority: 'high' as const,
        action: 'Add user authentication',
        rationale: 'Security requirement for user data',
      }
      expect(() => RecommendationSchema.parse(rec)).not.toThrow()
    })

    it('should accept all priority levels', () => {
      const priorities = ['high', 'medium', 'low'] as const
      priorities.forEach(priority => {
        const rec = {
          priority,
          action: 'Do something',
          rationale: 'Because reasons',
        }
        expect(() => RecommendationSchema.parse(rec)).not.toThrow()
      })
    })
  })

  describe('ResearchFindingsSchema - Complete Object', () => {
    const validFindings: ResearchFindings = {
      missingFeatures: [
        {
          category: 'missing_feature',
          description: 'No password reset flow',
          severity: 'critical',
          recommendation: 'Add password reset functionality',
          affectedAreas: ['authentication'],
        },
      ],
      securityConcerns: [
        {
          category: 'data_validation',
          description: 'No input sanitization',
          severity: 'critical',
          recommendation: 'Add input validation',
          affectedFeatures: ['forms'],
        },
      ],
      uxGaps: [
        {
          category: 'loading_state',
          description: 'No loading indicators',
          severity: 'warning',
          recommendation: 'Add loading spinners',
          affectedFlows: ['data fetch'],
        },
      ],
      technicalRisks: [
        {
          category: 'stack_violation',
          description: 'Using Prisma',
          severity: 'critical',
          mitigation: 'Use Totalum SDK',
        },
      ],
      recommendations: [
        {
          priority: 'high',
          action: 'Implement authentication',
          rationale: 'Required for user data security',
        },
      ],
      completenessScore: 65,
      analyzedType: 'idea',
      createdAt: Date.now(),
      modelUsed: 'anthropic/claude-3.5-sonnet',
    }

    it('should validate complete ResearchFindings object', () => {
      expect(() => ResearchFindingsSchema.parse(validFindings)).not.toThrow()
    })

    it('should require completenessScore, analyzedType, and metadata', () => {
      const incomplete = { ...validFindings }
      delete (incomplete as any).completenessScore
      expect(() => ResearchFindingsSchema.parse(incomplete)).toThrow()
    })

    it('should validate completenessScore range (0-100)', () => {
      const invalidLow = { ...validFindings, completenessScore: -1 }
      const invalidHigh = { ...validFindings, completenessScore: 101 }

      expect(() => ResearchFindingsSchema.parse(invalidLow)).toThrow()
      expect(() => ResearchFindingsSchema.parse(invalidHigh)).toThrow()
    })

    it('should accept both "idea" and "website" analyzedType', () => {
      const ideaFindings = { ...validFindings, analyzedType: 'idea' as const }
      const websiteFindings = { ...validFindings, analyzedType: 'website' as const }

      expect(() => ResearchFindingsSchema.parse(ideaFindings)).not.toThrow()
      expect(() => ResearchFindingsSchema.parse(websiteFindings)).not.toThrow()
    })

    it('should default all arrays to empty', () => {
      const minimal: ResearchFindings = {
        missingFeatures: [],
        securityConcerns: [],
        uxGaps: [],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 100,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test/model',
      }
      const parsed = ResearchFindingsSchema.parse(minimal)
      expect(parsed.missingFeatures).toEqual([])
      expect(parsed.securityConcerns).toEqual([])
      expect(parsed.uxGaps).toEqual([])
      expect(parsed.technicalRisks).toEqual([])
      expect(parsed.recommendations).toEqual([])
    })
  })

  describe('calculateCompletenessScore (Requirement 16.5)', () => {
    it('should return 100 for findings with no issues', () => {
      const findings: ResearchFindings = {
        missingFeatures: [],
        securityConcerns: [],
        uxGaps: [],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 0, // Will be calculated
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(100)
    })

    it('should deduct 20 for each critical security concern', () => {
      const findings: ResearchFindings = {
        missingFeatures: [],
        securityConcerns: [
          {
            category: 'authentication',
            description: 'Issue 1',
            severity: 'critical',
            recommendation: 'Fix 1',
            affectedFeatures: [],
          },
          {
            category: 'authorization',
            description: 'Issue 2',
            severity: 'critical',
            recommendation: 'Fix 2',
            affectedFeatures: [],
          },
        ],
        uxGaps: [],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(60) // 100 - (2 * 20)
    })

    it('should deduct 15 for each critical feature gap', () => {
      const findings: ResearchFindings = {
        missingFeatures: [
          {
            category: 'missing_feature',
            description: 'Gap 1',
            severity: 'critical',
            recommendation: 'Add 1',
            affectedAreas: [],
          },
          {
            category: 'incomplete_flow',
            description: 'Gap 2',
            severity: 'critical',
            recommendation: 'Complete 2',
            affectedAreas: [],
          },
        ],
        securityConcerns: [],
        uxGaps: [],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(70) // 100 - (2 * 15)
    })

    it('should deduct 10 for each critical UX gap', () => {
      const findings: ResearchFindings = {
        missingFeatures: [],
        securityConcerns: [],
        uxGaps: [
          {
            category: 'error_handling',
            description: 'UX issue',
            severity: 'critical',
            recommendation: 'Fix UX',
            affectedFlows: [],
          },
        ],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(90) // 100 - 10
    })

    it('should deduct 15 for each critical technical risk', () => {
      const findings: ResearchFindings = {
        missingFeatures: [],
        securityConcerns: [],
        uxGaps: [],
        technicalRisks: [
          {
            category: 'stack_violation',
            description: 'Technical issue',
            severity: 'critical',
            mitigation: 'Fix tech',
          },
        ],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(85) // 100 - 15
    })

    it('should handle warning-level issues with smaller deductions', () => {
      const findings: ResearchFindings = {
        missingFeatures: [
          { category: 'missing_feature', description: 'Warning', severity: 'warning', recommendation: 'Fix', affectedAreas: [] },
        ],
        securityConcerns: [
          { category: 'data_validation', description: 'Warning', severity: 'warning', recommendation: 'Fix', affectedFeatures: [] },
        ],
        uxGaps: [
          { category: 'loading_state', description: 'Warning', severity: 'warning', recommendation: 'Fix', affectedFlows: [] },
        ],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(85) // 100 - 5 - 7 - 3
    })

    it('should not go below 0', () => {
      const findings: ResearchFindings = {
        missingFeatures: Array(10).fill(null).map(() => ({
          category: 'missing_feature' as const,
          description: 'Critical gap',
          severity: 'critical' as const,
          recommendation: 'Fix',
          affectedAreas: [],
        })),
        securityConcerns: [],
        uxGaps: [],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      expect(score).toBe(0) // Would be -50, but clamped to 0
    })

    it('should calculate complex scenario correctly', () => {
      const findings: ResearchFindings = {
        missingFeatures: [
          { category: 'missing_feature', description: 'Critical', severity: 'critical', recommendation: 'Fix', affectedAreas: [] },
          { category: 'edge_case', description: 'Warning', severity: 'warning', recommendation: 'Handle', affectedAreas: [] },
        ],
        securityConcerns: [
          { category: 'authentication', description: 'Critical', severity: 'critical', recommendation: 'Add auth', affectedFeatures: [] },
          { category: 'authorization', description: 'Warning', severity: 'warning', recommendation: 'Add authz', affectedFeatures: [] },
        ],
        uxGaps: [
          { category: 'error_handling', description: 'Warning', severity: 'warning', recommendation: 'Add errors', affectedFlows: [] },
        ],
        technicalRisks: [
          { category: 'stack_violation', description: 'Critical', severity: 'critical', mitigation: 'Fix stack' },
        ],
        recommendations: [],
        completenessScore: 0,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateCompletenessScore(findings)
      // 100 - 15(feature critical) - 5(feature warning) - 20(security critical) - 7(security warning) - 3(ux warning) - 15(tech critical)
      expect(score).toBe(35)
    })
  })

  describe('Round-Trip Serialization (Requirement 22.2, 22.8)', () => {
    it('should preserve all data through JSON round-trip', () => {
      const findings: ResearchFindings = {
        missingFeatures: [
          {
            category: 'missing_feature',
            description: 'No user profiles',
            severity: 'critical',
            recommendation: 'Add profile management',
            affectedAreas: ['users', 'settings'],
          },
          {
            category: 'incomplete_flow',
            description: 'Checkout flow incomplete',
            severity: 'warning',
            recommendation: 'Complete payment flow',
            affectedAreas: ['checkout'],
          },
        ],
        securityConcerns: [
          {
            category: 'authentication',
            description: 'Weak password policy',
            severity: 'critical',
            recommendation: 'Enforce strong passwords',
            affectedFeatures: ['signup', 'password reset'],
          },
        ],
        uxGaps: [
          {
            category: 'loading_state',
            description: 'No loading indicators',
            severity: 'warning',
            recommendation: 'Add spinners',
            affectedFlows: ['data loading'],
          },
        ],
        technicalRisks: [
          {
            category: 'stack_violation',
            description: 'Using unsupported ORM',
            severity: 'critical',
            mitigation: 'Use Totalum SDK',
          },
        ],
        recommendations: [
          {
            priority: 'high',
            action: 'Implement authentication',
            rationale: 'Security requirement',
          },
          {
            priority: 'medium',
            action: 'Add loading states',
            rationale: 'Better UX',
          },
        ],
        completenessScore: 55,
        analyzedType: 'website',
        createdAt: 1704067200000,
        modelUsed: 'anthropic/claude-3.5-sonnet',
      }

      const result = testRoundTrip(ResearchFindingsSchema, findings)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should preserve minimal findings through round-trip', () => {
      const minimal: ResearchFindings = {
        missingFeatures: [],
        securityConcerns: [],
        uxGaps: [],
        technicalRisks: [],
        recommendations: [],
        completenessScore: 100,
        analyzedType: 'idea',
        createdAt: Date.now(),
        modelUsed: 'test/model',
      }

      const result = testRoundTrip(ResearchFindingsSchema, minimal)
      expect(result.success).toBe(true)
    })
  })
})
