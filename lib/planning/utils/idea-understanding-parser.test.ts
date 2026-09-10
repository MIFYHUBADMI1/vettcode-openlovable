import { describe, it, expect } from "vitest"
import { parseIdeaUnderstandingResponse } from "./idea-understanding-parser"
import type { IdeaUnderstanding } from "@/lib/types/idea-understanding"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid IdeaUnderstanding payload (all required fields present). */
function validPayload(): IdeaUnderstanding {
  return {
    purpose: "A task manager for remote teams",
    description: "Helps distributed teams track and assign tasks in real time.",
    targetUsers: ["remote workers", "team leads"],
    userRoles: ["admin", "member"],
    coreFeatures: [
      { name: "Task creation", confidence: "explicit" },
      { name: "Team dashboard", confidence: "inferred" },
    ],
    dataEntities: [
      { name: "Task", fields: ["title", "status", "assignee"], confidence: "explicit" },
    ],
    userFlows: [
      {
        name: "Create Task",
        steps: ["User opens dashboard", "User clicks New Task", "User fills form"],
        confidence: "explicit",
      },
    ],
    technicalRequirements: [
      { category: "authentication", requirement: "Email + password login", confidence: "inferred" },
    ],
    suggestedFeatures: [{ key: "notifications", reason: "Common in task managers" }],
    createdAt: 1700000000000,
    modelUsed: "anthropic/claude-3.5-sonnet",
  }
}

function toJson(obj: unknown): string {
  return JSON.stringify(obj)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseIdeaUnderstandingResponse", () => {
  describe("valid inputs", () => {
    it("parses valid JSON wrapped in ```json code fence", () => {
      const text = `\`\`\`json\n${toJson(validPayload())}\n\`\`\``
      const result = parseIdeaUnderstandingResponse(text)
      expect(result.purpose).toBe("A task manager for remote teams")
      expect(result.coreFeatures).toHaveLength(2)
    })

    it("parses valid JSON wrapped in plain ``` code fence (no language tag)", () => {
      const text = `\`\`\`\n${toJson(validPayload())}\n\`\`\``
      const result = parseIdeaUnderstandingResponse(text)
      expect(result.modelUsed).toBe("anthropic/claude-3.5-sonnet")
    })

    it("parses valid raw JSON with no code fence", () => {
      const text = toJson(validPayload())
      const result = parseIdeaUnderstandingResponse(text)
      expect(result.purpose).toBe("A task manager for remote teams")
    })

    it("parses valid raw JSON with surrounding whitespace", () => {
      const text = `   \n${toJson(validPayload())}\n   `
      const result = parseIdeaUnderstandingResponse(text)
      expect(result.description).toContain("distributed teams")
    })

    it("parses valid JSON even when AI adds text before the code fence", () => {
      const text = `Here is the analysis:\n\`\`\`json\n${toJson(validPayload())}\n\`\`\``
      const result = parseIdeaUnderstandingResponse(text)
      expect(result.userRoles).toEqual(["admin", "member"])
    })

    it("applies default empty arrays for omitted optional array fields", () => {
      const payload = validPayload()
      // Remove optional arrays – schema .default([]) should fill them in
      const { suggestedFeatures: _sf, ...rest } = payload
      const text = toJson(rest)
      const result = parseIdeaUnderstandingResponse(text)
      expect(result.suggestedFeatures).toEqual([])
    })
  })

  describe("invalid JSON", () => {
    it("throws when the response is completely invalid JSON", () => {
      expect(() => parseIdeaUnderstandingResponse("not json at all")).toThrow(
        /failed to parse ai response as json/i
      )
    })

    it("throws when the code fence contains malformed JSON", () => {
      const text = "```json\n{ purpose: 'missing quotes' }\n```"
      expect(() => parseIdeaUnderstandingResponse(text)).toThrow(
        /failed to parse ai response as json/i
      )
    })

    it("throws when the response is an empty string", () => {
      expect(() => parseIdeaUnderstandingResponse("")).toThrow()
    })
  })

  describe("schema validation errors", () => {
    it("throws with field path details when a required field is missing", () => {
      const payload = validPayload() as Partial<IdeaUnderstanding>
      delete payload.purpose
      expect(() => parseIdeaUnderstandingResponse(toJson(payload))).toThrow(
        /purpose/i
      )
    })

    it("throws with field path details when description is missing", () => {
      const payload = validPayload() as Partial<IdeaUnderstanding>
      delete payload.description
      expect(() => parseIdeaUnderstandingResponse(toJson(payload))).toThrow(
        /description/i
      )
    })

    it("throws with field path when confidence level is invalid", () => {
      const payload = validPayload()
      // Force an invalid confidence value
      ;(payload.coreFeatures[0] as unknown as Record<string, unknown>).confidence = "maybe"
      expect(() => parseIdeaUnderstandingResponse(toJson(payload))).toThrow(
        /schema validation failed/i
      )
    })

    it("throws when createdAt is not a number", () => {
      const payload = { ...validPayload(), createdAt: "not-a-number" }
      expect(() => parseIdeaUnderstandingResponse(toJson(payload))).toThrow(
        /schema validation failed/i
      )
    })

    it("error message includes field path for nested violations", () => {
      const payload = validPayload()
      ;(payload.coreFeatures[0] as unknown as Record<string, unknown>).confidence = "bad"
      let errorMessage = ""
      try {
        parseIdeaUnderstandingResponse(toJson(payload))
      } catch (err) {
        errorMessage = (err as Error).message
      }
      // The formatted error should mention the nested path
      expect(errorMessage).toMatch(/coreFeatures/)
    })
  })
})
