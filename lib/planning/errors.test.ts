/**
 * Unit tests for planning pipeline error taxonomy
 * 
 * Tests error construction, inheritance, retry behavior, and utility methods.
 * Validates Requirement 11.3: Error Handling and Resilience
 */

import { describe, it, expect } from 'vitest'
import {
  PipelineError,
  UnderstandingError,
  ResearchError,
  PlanningError,
  ValidationError,
  CreditInsufficientError,
  type ValidationErrorDetail,
  type PipelineStage,
} from './errors'

describe('PipelineError', () => {
  it('should create a base pipeline error with all properties', () => {
    const error = new PipelineError(
      'Technical error message',
      'planning',
      true,
      'User-friendly message'
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Technical error message')
    expect(error.stage).toBe('planning')
    expect(error.retryable).toBe(true)
    expect(error.userMessage).toBe('User-friendly message')
    expect(error.name).toBe('PipelineError')
  })

  it('should capture stack trace', () => {
    const error = new PipelineError('Test error', 'planning', false, 'User message')

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('PipelineError')
  })

  it('should support all pipeline stages', () => {
    const stages: PipelineStage[] = [
      'understanding',
      'research',
      'planning',
      'critique',
      'repair',
      'validation',
      'sanitization',
      'credit_check',
    ]

    stages.forEach(stage => {
      const error = new PipelineError('Test', stage, true, 'User message')
      expect(error.stage).toBe(stage)
    })
  })
})

describe('UnderstandingError', () => {
  it('should extend PipelineError with understanding stage', () => {
    const error = new UnderstandingError(
      'Failed to parse idea',
      'Please provide more details about your application'
    )

    expect(error).toBeInstanceOf(PipelineError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('UnderstandingError')
    expect(error.stage).toBe('understanding')
    expect(error.retryable).toBe(true)
    expect(error.message).toBe('Failed to parse idea')
    expect(error.userMessage).toBe('Please provide more details about your application')
  })

  it('should be retryable by default', () => {
    const error = new UnderstandingError('Test error', 'User message')
    expect(error.retryable).toBe(true)
  })
})

describe('ResearchError', () => {
  it('should extend PipelineError with research stage', () => {
    const error = new ResearchError('Research agent timeout')

    expect(error).toBeInstanceOf(PipelineError)
    expect(error.name).toBe('ResearchError')
    expect(error.stage).toBe('research')
    expect(error.retryable).toBe(true)
    expect(error.message).toBe('Research agent timeout')
  })

  it('should have a default user message indicating continuation', () => {
    const error = new ResearchError('Test error')

    expect(error.userMessage).toBe('Research analysis encountered an issue but will continue')
  })

  it('should be retryable', () => {
    const error = new ResearchError('Test error')
    expect(error.retryable).toBe(true)
  })
})

describe('PlanningError', () => {
  it('should extend PipelineError with planning stage', () => {
    const error = new PlanningError('Failed to generate specification')

    expect(error).toBeInstanceOf(PipelineError)
    expect(error.name).toBe('PlanningError')
    expect(error.stage).toBe('planning')
    expect(error.retryable).toBe(true)
    expect(error.message).toBe('Failed to generate specification')
  })

  it('should have a default user message prompting retry', () => {
    const error = new PlanningError('Test error')

    expect(error.userMessage).toBe('Specification generation failed. Please try again.')
  })

  it('should be retryable', () => {
    const error = new PlanningError('Test error')
    expect(error.retryable).toBe(true)
  })
})

describe('ValidationError', () => {
  const sampleErrors: ValidationErrorDetail[] = [
    {
      fieldPath: '$.dataEntities[0].name',
      message: 'Entity name is required',
      severity: 'critical',
      currentValue: '',
      suggestedValue: 'User',
    },
    {
      fieldPath: '$.userRoles[1]',
      message: 'Duplicate role definition',
      severity: 'warning',
    },
    {
      fieldPath: '$.coreFlows[2].steps',
      message: 'Flow has no steps defined',
      severity: 'critical',
    },
  ]

  it('should extend PipelineError with validation stage', () => {
    const error = new ValidationError('Specification validation failed', sampleErrors)

    expect(error).toBeInstanceOf(PipelineError)
    expect(error.name).toBe('ValidationError')
    expect(error.stage).toBe('validation')
    expect(error.retryable).toBe(false)
    expect(error.message).toBe('Specification validation failed')
    expect(error.errors).toEqual(sampleErrors)
  })

  it('should not be retryable', () => {
    const error = new ValidationError('Test error', [])
    expect(error.retryable).toBe(false)
  })

  it('should have a default user message about validation errors', () => {
    const error = new ValidationError('Test error', sampleErrors)

    expect(error.userMessage).toBe('Generated specification has validation errors')
  })

  describe('getCriticalErrors', () => {
    it('should return only critical severity errors', () => {
      const error = new ValidationError('Test error', sampleErrors)
      const critical = error.getCriticalErrors()

      expect(critical).toHaveLength(2)
      expect(critical.every(e => e.severity === 'critical')).toBe(true)
      expect(critical[0].fieldPath).toBe('$.dataEntities[0].name')
      expect(critical[1].fieldPath).toBe('$.coreFlows[2].steps')
    })

    it('should return empty array when no critical errors exist', () => {
      const warningsOnly: ValidationErrorDetail[] = [
        { fieldPath: '$.test', message: 'Warning', severity: 'warning' },
      ]
      const error = new ValidationError('Test error', warningsOnly)

      expect(error.getCriticalErrors()).toEqual([])
    })
  })

  describe('getWarnings', () => {
    it('should return only warning severity errors', () => {
      const error = new ValidationError('Test error', sampleErrors)
      const warnings = error.getWarnings()

      expect(warnings).toHaveLength(1)
      expect(warnings.every(e => e.severity === 'warning')).toBe(true)
      expect(warnings[0].fieldPath).toBe('$.userRoles[1]')
    })

    it('should return empty array when no warnings exist', () => {
      const criticalOnly: ValidationErrorDetail[] = [
        { fieldPath: '$.test', message: 'Critical', severity: 'critical' },
      ]
      const error = new ValidationError('Test error', criticalOnly)

      expect(error.getWarnings()).toEqual([])
    })
  })

  describe('formatErrorSummary', () => {
    it('should format summary with both critical and warnings', () => {
      const error = new ValidationError('Test error', sampleErrors)
      const summary = error.formatErrorSummary()

      expect(summary).toBe('Validation failed: 2 critical issues, 1 warning')
    })

    it('should format summary with only critical errors', () => {
      const criticalOnly: ValidationErrorDetail[] = [
        { fieldPath: '$.test1', message: 'Error 1', severity: 'critical' },
        { fieldPath: '$.test2', message: 'Error 2', severity: 'critical' },
      ]
      const error = new ValidationError('Test error', criticalOnly)

      expect(error.formatErrorSummary()).toBe('Validation failed: 2 critical issues')
    })

    it('should format summary with only warnings', () => {
      const warningsOnly: ValidationErrorDetail[] = [
        { fieldPath: '$.test1', message: 'Warning 1', severity: 'warning' },
      ]
      const error = new ValidationError('Test error', warningsOnly)

      expect(error.formatErrorSummary()).toBe('Validation failed: 1 warning')
    })

    it('should use singular form for single error', () => {
      const singleCritical: ValidationErrorDetail[] = [
        { fieldPath: '$.test', message: 'Error', severity: 'critical' },
      ]
      const error = new ValidationError('Test error', singleCritical)

      expect(error.formatErrorSummary()).toBe('Validation failed: 1 critical issue')
    })

    it('should handle empty error array', () => {
      const error = new ValidationError('Test error', [])

      expect(error.formatErrorSummary()).toBe('Validation failed')
    })
  })

  it('should store validation error details with all fields', () => {
    const detailedError: ValidationErrorDetail = {
      fieldPath: '$.dataEntities[5].fields[2]',
      message: 'Field type is invalid',
      severity: 'critical',
      currentValue: 'unknown_type',
      suggestedValue: 'string',
    }
    const error = new ValidationError('Test error', [detailedError])

    expect(error.errors[0]).toEqual(detailedError)
    expect(error.errors[0].currentValue).toBe('unknown_type')
    expect(error.errors[0].suggestedValue).toBe('string')
  })
})

describe('CreditInsufficientError', () => {
  it('should extend PipelineError with credit_check stage', () => {
    const error = new CreditInsufficientError(
      'Insufficient credits: required 100, available 50',
      'Please add 50 more credits to continue.'
    )

    expect(error).toBeInstanceOf(PipelineError)
    expect(error.name).toBe('CreditInsufficientError')
    expect(error.stage).toBe('credit_check')
    expect(error.retryable).toBe(false)
  })

  it('should not be retryable', () => {
    const error = new CreditInsufficientError(
      'Insufficient credits: required 100, available 50',
      'Please add 50 more credits to continue.'
    )
    expect(error.retryable).toBe(false)
  })

  it('should generate technical message with credit amounts', () => {
    const error = new CreditInsufficientError(
      'Insufficient credits: required 100, available 50',
      'Please add 50 more credits to continue.'
    )

    expect(error.message).toBe('Insufficient credits: required 100, available 50')
  })

  it('should generate user message indicating shortfall', () => {
    const error = new CreditInsufficientError(
      'Insufficient credits: required 100, available 50',
      'Please add 50 more credits to continue.'
    )

    expect(error.userMessage).toBe('Please add 50 more credits to continue.')
  })

  it('should handle exact credit match (edge case)', () => {
    const error = new CreditInsufficientError(
      'Insufficient credits: required 100, available 100',
      'Your credits exactly match the requirement.'
    )

    expect(error.userMessage).toBe('Your credits exactly match the requirement.')
  })

  it('should handle negative available credits (edge case)', () => {
    const error = new CreditInsufficientError(
      'Insufficient credits: required 100, available -10',
      'Please add 110 more credits to continue.'
    )

    expect(error.message).toContain('required 100')
    expect(error.message).toContain('available -10')
    expect(error.userMessage).toBe('Please add 110 more credits to continue.')
  })
})

describe('Error inheritance chain', () => {
  it('should allow catching all pipeline errors with PipelineError', () => {
    const errors = [
      new UnderstandingError('test', 'user msg'),
      new ResearchError('test'),
      new PlanningError('test'),
      new ValidationError('test', '', []),
      new CreditInsufficientError('Insufficient credits', 'Please add more credits'),
    ]

    errors.forEach(error => {
      expect(error).toBeInstanceOf(PipelineError)
      expect(error).toBeInstanceOf(Error)
    })
  })

  it('should allow specific error type catching', () => {
    const error = new ValidationError('test', '', [
      { fieldPath: '$.test', message: 'Test error', severity: 'critical' },
    ])

    if (error instanceof ValidationError) {
      expect(error.errors).toHaveLength(1)
      expect(error.getCriticalErrors()).toHaveLength(1)
    } else {
      throw new Error('Should be ValidationError')
    }
  })

  it('should preserve error names for debugging', () => {
    const errors = [
      { instance: new UnderstandingError('test', 'msg'), name: 'UnderstandingError' },
      { instance: new ResearchError('test'), name: 'ResearchError' },
      { instance: new PlanningError('test'), name: 'PlanningError' },
      { instance: new ValidationError('test', '', []), name: 'ValidationError' },
      { instance: new CreditInsufficientError('Insufficient credits', 'Add more credits'), name: 'CreditInsufficientError' },
    ]

    errors.forEach(({ instance, name }) => {
      expect(instance.name).toBe(name)
    })
  })
})

describe('Retry behavior classification', () => {
  it('should classify retryable errors correctly', () => {
    const retryable = [
      new UnderstandingError('test', 'msg'),
      new ResearchError('test'),
      new PlanningError('test'),
    ]

    retryable.forEach(error => {
      expect(error.retryable).toBe(true)
    })
  })

  it('should classify non-retryable errors correctly', () => {
    const nonRetryable = [
      new ValidationError('test', '', []),
      new CreditInsufficientError('Insufficient credits', 'Add more credits'),
    ]

    nonRetryable.forEach(error => {
      expect(error.retryable).toBe(false)
    })
  })
})

describe('User message generation', () => {
  it('should provide user-friendly messages for all error types', () => {
    const errors = [
      new UnderstandingError('tech', 'Please provide more details'),
      new ResearchError('tech'),
      new PlanningError('tech'),
      new ValidationError('tech', '', []),
      new CreditInsufficientError('Insufficient credits', 'Please add more credits'),
    ]

    errors.forEach(error => {
      expect(error.userMessage).toBeTruthy()
      expect(error.userMessage.length).toBeGreaterThan(0)
      // User messages should not contain technical jargon
      expect(error.userMessage).not.toContain('undefined')
      expect(error.userMessage).not.toContain('null')
    })
  })
})
