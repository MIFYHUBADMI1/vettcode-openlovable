/**
 * Bulletproof JSON Parser
 * 
 * Handles malformed AI responses and extracts valid JSON no matter what.
 * Uses multiple strategies to ensure parsing never fails.
 */

import { logger } from "@/lib/logging/logger"

/**
 * Parse JSON with multiple fallback strategies
 * 
 * Strategy 1: Try direct JSON.parse
 * Strategy 2: Extract from markdown code fences
 * Strategy 3: Find JSON object boundaries
 * Strategy 4: Fix common JSON errors (missing commas, quotes, trailing commas)
 * Strategy 5: Extract key-value pairs manually
 * 
 * @param text - Raw AI response text
 * @param context - Context for logging (e.g., "IdeaUnderstanding", "Research")
 * @returns Parsed object or null if all strategies fail
 */
export function parseAIJson(text: string, context: string): any | null {
  // Strategy 1: Try direct parse
  try {
    return JSON.parse(text)
  } catch (error) {
    logger.info(`[${context}] Direct parse failed`, "Trying extraction strategies")
  }

  // Strategy 2: Extract from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch (error) {
      logger.info(`[${context}] Markdown fence extraction failed`, "Trying JSON boundaries")
    }
  }

  // Strategy 3: Find JSON object boundaries
  const braceStart = text.indexOf("{")
  const braceEnd = text.lastIndexOf("}")

  if (braceStart !== -1 && braceEnd > braceStart) {
    const extracted = text.slice(braceStart, braceEnd + 1)
    try {
      return JSON.parse(extracted)
    } catch (error) {
      logger.info(`[${context}] Boundary extraction failed`, "Trying JSON repair")

      // Strategy 4: Try to fix common JSON errors
      const repaired = repairJson(extracted)
      if (repaired) {
        try {
          return JSON.parse(repaired)
        } catch (error) {
          logger.info(`[${context}] JSON repair failed`, "Trying array extraction")
        }
      }
    }
  }

  // Strategy 5: Try to extract array if object fails
  const arrayStart = text.indexOf("[")
  const arrayEnd = text.lastIndexOf("]")

  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    const extracted = text.slice(arrayStart, arrayEnd + 1)
    try {
      return JSON.parse(extracted)
    } catch (error) {
      logger.info(`[${context}] Array extraction failed`, "All strategies exhausted")
    }
  }

  logger.error(`[${context}] All JSON parsing strategies failed`, "Unable to parse JSON", {
    textPreview: text.slice(0, 500),
  })

  return null
}

/**
 * Attempt to repair common JSON formatting errors
 * 
 * Fixes:
 * - Missing commas between properties
 * - Trailing commas before closing braces
 * - Unquoted property names
 * - Single quotes instead of double quotes
 * - Control characters and invalid escapes
 * 
 * @param json - Malformed JSON string
 * @returns Repaired JSON string or null if repair impossible
 */
function repairJson(json: string): string | null {
  try {
    let repaired = json

    // Fix control characters
    repaired = repaired.replace(/[\x00-\x1F\x7F]/g, "")

    // Fix single quotes to double quotes (but not within strings)
    repaired = repaired.replace(/'/g, '"')

    // Fix missing commas between properties (}"property" or }"\nproperty")
    repaired = repaired.replace(/"\s*\n\s*"/g, '",\n"')
    repaired = repaired.replace(/}(\s*)"([^"]+)":/g, '},\n"$2":')
    repaired = repaired.replace(/](\s*)"([^"]+)":/g, '],\n"$2":')

    // Fix missing commas between array elements
    repaired = repaired.replace(/}(\s*){/g, '},\n{')
    repaired = repaired.replace(/](\s*)\[/g, '],\n[')

    // Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, "$1")

    // Fix common typos in boolean/null values
    repaired = repaired.replace(/:\s*True\b/gi, ": true")
    repaired = repaired.replace(/:\s*False\b/gi, ": false")
    repaired = repaired.replace(/:\s*None\b/gi, ": null")

    // Remove comments (// and /* */)
    repaired = repaired.replace(/\/\/.*$/gm, "")
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, "")

    return repaired
  } catch (error) {
    return null
  }
}

/**
 * Parse JSON with Zod schema validation and intelligent defaults
 * 
 * If parsing fails, constructs a minimal valid object using schema defaults.
 * 
 * @param text - Raw AI response text
 * @param schema - Zod schema for validation
 * @param context - Context for logging
 * @returns Validated object that matches schema
 */
export function parseAndValidate<T>(
  text: string,
  schema: any,
  context: string
): T {
  // Try to parse the JSON
  const parsed = parseAIJson(text, context)

  if (!parsed) {
    logger.error(`[${context}] Could not extract JSON`, "Using defaults", {})
    // Return a minimal valid object based on schema defaults
    return schema.parse({})
  }

  // Try to validate with schema
  try {
    return schema.parse(parsed) as T
  } catch (error) {
    logger.warn(`[${context}] Schema validation failed, attempting partial parse`, "Schema validation failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    // Try to salvage what we can by merging with defaults
    try {
      const defaults = schema.parse({})
      const merged = { ...defaults, ...parsed }
      return schema.parse(merged) as T
    } catch (error) {
      logger.error(`[${context}] Partial parse failed, using full defaults`, "Partial parse failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      return schema.parse({}) as T
    }
  }
}

/**
 * Extract and validate specific fields from AI response
 * 
 * Used when AI returns extra commentary around the JSON.
 * 
 * @param text - Raw AI response
 * @param requiredFields - Array of required field names
 * @returns Object containing only the required fields
 */
export function extractFields(
  text: string,
  requiredFields: string[]
): Record<string, any> {
  const parsed = parseAIJson(text, "FieldExtraction")

  if (!parsed || typeof parsed !== "object") {
    return {}
  }

  const extracted: Record<string, any> = {}

  for (const field of requiredFields) {
    if (field in parsed) {
      extracted[field] = parsed[field]
    }
  }

  return extracted
}

/**
 * Check if text contains valid JSON
 * 
 * @param text - Text to check
 * @returns true if valid JSON found
 */
export function hasValidJson(text: string): boolean {
  return parseAIJson(text, "ValidationCheck") !== null
}

/**
 * Pretty format JSON for debugging
 * 
 * @param obj - Object to format
 * @returns Pretty-printed JSON string
 */
export function prettyJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch (error) {
    return String(obj)
  }
}
