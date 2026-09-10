/**
 * Schema Utilities Tests
 * Tests Requirements 22.6, 22.7, 22.8
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  safeParse,
  extractAndParseJSON,
  testRoundTrip,
  formatZodErrors,
} from './schema-utils'

describe('Schema Utilities', () => {
  // Simple test schema
  const TestSchema = z.object({
    name: z.string(),
    age: z.number().min(0),
    email: z.string().email().optional(),
  })

  describe('safeParse', () => {
    it('should return success result for valid data', () => {
      const data = { name: 'Alice', age: 30 }
      const result = safeParse(TestSchema, data)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
      expect(result.error).toBeUndefined()
    })

    it('should return error result for invalid data', () => {
      const data = { name: 'Bob', age: -5 }
      const result = safeParse(TestSchema, data)

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Schema validation failed')
      expect(result.error?.issues).toBeDefined()
    })

    it('should include detailed validation issues', () => {
      const data = { age: 25 } // missing required 'name'
      const result = safeParse(TestSchema, data)

      expect(result.success).toBe(false)
      expect(result.error?.issues).toBeDefined()
      expect(result.error?.issues?.length).toBeGreaterThan(0)
      expect(result.error?.issues?.some(i => i.path.includes('name'))).toBe(true)
    })

    it('should validate nested objects', () => {
      const NestedSchema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            bio: z.string(),
          }),
        }),
      })

      const valid = {
        user: {
          name: 'Alice',
          profile: { bio: 'Software engineer' },
        },
      }

      const result = safeParse(NestedSchema, valid)
      expect(result.success).toBe(true)
    })
  })

  describe('extractAndParseJSON', () => {
    it('should extract JSON from markdown code fences with json tag', () => {
      const markdown = '```json\n{"name": "Alice", "age": 30}\n```'
      const result = extractAndParseJSON(TestSchema, markdown)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'Alice', age: 30 })
    })

    it('should extract JSON from markdown code fences without json tag', () => {
      const markdown = '```\n{"name": "Bob", "age": 25}\n```'
      const result = extractAndParseJSON(TestSchema, markdown)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'Bob', age: 25 })
    })

    it('should parse raw JSON without code fences', () => {
      const json = '{"name": "Charlie", "age": 35}'
      const result = extractAndParseJSON(TestSchema, json)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'Charlie', age: 35 })
    })

    it('should handle JSON with extra whitespace', () => {
      const markdown = '```json\n  \n  {"name": "David", "age": 40}  \n  \n```'
      const result = extractAndParseJSON(TestSchema, markdown)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'David', age: 40 })
    })

    it('should return error for invalid JSON syntax', () => {
      const invalid = '```json\n{name: "Eve", age: 28}\n```' // Missing quotes around 'name'
      const result = extractAndParseJSON(TestSchema, invalid)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('JSON')
    })

    it('should return error for valid JSON that fails schema validation', () => {
      const invalidData = '```json\n{"name": "Frank", "age": -10}\n```'
      const result = extractAndParseJSON(TestSchema, invalidData)

      expect(result.success).toBe(false)
      expect(result.error?.issues).toBeDefined()
    })

    it('should handle multi-line JSON', () => {
      const multiline = `\`\`\`json
{
  "name": "Grace",
  "age": 32,
  "email": "grace@example.com"
}
\`\`\``
      const result = extractAndParseJSON(TestSchema, multiline)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'Grace',
        age: 32,
        email: 'grace@example.com',
      })
    })

    it('should handle JSON embedded in text', () => {
      const text = `Here is the result:

\`\`\`json
{"name": "Henry", "age": 45}
\`\`\`

That's all!`
      const result = extractAndParseJSON(TestSchema, text)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'Henry', age: 45 })
    })
  })

  describe('testRoundTrip', () => {
    it('should pass for data that survives round-trip', () => {
      const data = { name: 'Alice', age: 30, email: 'alice@example.com' }
      const result = testRoundTrip(TestSchema, data)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should pass for minimal valid data', () => {
      const data = { name: 'Bob', age: 25 }
      const result = testRoundTrip(TestSchema, data)

      expect(result.success).toBe(true)
    })

    it('should fail for data that violates schema', () => {
      const invalid = { name: 'Charlie', age: -5 }
      const result = testRoundTrip(TestSchema, invalid)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should preserve complex nested structures', () => {
      const ComplexSchema = z.object({
        id: z.string(),
        data: z.object({
          items: z.array(z.object({
            name: z.string(),
            value: z.number(),
          })),
          metadata: z.record(z.string(), z.string()),
        }),
      })

      const complex = {
        id: 'test-123',
        data: {
          items: [
            { name: 'item1', value: 100 },
            { name: 'item2', value: 200 },
          ],
          metadata: {
            created: '2024-01-01',
            author: 'Alice',
          },
        },
      }

      const result = testRoundTrip(ComplexSchema, complex)
      expect(result.success).toBe(true)
    })

    it('should preserve arrays', () => {
      const ArraySchema = z.object({
        tags: z.array(z.string()),
        scores: z.array(z.number()),
      })

      const data = {
        tags: ['tag1', 'tag2', 'tag3'],
        scores: [10, 20, 30],
      }

      const result = testRoundTrip(ArraySchema, data)
      expect(result.success).toBe(true)
    })

    it('should preserve optional fields', () => {
      const OptionalSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      })

      const withOptional = { required: 'test', optional: 'value' }
      const withoutOptional = { required: 'test' }

      expect(testRoundTrip(OptionalSchema, withOptional).success).toBe(true)
      expect(testRoundTrip(OptionalSchema, withoutOptional).success).toBe(true)
    })

    it('should preserve default values', () => {
      const DefaultSchema = z.object({
        name: z.string(),
        tags: z.array(z.string()).default([]),
      })

      const data = { name: 'test' }

      // Validate and fill defaults
      const validated = DefaultSchema.parse(data)
      const result = testRoundTrip(DefaultSchema, validated)

      expect(result.success).toBe(true)
    })

    it('should handle dates and timestamps', () => {
      const TimestampSchema = z.object({
        createdAt: z.number(),
        updatedAt: z.number().optional(),
      })

      const data = {
        createdAt: Date.now(),
        updatedAt: Date.now() + 1000,
      }

      const result = testRoundTrip(TimestampSchema, data)
      expect(result.success).toBe(true)
    })
  })

  describe('formatZodErrors', () => {
    it('should format validation errors in readable format', () => {
      const data = { age: -5 } // missing 'name' and invalid 'age'
      const result = TestSchema.safeParse(data)

      if (!result.success) {
        const formatted = formatZodErrors(result.error.issues)

        expect(formatted).toContain('name')
        expect(formatted).toContain('age')
        expect(formatted.split('\n').length).toBeGreaterThan(1)
      }
    })

    it('should handle nested path errors', () => {
      const NestedSchema = z.object({
        user: z.object({
          profile: z.object({
            age: z.number().min(0),
          }),
        }),
      })

      const data = { user: { profile: { age: -10 } } }
      const result = NestedSchema.safeParse(data)

      if (!result.success) {
        const formatted = formatZodErrors(result.error.issues)
        expect(formatted).toContain('user.profile.age')
      }
    })

    it('should handle array index errors', () => {
      const ArraySchema = z.object({
        items: z.array(z.object({
          value: z.number().positive(),
        })),
      })

      const data = {
        items: [
          { value: 10 },
          { value: -5 }, // Invalid
          { value: 20 },
        ],
      }
      const result = ArraySchema.safeParse(data)

      if (!result.success) {
        const formatted = formatZodErrors(result.error.issues)
        expect(formatted).toContain('items')
      }
    })

    it('should handle root-level errors', () => {
      const StringSchema = z.string()
      const result = StringSchema.safeParse(123)

      if (!result.success) {
        const formatted = formatZodErrors(result.error.issues)
        expect(formatted).toContain('root')
      }
    })

    it('should format multiple errors', () => {
      const data = {
        name: 123, // wrong type
        age: -5, // out of range
        email: 'not-an-email', // invalid format
      }
      const result = TestSchema.safeParse(data)

      if (!result.success) {
        const formatted = formatZodErrors(result.error.issues)
        const lines = formatted.split('\n')
        expect(lines.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('should include error messages', () => {
      const data = { name: 'Alice', age: -10 }
      const result = TestSchema.safeParse(data)

      if (!result.success) {
        const formatted = formatZodErrors(result.error.issues)
        // Should include some description of the error
        expect(formatted.length).toBeGreaterThan(10)
      }
    })

    it('should handle empty issues array', () => {
      const formatted = formatZodErrors([])
      expect(formatted).toBe('')
    })
  })

  describe('Integration - AI Response Parsing', () => {
    it('should handle typical AI response with code fence', () => {
      const aiResponse = `Here is the parsed understanding:

\`\`\`json
{
  "name": "Test User",
  "age": 25,
  "email": "test@example.com"
}
\`\`\`

This represents the user data.`

      const result = extractAndParseJSON(TestSchema, aiResponse)
      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('Test User')
    })

    it('should handle AI response with extra explanation', () => {
      const aiResponse = `Based on the input, here's the structured data:

\`\`\`json
{"name": "Alice", "age": 30}
\`\`\`

Note: Email was not provided.`

      const result = extractAndParseJSON(TestSchema, aiResponse)
      expect(result.success).toBe(true)
      expect(result.data?.email).toBeUndefined()
    })

    it('should validate extracted data against schema', () => {
      const aiResponse = `\`\`\`json
{"name": "Bob", "age": "thirty"}
\`\`\``

      const result = extractAndParseJSON(TestSchema, aiResponse)
      expect(result.success).toBe(false)
      expect(result.error?.issues).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      const EmptySchema = z.object({})
      const result = testRoundTrip(EmptySchema, {})
      expect(result.success).toBe(true)
    })

    it('should handle null vs undefined in optional fields', () => {
      const NullableSchema = z.object({
        optional: z.string().optional(),
        nullable: z.string().nullable(),
      })

      const withUndefined = { optional: undefined, nullable: null }
      const validated = NullableSchema.parse(withUndefined)
      const result = testRoundTrip(NullableSchema, validated)
      expect(result.success).toBe(true)
    })

    it('should handle very large numbers', () => {
      const NumberSchema = z.object({
        value: z.number(),
      })

      const data = { value: Number.MAX_SAFE_INTEGER }
      const result = testRoundTrip(NumberSchema, data)
      expect(result.success).toBe(true)
    })

    it('should handle unicode characters', () => {
      const UnicodeSchema = z.object({
        text: z.string(),
      })

      const data = { text: '你好世界 🌍 café' }
      const result = testRoundTrip(UnicodeSchema, data)
      expect(result.success).toBe(true)
    })
  })
})
