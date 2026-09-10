/**
 * IdeaUnderstanding Schema Tests
 * Tests Requirements 15.1-15.8, 22.1, 22.8
 */

import { describe, it, expect } from 'vitest'
import {
  IdeaUnderstandingSchema,
  IdeaDataEntitySchema,
  IdeaUserFlowSchema,
  IdeaCoreFeatureSchema,
  IdeaTechnicalRequirementSchema,
  IdeaAuthenticationNeedsSchema,
  IdeaSuggestedFeatureSchema,
  ConfidenceLevelSchema,
  type IdeaUnderstanding,
} from './idea-understanding'
import { testRoundTrip } from './schema-utils'

describe('IdeaUnderstanding Schema', () => {
  describe('ConfidenceLevelSchema', () => {
    it('should accept "explicit" confidence level', () => {
      expect(ConfidenceLevelSchema.parse('explicit')).toBe('explicit')
    })

    it('should accept "inferred" confidence level', () => {
      expect(ConfidenceLevelSchema.parse('inferred')).toBe('inferred')
    })

    it('should reject invalid confidence levels', () => {
      expect(() => ConfidenceLevelSchema.parse('suggested')).toThrow()
      expect(() => ConfidenceLevelSchema.parse('unknown')).toThrow()
    })
  })

  describe('IdeaDataEntitySchema', () => {
    it('should validate valid data entity with confidence', () => {
      const entity = {
        name: 'User',
        description: 'Application user',
        fields: ['email', 'name'],
        confidence: 'explicit' as const,
      }
      expect(() => IdeaDataEntitySchema.parse(entity)).not.toThrow()
    })

    it('should default fields to empty array', () => {
      const entity = {
        name: 'User',
        confidence: 'inferred' as const,
      }
      const parsed = IdeaDataEntitySchema.parse(entity)
      expect(parsed.fields).toEqual([])
    })

    it('should require confidence field', () => {
      const entity = {
        name: 'User',
        fields: ['email'],
      }
      expect(() => IdeaDataEntitySchema.parse(entity)).toThrow()
    })
  })

  describe('IdeaUserFlowSchema', () => {
    it('should validate complete user flow', () => {
      const flow = {
        name: 'User Registration',
        description: 'New user signup flow',
        steps: ['Visit signup', 'Enter email', 'Confirm email'],
        confidence: 'explicit' as const,
      }
      expect(() => IdeaUserFlowSchema.parse(flow)).not.toThrow()
    })

    it('should require steps array', () => {
      const flow = {
        name: 'User Registration',
        confidence: 'inferred' as const,
      }
      expect(() => IdeaUserFlowSchema.parse(flow)).toThrow()
    })
  })

  describe('IdeaCoreFeatureSchema', () => {
    it('should validate feature with confidence', () => {
      const feature = {
        name: 'Authentication',
        description: 'User login and signup',
        confidence: 'explicit' as const,
      }
      expect(() => IdeaCoreFeatureSchema.parse(feature)).not.toThrow()
    })

    it('should allow optional description', () => {
      const feature = {
        name: 'Dashboard',
        confidence: 'inferred' as const,
      }
      const parsed = IdeaCoreFeatureSchema.parse(feature)
      expect(parsed.description).toBeUndefined()
    })
  })

  describe('IdeaTechnicalRequirementSchema', () => {
    it('should validate categorized requirement', () => {
      const requirement = {
        category: 'authentication',
        requirement: 'OAuth 2.0 integration',
        confidence: 'explicit' as const,
      }
      expect(() => IdeaTechnicalRequirementSchema.parse(requirement)).not.toThrow()
    })

    it('should accept various categories', () => {
      const categories = ['authentication', 'data storage', 'integrations', 'api']
      categories.forEach(category => {
        const requirement = {
          category,
          requirement: 'Some requirement',
          confidence: 'inferred' as const,
        }
        expect(() => IdeaTechnicalRequirementSchema.parse(requirement)).not.toThrow()
      })
    })
  })

  describe('IdeaAuthenticationNeedsSchema', () => {
    it('should validate authentication needs', () => {
      const needs = {
        required: true,
        description: 'Users must log in',
        suggestedProviders: ['email', 'google'],
      }
      expect(() => IdeaAuthenticationNeedsSchema.parse(needs)).not.toThrow()
    })

    it('should default suggestedProviders to empty array', () => {
      const needs = {
        required: false,
      }
      const parsed = IdeaAuthenticationNeedsSchema.parse(needs)
      expect(parsed.suggestedProviders).toEqual([])
    })
  })

  describe('IdeaSuggestedFeatureSchema', () => {
    it('should validate suggested feature with reason', () => {
      const feature = {
        key: 'payments',
        reason: 'E-commerce site requires payment processing',
      }
      expect(() => IdeaSuggestedFeatureSchema.parse(feature)).not.toThrow()
    })

    it('should require both key and reason', () => {
      expect(() => IdeaSuggestedFeatureSchema.parse({ key: 'payments' })).toThrow()
      expect(() => IdeaSuggestedFeatureSchema.parse({ reason: 'Some reason' })).toThrow()
    })
  })

  describe('IdeaUnderstandingSchema - Complete Object', () => {
    const validUnderstanding: IdeaUnderstanding = {
      purpose: 'Task management application',
      description: 'A web app for managing personal and team tasks',
      targetUsers: ['individuals', 'small teams'],
      userRoles: ['user', 'admin'],
      coreFeatures: [
        { name: 'Task creation', confidence: 'explicit' },
        { name: 'Task assignment', confidence: 'inferred' },
      ],
      dataEntities: [
        {
          name: 'Task',
          fields: ['title', 'description', 'status'],
          confidence: 'explicit',
        },
      ],
      userFlows: [
        {
          name: 'Create Task',
          steps: ['Click new task', 'Fill form', 'Submit'],
          confidence: 'explicit',
        },
      ],
      technicalRequirements: [
        {
          category: 'authentication',
          requirement: 'User login required',
          confidence: 'explicit',
        },
      ],
      authenticationNeeds: {
        required: true,
        suggestedProviders: ['email'],
      },
      suggestedFeatures: [
        {
          key: 'notifications',
          reason: 'Users need task reminders',
        },
      ],
      createdAt: Date.now(),
      modelUsed: 'anthropic/claude-3.5-sonnet',
    }

    it('should validate complete IdeaUnderstanding object', () => {
      expect(() => IdeaUnderstandingSchema.parse(validUnderstanding)).not.toThrow()
    })

    it('should require purpose and description', () => {
      const incomplete = { ...validUnderstanding }
      delete (incomplete as any).purpose
      expect(() => IdeaUnderstandingSchema.parse(incomplete)).toThrow()
    })

    it('should require createdAt and modelUsed metadata', () => {
      const noMetadata = { ...validUnderstanding }
      delete (noMetadata as any).createdAt
      expect(() => IdeaUnderstandingSchema.parse(noMetadata)).toThrow()
    })

    it('should default arrays to empty', () => {
      const minimal: IdeaUnderstanding = {
        purpose: 'Test app',
        description: 'A test application',
        targetUsers: [],
        userRoles: [],
        coreFeatures: [],
        dataEntities: [],
        userFlows: [],
        technicalRequirements: [],
        suggestedFeatures: [],
        createdAt: Date.now(),
        modelUsed: 'test/model',
      }
      const parsed = IdeaUnderstandingSchema.parse(minimal)
      expect(parsed.targetUsers).toEqual([])
      expect(parsed.userRoles).toEqual([])
      expect(parsed.coreFeatures).toEqual([])
      expect(parsed.dataEntities).toEqual([])
      expect(parsed.userFlows).toEqual([])
      expect(parsed.technicalRequirements).toEqual([])
      expect(parsed.suggestedFeatures).toEqual([])
    })

    it('should support optional authenticationNeeds', () => {
      const withoutAuth = { ...validUnderstanding }
      delete (withoutAuth as any).authenticationNeeds
      const parsed = IdeaUnderstandingSchema.parse(withoutAuth)
      expect(parsed.authenticationNeeds).toBeUndefined()
    })
  })

  describe('Round-Trip Serialization (Requirement 22.1, 22.8)', () => {
    it('should preserve all data through JSON round-trip', () => {
      const understanding: IdeaUnderstanding = {
        purpose: 'E-commerce platform',
        description: 'Online store for handmade crafts',
        targetUsers: ['buyers', 'sellers'],
        userRoles: ['customer', 'vendor', 'admin'],
        coreFeatures: [
          {
            name: 'Product catalog',
            description: 'Browse and search products',
            confidence: 'explicit',
          },
          {
            name: 'Shopping cart',
            confidence: 'inferred',
          },
        ],
        dataEntities: [
          {
            name: 'Product',
            description: 'Items for sale',
            fields: ['name', 'price', 'description', 'images'],
            confidence: 'explicit',
          },
          {
            name: 'Order',
            fields: ['products', 'total', 'status'],
            confidence: 'inferred',
          },
        ],
        userFlows: [
          {
            name: 'Purchase Flow',
            description: 'Complete a purchase',
            steps: ['Browse products', 'Add to cart', 'Checkout', 'Payment'],
            confidence: 'explicit',
          },
        ],
        technicalRequirements: [
          {
            category: 'payments',
            requirement: 'Stripe integration for checkout',
            confidence: 'explicit',
          },
        ],
        authenticationNeeds: {
          required: true,
          description: 'Users must create accounts',
          suggestedProviders: ['email', 'google', 'facebook'],
        },
        suggestedFeatures: [
          { key: 'reviews', reason: 'Product reviews build trust' },
          { key: 'wishlist', reason: 'Users want to save items' },
        ],
        createdAt: 1704067200000,
        modelUsed: 'anthropic/claude-3.5-sonnet',
      }

      const result = testRoundTrip(IdeaUnderstandingSchema, understanding)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should preserve minimal object through round-trip', () => {
      const minimal: IdeaUnderstanding = {
        purpose: 'Minimal app',
        description: 'A minimal test',
        targetUsers: [],
        userRoles: [],
        coreFeatures: [],
        dataEntities: [],
        userFlows: [],
        technicalRequirements: [],
        suggestedFeatures: [],
        createdAt: Date.now(),
        modelUsed: 'test/model',
      }

      const result = testRoundTrip(IdeaUnderstandingSchema, minimal)
      expect(result.success).toBe(true)
    })
  })

  describe('Schema Validation Error Messages', () => {
    it('should provide clear error for missing required fields', () => {
      const invalid = {
        description: 'Missing purpose',
        createdAt: Date.now(),
      }

      try {
        IdeaUnderstandingSchema.parse(invalid)
        expect.fail('Should have thrown validation error')
      } catch (error: any) {
        expect(error.issues).toBeDefined()
        expect(error.issues.some((i: any) => i.path.includes('purpose'))).toBe(true)
      }
    })

    it('should validate confidence levels in nested objects', () => {
      const invalid = {
        purpose: 'Test',
        description: 'Test',
        coreFeatures: [
          { name: 'Feature', confidence: 'invalid' },
        ],
        createdAt: Date.now(),
        modelUsed: 'test',
      }

      expect(() => IdeaUnderstandingSchema.parse(invalid)).toThrow()
    })
  })
})
