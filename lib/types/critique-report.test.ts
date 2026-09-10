/**
 * CritiqueReport Schema Tests
 * Tests Requirements 17.1-17.8, 22.3, 22.8
 */

import { describe, it, expect } from 'vitest'
import {
  CritiqueReportSchema,
  IssueSchema,
  IssueTypeSchema,
  IssueSeveritySchema,
  calculateQualityScore,
  type CritiqueReport,
  type Issue,
} from './critique-report'
import { testRoundTrip } from './schema-utils'

describe('CritiqueReport Schema', () => {
  describe('IssueTypeSchema', () => {
    it('should accept all valid issue types', () => {
      const types = [
        'missing_definition',
        'inconsistent_reference',
        'circular_dependency',
        'stack_violation',
        'role_mismatch',
        'auth_inconsistency',
      ] as const

      types.forEach(type => {
        expect(IssueTypeSchema.parse(type)).toBe(type)
      })
    })

    it('should reject invalid issue types', () => {
      expect(() => IssueTypeSchema.parse('unknown_type')).toThrow()
    })
  })

  describe('IssueSeveritySchema', () => {
    it('should accept all valid severity levels', () => {
      expect(IssueSeveritySchema.parse('critical')).toBe('critical')
      expect(IssueSeveritySchema.parse('warning')).toBe('warning')
      expect(IssueSeveritySchema.parse('info')).toBe('info')
    })

    it('should reject invalid severity levels', () => {
      expect(() => IssueSeveritySchema.parse('high')).toThrow()
    })
  })

  describe('IssueSchema', () => {
    it('should validate complete issue with all fields', () => {
      const issue: Issue = {
        fieldPath: '$.dataEntities[2].name',
        issueType: 'missing_definition',
        severity: 'critical',
        description: 'Referenced entity is not defined',
        recommendation: 'Add missing entity definition',
        currentValue: 'Order',
        suggestedValue: 'Define Order entity in dataEntities array',
      }
      expect(() => IssueSchema.parse(issue)).not.toThrow()
    })

    it('should validate issue without optional fields', () => {
      const issue: Issue = {
        fieldPath: '$.authenticationRequirements',
        issueType: 'auth_inconsistency',
        severity: 'warning',
        description: 'Auth features enabled but no requirements defined',
        recommendation: 'Add authentication requirements',
      }
      expect(() => IssueSchema.parse(issue)).not.toThrow()
    })

    it('should accept JSONPath format for fieldPath', () => {
      const paths = [
        '$.dataEntities[0]',
        '$.coreFlows[3].name',
        '$.userRoles',
        '$.suggestedFeatures[1].enabled',
      ]

      paths.forEach(path => {
        const issue = {
          fieldPath: path,
          issueType: 'inconsistent_reference' as const,
          severity: 'warning' as const,
          description: 'Test issue',
          recommendation: 'Fix it',
        }
        expect(() => IssueSchema.parse(issue)).not.toThrow()
      })
    })

    it('should require all mandatory fields', () => {
      const incomplete = {
        fieldPath: '$.test',
        issueType: 'stack_violation',
        // missing severity, description, recommendation
      }
      expect(() => IssueSchema.parse(incomplete)).toThrow()
    })
  })

  describe('CritiqueReportSchema - Complete Object', () => {
    const validReport: CritiqueReport = {
      criticalIssues: [
        {
          fieldPath: '$.dataEntities[2]',
          issueType: 'missing_definition',
          severity: 'critical',
          description: 'Order entity referenced but not defined',
          recommendation: 'Add Order entity to dataEntities',
        },
        {
          fieldPath: '$.backendRequirements[0]',
          issueType: 'stack_violation',
          severity: 'critical',
          description: 'References PostgreSQL directly',
          recommendation: 'Use Totalum SDK database instead',
          currentValue: 'PostgreSQL database',
          suggestedValue: 'Totalum SDK database',
        },
      ],
      warnings: [
        {
          fieldPath: '$.userRoles',
          issueType: 'role_mismatch',
          severity: 'warning',
          description: 'Flow references "manager" role not in userRoles',
          recommendation: 'Add "manager" to userRoles array',
        },
      ],
      suggestions: [
        {
          fieldPath: '$.coreFlows',
          issueType: 'inconsistent_reference',
          severity: 'info',
          description: 'Consider adding error handling flow',
          recommendation: 'Document error scenarios',
        },
      ],
      overallAssessment: 'Specification has 2 critical issues that must be resolved',
      passesValidation: false,
      qualityScore: 55,
      createdAt: Date.now(),
      modelUsed: 'anthropic/claude-3.5-sonnet',
    }

    it('should validate complete CritiqueReport object', () => {
      expect(() => CritiqueReportSchema.parse(validReport)).not.toThrow()
    })

    it('should require overallAssessment and passesValidation', () => {
      const incomplete = { ...validReport }
      delete (incomplete as any).overallAssessment
      expect(() => CritiqueReportSchema.parse(incomplete)).toThrow()
    })

    it('should require qualityScore in valid range', () => {
      const invalidLow = { ...validReport, qualityScore: -1 }
      const invalidHigh = { ...validReport, qualityScore: 101 }

      expect(() => CritiqueReportSchema.parse(invalidLow)).toThrow()
      expect(() => CritiqueReportSchema.parse(invalidHigh)).toThrow()
    })

    it('should require metadata fields', () => {
      const noMetadata = { ...validReport }
      delete (noMetadata as any).createdAt
      expect(() => CritiqueReportSchema.parse(noMetadata)).toThrow()
    })

    it('should default arrays to empty', () => {
      const minimal: CritiqueReport = {
        criticalIssues: [],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Specification looks good',
        passesValidation: true,
        qualityScore: 100,
        createdAt: Date.now(),
        modelUsed: 'test/model',
      }
      const parsed = CritiqueReportSchema.parse(minimal)
      expect(parsed.criticalIssues).toEqual([])
      expect(parsed.warnings).toEqual([])
      expect(parsed.suggestions).toEqual([])
    })
  })

  describe('calculateQualityScore (Requirement 17.1)', () => {
    it('should return 100 for report with no issues', () => {
      const report: CritiqueReport = {
        criticalIssues: [],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Perfect',
        passesValidation: true,
        qualityScore: 0, // Will be calculated
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      expect(score).toBe(100)
    })

    it('should deduct 20 points per critical issue', () => {
      const report: CritiqueReport = {
        criticalIssues: [
          {
            fieldPath: '$.test1',
            issueType: 'missing_definition',
            severity: 'critical',
            description: 'Issue 1',
            recommendation: 'Fix 1',
          },
          {
            fieldPath: '$.test2',
            issueType: 'stack_violation',
            severity: 'critical',
            description: 'Issue 2',
            recommendation: 'Fix 2',
          },
        ],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Has issues',
        passesValidation: false,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      expect(score).toBe(60) // 100 - (2 * 20)
    })

    it('should deduct 5 points per warning', () => {
      const report: CritiqueReport = {
        criticalIssues: [],
        warnings: [
          {
            fieldPath: '$.test1',
            issueType: 'role_mismatch',
            severity: 'warning',
            description: 'Warning 1',
            recommendation: 'Fix 1',
          },
          {
            fieldPath: '$.test2',
            issueType: 'inconsistent_reference',
            severity: 'warning',
            description: 'Warning 2',
            recommendation: 'Fix 2',
          },
        ],
        suggestions: [],
        overallAssessment: 'Minor issues',
        passesValidation: true,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      expect(score).toBe(90) // 100 - (2 * 5)
    })

    it('should deduct 1 point per suggestion', () => {
      const report: CritiqueReport = {
        criticalIssues: [],
        warnings: [],
        suggestions: [
          {
            fieldPath: '$.test1',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Suggestion 1',
            recommendation: 'Consider 1',
          },
          {
            fieldPath: '$.test2',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Suggestion 2',
            recommendation: 'Consider 2',
          },
          {
            fieldPath: '$.test3',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Suggestion 3',
            recommendation: 'Consider 3',
          },
        ],
        overallAssessment: 'Could be better',
        passesValidation: true,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      expect(score).toBe(97) // 100 - 3
    })

    it('should not go below 0', () => {
      const report: CritiqueReport = {
        criticalIssues: Array(10).fill(null).map((_, i) => ({
          fieldPath: `$.test${i}`,
          issueType: 'missing_definition' as const,
          severity: 'critical' as const,
          description: 'Critical issue',
          recommendation: 'Fix it',
        })),
        warnings: [],
        suggestions: [],
        overallAssessment: 'Many issues',
        passesValidation: false,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      expect(score).toBe(0) // Would be -100, but clamped to 0
    })

    it('should not go above 100', () => {
      const report: CritiqueReport = {
        criticalIssues: [],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Perfect',
        passesValidation: true,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      expect(score).toBe(100)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should calculate mixed scenario correctly', () => {
      const report: CritiqueReport = {
        criticalIssues: [
          {
            fieldPath: '$.critical',
            issueType: 'missing_definition',
            severity: 'critical',
            description: 'Critical',
            recommendation: 'Fix',
          },
        ],
        warnings: [
          {
            fieldPath: '$.warn1',
            issueType: 'role_mismatch',
            severity: 'warning',
            description: 'Warning 1',
            recommendation: 'Fix',
          },
          {
            fieldPath: '$.warn2',
            issueType: 'auth_inconsistency',
            severity: 'warning',
            description: 'Warning 2',
            recommendation: 'Fix',
          },
        ],
        suggestions: [
          {
            fieldPath: '$.suggest1',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Suggestion 1',
            recommendation: 'Consider',
          },
          {
            fieldPath: '$.suggest2',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Suggestion 2',
            recommendation: 'Consider',
          },
          {
            fieldPath: '$.suggest3',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Suggestion 3',
            recommendation: 'Consider',
          },
        ],
        overallAssessment: 'Mixed quality',
        passesValidation: false,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: 'test',
      }
      const score = calculateQualityScore(report)
      // 100 - 20(1 critical) - 10(2 warnings) - 3(3 suggestions) = 67
      expect(score).toBe(67)
    })
  })

  describe('Round-Trip Serialization (Requirement 22.3, 22.8)', () => {
    it('should preserve all data through JSON round-trip', () => {
      const report: CritiqueReport = {
        criticalIssues: [
          {
            fieldPath: '$.dataEntities[3]',
            issueType: 'missing_definition',
            severity: 'critical',
            description: 'Payment entity referenced but not defined',
            recommendation: 'Add Payment entity to dataEntities array',
            currentValue: 'Payment',
          },
          {
            fieldPath: '$.integrations[0]',
            issueType: 'stack_violation',
            severity: 'critical',
            description: 'References Prisma ORM',
            recommendation: 'Use Totalum SDK instead',
            currentValue: 'Prisma ORM',
            suggestedValue: 'Totalum SDK',
          },
        ],
        warnings: [
          {
            fieldPath: '$.coreFlows[1]',
            issueType: 'role_mismatch',
            severity: 'warning',
            description: 'Flow references undefined "moderator" role',
            recommendation: 'Add "moderator" to userRoles',
          },
          {
            fieldPath: '$.authenticationRequirements',
            issueType: 'auth_inconsistency',
            severity: 'warning',
            description: 'Auth feature enabled but requirements not specified',
            recommendation: 'Define authentication requirements',
          },
        ],
        suggestions: [
          {
            fieldPath: '$.coreFlows',
            issueType: 'inconsistent_reference',
            severity: 'info',
            description: 'Consider adding password reset flow',
            recommendation: 'Add password reset to improve security',
          },
        ],
        overallAssessment: 'Specification has 2 critical issues and 2 warnings that should be addressed',
        passesValidation: false,
        qualityScore: 60,
        createdAt: 1704067200000,
        modelUsed: 'anthropic/claude-3.5-sonnet',
      }

      const result = testRoundTrip(CritiqueReportSchema, report)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should preserve minimal report through round-trip', () => {
      const minimal: CritiqueReport = {
        criticalIssues: [],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Specification is well-formed',
        passesValidation: true,
        qualityScore: 100,
        createdAt: Date.now(),
        modelUsed: 'test/model',
      }

      const result = testRoundTrip(CritiqueReportSchema, minimal)
      expect(result.success).toBe(true)
    })

    it('should preserve JSONPath fieldPath formats', () => {
      const report: CritiqueReport = {
        criticalIssues: [
          {
            fieldPath: '$.dataEntities[0].fields[2]',
            issueType: 'inconsistent_reference',
            severity: 'critical',
            description: 'Deeply nested reference',
            recommendation: 'Fix it',
          },
        ],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Test',
        passesValidation: false,
        qualityScore: 80,
        createdAt: Date.now(),
        modelUsed: 'test',
      }

      const result = testRoundTrip(CritiqueReportSchema, report)
      expect(result.success).toBe(true)
    })

    it('should preserve passesValidation boolean correctly through round-trip', () => {
      const passing: CritiqueReport = {
        criticalIssues: [],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Specification passes validation',
        passesValidation: true,
        qualityScore: 100,
        createdAt: 1704067200000,
        modelUsed: 'test/model',
      }
      const failing: CritiqueReport = {
        criticalIssues: [
          {
            fieldPath: '$.dataEntities',
            issueType: 'missing_definition',
            severity: 'critical',
            description: 'Missing entity',
            recommendation: 'Add entity',
          },
        ],
        warnings: [],
        suggestions: [],
        overallAssessment: 'Specification fails validation',
        passesValidation: false,
        qualityScore: 80,
        createdAt: 1704067200000,
        modelUsed: 'test/model',
      }

      const passingResult = testRoundTrip(CritiqueReportSchema, passing)
      expect(passingResult.success).toBe(true)
      // Verify the boolean value is preserved
      const parsedPassing = CritiqueReportSchema.parse(JSON.parse(JSON.stringify(passing)))
      expect(parsedPassing.passesValidation).toBe(true)

      const failingResult = testRoundTrip(CritiqueReportSchema, failing)
      expect(failingResult.success).toBe(true)
      const parsedFailing = CritiqueReportSchema.parse(JSON.parse(JSON.stringify(failing)))
      expect(parsedFailing.passesValidation).toBe(false)
    })
  })

  describe('Issue Type Scenarios', () => {
    it('should handle all issue types correctly', () => {
      const issueTypes = [
        'missing_definition',
        'inconsistent_reference',
        'circular_dependency',
        'stack_violation',
        'role_mismatch',
        'auth_inconsistency',
      ] as const

      issueTypes.forEach(issueType => {
        const issue: Issue = {
          fieldPath: '$.test',
          issueType,
          severity: 'warning',
          description: `Test ${issueType}`,
          recommendation: 'Fix it',
        }
        expect(() => IssueSchema.parse(issue)).not.toThrow()
      })
    })
  })
})
