/**
 * RepairService - Repairs ApplicationSpecification based on CritiqueReport
 * 
 * Addresses issues identified by IndependentCritic by making targeted fixes:
 * - Adds missing data entities
 * - Fixes role inconsistencies
 * - Completes missing authentication requirements
 * - Sets new features as disabled by default
 * 
 * ONLY fixes issues explicitly flagged in critique - preserves all user content.
 * 
 * Requirements: 5.1-5.6, 17.1-17.8
 * Design: RepairService component section
 * 
 * @module lib/planning/stages/repair
 */

import "server-only"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { logger } from "@/lib/logging/logger"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { CritiqueReport } from "@/lib/types/critique-report"
import { ApplicationSpecificationSchema } from "@/lib/types/specification"
import { ModelRegistry } from "@/lib/planning/models/registry"
import { PlanningError } from "@/lib/planning/errors"
import { executeWithRetry } from "@/lib/planning/utils/retry"

/**
 * Maximum number of retry attempts for AI generation
 */
const MAX_RETRIES = 3

/**
 * OpenRouter client configuration
 */
const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

/**
 * System prompt for specification repair
 * 
 * Instructs the AI to make only necessary fixes while preserving user content.
 */
const SYSTEM_PROMPT = `You are an expert software architect specializing in specification repair and consistency enforcement.

Your task is to repair an ApplicationSpecification based on a CritiqueReport. You MUST:
1. Address ONLY issues explicitly flagged in the critique
2. Preserve ALL user-provided content
3. Make minimal, targeted changes
4. Set new features as disabled by default

**REPAIR OPERATIONS**

1. **Missing Data Entities** (missing_definition for entities)
   - Add the missing entity to dataEntities array
   - Infer reasonable fields based on how the entity is referenced
   - Example: If "User profile" is mentioned but User entity missing, add:
     {
       "name": "User",
       "description": "Application user",
       "fields": ["id", "name", "email", "createdAt"]
     }

2. **Role Inconsistencies** (role_mismatch)
   - If a role is mentioned but not in userRoles array, add it
   - Common roles: "user", "admin", "moderator", "guest"
   - DO NOT remove role references from text

3. **Authentication Inconsistency** (auth_inconsistency)
   - If auth feature is enabled but authenticationRequirements is empty/missing
   - Add basic authentication requirements
   - Example: "User authentication via email/password using Totalum SDK. Support login, registration, and password reset."

4. **Stack Violations** (stack_violation)
   - Replace unsupported technology references with Totalum SDK equivalents
   - PostgreSQL/MySQL/MongoDB → "Totalum SDK database"
   - Prisma/Mongoose/Sequelize → "Totalum SDK"
   - Express/Fastify/NestJS → "Next.js API routes"
   - Firebase/Supabase → "Totalum SDK"

5. **New Features Default State** (ALWAYS)
   - If adding new features to suggestedFeatures, set enabled: false
   - Only modify enabled state if explicitly required by critique
   - Requirement 5.5: New features disabled by default

**PRESERVATION RULES**

- DO NOT reword or rephrase existing descriptions unless fixing a stack violation
- DO NOT remove any existing content
- DO NOT change enabled state of existing features unless critique requires it
- DO NOT add features not mentioned in critique
- DO NOT reorganize or reformat the specification
- Make surgical fixes only

**OUTPUT FORMAT**

Return ONLY the complete, repaired JSON specification (no markdown, no explanation):

{
  "applicationType": "...",
  "title": "...",
  "description": "...",
  ... (complete specification with repairs applied)
}

**REPAIR AUDIT NOTES**

Log all changes made:
- What was added/modified
- Which critique issue triggered the change
- Before/after values for modifications

Include these in a "repairNotes" field (will be logged separately, not part of spec):

{
  specification: { ... },
  repairNotes: [
    {
      "issueType": "missing_definition",
      "action": "Added User entity",
      "details": "Added User entity with fields: id, name, email, createdAt to address missing entity reference"
    }
  ]
}

**IMPORTANT CONSTRAINTS**

- Address ONLY issues in the critique - do not make unrelated changes
- Preserve user intent and wording
- Minimal, targeted fixes only
- New features must have enabled: false
- Ensure output passes ApplicationSpecification schema validation`

/**
 * RepairService repairs ApplicationSpecifications based on critique issues
 */
export class RepairService {
  private modelRegistry: ModelRegistry

  constructor(modelRegistry?: ModelRegistry) {
    this.modelRegistry = modelRegistry || new ModelRegistry()
  }

