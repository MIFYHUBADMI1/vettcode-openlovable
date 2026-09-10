import { IdeaUnderstandingSchema, type IdeaUnderstanding } from "@/lib/types/idea-understanding"
import { formatZodErrors } from "@/lib/types/schema-utils"

/**
 * Idea Understanding Parser
 * -------------------------
 * Extracts and validates IdeaUnderstanding JSON from AI-generated text responses.
 * Handles both markdown code-fenced JSON and raw JSON output (Requirements 22.6, 22.7).
 */

/**
 * Extract raw JSON text from an AI response.
 * Handles:
 *   - ```json ... ``` fenced blocks
 *   - ``` ... ``` fenced blocks (no language tag)
 *   - Raw JSON starting with `{`
 */
function extractJsonText(text: string): string {
  const trimmed = text.trim()

  // Try markdown code fence with optional language tag (```json or ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    return fenceMatch[1].trim()
  }

  // Fall back to the outermost {...} block for raw JSON responses
  const braceStart = trimmed.indexOf("{")
  const braceEnd = trimmed.lastIndexOf("}")
  if (braceStart !== -1 && braceEnd > braceStart) {
    return trimmed.slice(braceStart, braceEnd + 1)
  }

  // Return as-is and let JSON.parse surface the error
  return trimmed
}

/**
 * Parse an AI-generated text response into a validated IdeaUnderstanding object.
 *
 * Steps:
 *  1. Strip markdown code fences if present.
 *  2. Parse the extracted text as JSON.
 *  3. Validate the parsed object against IdeaUnderstandingSchema.
 *
 * Throws a descriptive Error on any failure so callers can surface the
 * problem without inspecting raw AI output themselves.
 *
 * @param text - Raw text from the AI model (may include markdown fences).
 * @returns Validated IdeaUnderstanding object.
 * @throws Error with detailed message on JSON parse failure or schema violation.
 */
export function parseIdeaUnderstandingResponse(text: string): IdeaUnderstanding {
  // Step 1: Extract JSON text
  const jsonText = extractJsonText(text)

  // Step 2: Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (cause) {
    throw new Error(
      `Failed to parse AI response as JSON: ${cause instanceof Error ? cause.message : String(cause)}`
    )
  }

  // Step 3: Validate against schema
  const result = IdeaUnderstandingSchema.safeParse(parsed)
  if (!result.success) {
    const fieldDetails = formatZodErrors(result.error.issues)
    throw new Error(
      `IdeaUnderstanding schema validation failed:\n${fieldDetails}`
    )
  }

  return result.data
}
