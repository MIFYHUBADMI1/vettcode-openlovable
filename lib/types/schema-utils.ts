import { z } from "zod"

/**
 * Schema Validation Utilities
 * ----------------------------
 * Utilities for parsing, validating, and handling round-trip serialization
 * of planning pipeline schemas (Requirement 22.1-22.8).
 */

export interface ParseResult<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    issues?: z.ZodIssue[]
  }
}

/**
 * Safely parse and validate data against a Zod schema with detailed error reporting.
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }
  
  return {
    success: false,
    error: {
      message: "Schema validation failed",
      issues: result.error.issues,
    },
  }
}

/**
 * Extract and parse JSON from AI responses that may include markdown code fences.
 * Handles both ```json...``` formatted responses and raw JSON.
 */
export function extractAndParseJSON<T>(
  schema: z.ZodType<T>,
  text: string
): ParseResult<T> {
  try {
    // Try to extract JSON from markdown code fences
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim()
    
    // Parse JSON
    const parsed = JSON.parse(jsonText)
    
    // Validate against schema
    return safeParse(schema, parsed)
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to parse JSON",
      },
    }
  }
}

/**
 * Test round-trip serialization: parse -> serialize -> parse should yield equivalent object.
 * Returns true if the round-trip preserves data integrity.
 */
export function testRoundTrip<T>(
  schema: z.ZodType<T>,
  data: T
): { success: boolean; error?: string } {
  try {
    // Step 1: Validate input
    const validated = schema.parse(data)
    
    // Step 2: Serialize to JSON
    const serialized = JSON.stringify(validated)
    
    // Step 3: Parse back
    const parsed = JSON.parse(serialized)
    
    // Step 4: Validate again
    const revalidated = schema.parse(parsed)
    
    // Step 5: Deep comparison
    const serialized2 = JSON.stringify(revalidated)
    
    if (serialized !== serialized2) {
      return {
        success: false,
        error: "Round-trip serialization produced different output",
      }
    }
    
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Round-trip test failed",
    }
  }
}

/**
 * Format Zod validation errors in a human-readable format.
 */
export function formatZodErrors(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root"
      return `  - ${path}: ${issue.message}`
    })
    .join("\n")
}