  /**
   * Repair an ApplicationSpecification based on critique issues
   * 
   * Makes targeted fixes to address issues identified by IndependentCritic
   * while preserving all user-provided content.
   * 
   * @param specification - ApplicationSpecification to repair
   * @param critique - CritiqueReport with identified issues
   * @returns Repaired ApplicationSpecification
   * @throws PlanningError if repair fails
   * 
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   */
  async repair(
    specification: ApplicationSpecification,
    critique: CritiqueReport
  ): Promise<ApplicationSpecification> {
    // If no critical issues or warnings, return original spec unchanged
    if (critique.criticalIssues.length === 0 && critique.warnings.length === 0) {
      logger.info("[RepairService] No issues to repair, returning original specification", "No repair needed", {
        title: specification.title,
      })
      return specification
    }

    logger.info("[RepairService] Starting specification repair", "Repairing specification issues", {
      title: specification.title,
      criticalIssues: critique.criticalIssues.length,
      warnings: critique.warnings.length,
    })

    try {
      // Use executeWithRetry wrapper for automatic retry with exponential backoff
      const repairedSpec = await executeWithRetry(
        async () => this.callModelWithRetry(specification, critique, 0),
        {
          maxAttempts: MAX_RETRIES,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        }
      )

      logger.info("[RepairService] Specification repaired successfully", "Repair complete", {
        title: repairedSpec.title,
        dataEntities: repairedSpec.dataEntities.length,
        userRoles: repairedSpec.userRoles.length,
      })

      return repairedSpec
    } catch (error) {
      logger.error("[RepairService] Specification repair failed", "Repair error", {
        title: specification.title,
        error: error instanceof Error ? error.message : String(error),
      })

      // Wrap in PlanningError for consistent error handling
      if (error instanceof PlanningError) {
        throw error
      }

      throw new PlanningError(
        `Failed to repair specification: ${error instanceof Error ? error.message : String(error)}`,
        "Unable to repair specification. Please try again."
      )
    }
  }

  /**
   * Call the AI model to perform repair
   * 
   * @param specification - Specification to repair
   * @param critique - Critique with issues to address
   * @param attempt - Current attempt number (for fallback selection)
   * @returns Parsed and validated repaired ApplicationSpecification
   * @throws PlanningError if generation or parsing fails
   * 
   * Requirements: 5.1, 5.2, 5.3
   */
  private async callModelWithRetry(
    specification: ApplicationSpecification,
    critique: CritiqueReport,
    attempt: number
  ): Promise<ApplicationSpecification> {
    // Get model config from registry
    const modelConfig =
      attempt === 0
        ? this.modelRegistry.getModelForStage("repair")
        : this.modelRegistry.getFallbackModel("repair", attempt)

    if (!modelConfig) {
      throw new PlanningError(
        "No fallback models available",
        "Unable to repair specification after multiple attempts. Please try again later."
      )
    }

    const modelName = modelConfig.primary
    const model = openrouter.chatModel(modelName)

    logger.info("[RepairService] Calling AI model for repair", "Requesting specification repair", {
      attempt: attempt + 1,
      modelName,
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
    })

    try {
      // Build repair prompt with specification and critique
      const prompt = this.buildRepairPrompt(specification, critique)

      // Call AI model with generateText
      const { text, usage } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
      })

      logger.info("[RepairService] AI response received", "Model response received", {
        responseLength: text.length,
        tokensUsed: usage?.totalTokens || 0,
      })

      // Parse and validate the response
      const repairedSpec = this.parseAIResponse(text, specification, critique)

      return repairedSpec
    } catch (error) {
      logger.error("[RepairService] Model call failed", "AI model request failed", {
        attempt: attempt + 1,
        modelName,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new PlanningError(
        `Model call failed on attempt ${attempt + 1}: ${error instanceof Error ? error.message : String(error)}`,
        "Unable to repair specification. Please try again."
      )
    }
  }

  /**
   * Build repair prompt from specification and critique
   * 
   * @param specification - Original specification
   * @param critique - Critique with issues
   * @returns Formatted prompt for AI
   */
  private buildRepairPrompt(
    specification: ApplicationSpecification,
    critique: CritiqueReport
  ): string {
    const specJson = JSON.stringify(specification, null, 2)

    // Format issues for the prompt
    const criticalIssuesText = critique.criticalIssues
      .map(
        (issue, idx) =>
          `${idx + 1}. [${issue.issueType}] at ${issue.fieldPath}
   Description: ${issue.description}
   Recommendation: ${issue.recommendation}
   ${issue.currentValue ? `Current: ${issue.currentValue}` : ""}
   ${issue.suggestedValue ? `Suggested: ${issue.suggestedValue}` : ""}`
      )
      .join("\n\n")

    const warningsText = critique.warnings
      .map(
        (issue, idx) =>
          `${idx + 1}. [${issue.issueType}] at ${issue.fieldPath}
   Description: ${issue.description}
   Recommendation: ${issue.recommendation}`
      )
      .join("\n\n")

    return `<original_specification>
${specJson}
</original_specification>

<critique_issues>
<critical_issues count="${critique.criticalIssues.length}">
${criticalIssuesText || "None"}
</critical_issues>

<warnings count="${critique.warnings.length}">
${warningsText || "None"}
</warnings>

<overall_assessment>
${critique.overallAssessment}
Passes Validation: ${critique.passesValidation}
Quality Score: ${critique.qualityScore}
</overall_assessment>
</critique_issues>

<repair_instructions>
1. Address ALL critical issues
2. Address warnings if they impact functionality
3. Preserve ALL existing content unless fixing a stack violation
4. Set new features to enabled: false
5. Make minimal, surgical changes only
6. Ensure repaired spec passes ApplicationSpecification schema validation
</repair_instructions>

Return the complete repaired specification as JSON with a separate repairNotes array documenting all changes made.`
  }

  /**
   * Parse and validate AI response into repaired ApplicationSpecification
   * 
   * Requirements: 5.6 - Log all repair changes
   * 
   * @param text - Raw AI response text
   * @param originalSpec - Original specification (for comparison)
   * @param critique - Critique that triggered repair
   * @returns Validated repaired ApplicationSpecification
   * @throws PlanningError if parsing or validation fails
   */
  private parseAIResponse(
    text: string,
    originalSpec: ApplicationSpecification,
    critique: CritiqueReport
  ): ApplicationSpecification {
    try {
      // Extract JSON from response
      const jsonText = this.extractJson(text)

      // Parse JSON
      const parsedData = JSON.parse(jsonText)

      // Check if response includes repairNotes (log them separately)
      if (parsedData.repairNotes && Array.isArray(parsedData.repairNotes)) {
        logger.info("[RepairService] Repair changes made:", "Changes applied", {
          changes: parsedData.repairNotes,
        })
      }

      // Extract the specification (might be nested under 'specification' key)
      const specData = parsedData.specification || parsedData

      // Ensure default fields are populated
      const dataWithDefaults = {
        targetUsers: [],
        userRoles: [],
        coreFlows: [],
        suggestedFeatures: [],
        dataEntities: [],
        backendRequirements: [],
        integrations: [],
        additionalInstructions: "",
        ...specData,
      }

      // Validate against schema
      const repairedSpec = ApplicationSpecificationSchema.parse(dataWithDefaults)

      // Log summary of changes
      this.logRepairSummary(originalSpec, repairedSpec, critique)

      return repairedSpec
    } catch (error) {
      logger.error("[RepairService] Failed to parse AI response", "Response parsing failed", {
        error: error instanceof Error ? error.message : String(error),
        responsePreview: text.slice(0, 200),
      })

      if (error instanceof Error && "issues" in error) {
        // Zod validation error
        const issues = (error as any).issues
        throw new PlanningError(
          `Schema validation failed: ${JSON.stringify(issues)}`,
          "The repaired specification didn't match the expected format. Please try again."
        )
      }

      throw new PlanningError(
        `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`,
        "Unable to process the AI response. Please try again."
      )
    }
  }

  /**
   * Log summary of repair changes
   * 
   * Requirement 5.6: Log every change with before/after values
   * 
   * @param original - Original specification
   * @param repaired - Repaired specification
   * @param critique - Critique that triggered repair
   */
  private logRepairSummary(
    original: ApplicationSpecification,
    repaired: ApplicationSpecification,
    critique: CritiqueReport
  ): void {
    const changes: string[] = []

    // Check for added data entities
    const addedEntities = repaired.dataEntities.filter(
      (e) => !original.dataEntities.some((o) => o.name === e.name)
    )
    if (addedEntities.length > 0) {
      changes.push(
        `Added ${addedEntities.length} data entities: ${addedEntities.map((e) => e.name).join(", ")}`
      )
    }

    // Check for added user roles
    const addedRoles = repaired.userRoles.filter((r) => !original.userRoles.includes(r))
    if (addedRoles.length > 0) {
      changes.push(`Added ${addedRoles.length} user roles: ${addedRoles.join(", ")}`)
    }

    // Check for authentication requirements changes
    if (
      (!original.authenticationRequirements || original.authenticationRequirements.trim() === "") &&
      repaired.authenticationRequirements &&
      repaired.authenticationRequirements.trim() !== ""
    ) {
      changes.push("Added authentication requirements")
    }

    // Check for added features
    const addedFeatures = repaired.suggestedFeatures.filter(
      (f) => !original.suggestedFeatures.some((o) => o.key === f.key)
    )
    if (addedFeatures.length > 0) {
      changes.push(
        `Added ${addedFeatures.length} features: ${addedFeatures.map((f) => f.key).join(", ")}`
      )
    }

    logger.info("[RepairService] Repair summary", "Repair statistics", {
      criticalIssuesAddressed: critique.criticalIssues.length,
      warningsAddressed: critique.warnings.length,
      changes: changes.length > 0 ? changes : ["No structural changes detected"],
    })
  }

  /**
   * Extract JSON from AI response text
   * 
   * Handles responses wrapped in markdown code fences or plain JSON.
   * 
   * @param text - Raw AI response text
   * @returns Extracted JSON string
   */
  private extractJson(text: string): string {
    // Try to extract from markdown code fence
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenceMatch && fenceMatch[1]) {
      return fenceMatch[1].trim()
    }

    // Try to find JSON object boundaries
    const braceStart = text.indexOf("{")
    const braceEnd = text.lastIndexOf("}")

    if (braceStart !== -1 && braceEnd > braceStart) {
      return text.slice(braceStart, braceEnd + 1)
    }

    // Return as-is if no fences or braces found (will likely fail parsing)
    return text.trim()
  }
}
