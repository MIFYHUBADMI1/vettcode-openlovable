/**
 * IndependentCritic - Validates ApplicationSpecification without modification
 * 
 * Performs independent validation of the specification checking for:
 * - Data entity referential integrity
 * - Authentication consistency
 * - User role consistency
 * - Technology stack compliance
 * - Circular dependencies
 * 
 * DOES NOT modify the specification - only identifies issues for RepairService.
 * 
 * Requirements: 4.1-4.7, 6.1-6.7, 17.1-17.8
 * Design: IndependentCritic component section
 * 
 * @module lib/planning/stages/critic
 */

import "server-only"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { logger } from "@/lib/logging/logger"
import type { ApplicationSpecification } from "@/lib/types/specification"
import {
  CritiqueReportSchema,
  type CritiqueReport,
  calculateQualityScore,
} from "@/lib/types/critique-report"
import { ModelRegistry } from "@/lib/planning/models/registry"
import { ValidationError } from "@/lib/planning/errors"
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
 * System prompt for specification critique
 * 
 * Instructs the AI to perform validation-only critique without modifications.
 */
const SYSTEM_PROMPT = `You are an expert code reviewer and technical architect specializing in application specification validation.

Your task is to critique an ApplicationSpecification for consistency, completeness, and correctness. You MUST NOT modify the specification - only identify issues.

**VALIDATION RULES**

1. **Data Entity Referential Integrity** (CRITICAL)
   - Scan all text fields for entity references
   - Check if referenced entities exist in dataEntities array
   - Flag undefined entities as critical missing_definition issues
   - Example: "User profile management" references "User" entity - verify User exists

2. **Authentication Consistency** (CRITICAL)
   - If any suggested features have key="auth" with enabled=true
   - Verify authenticationRequirements field is defined and non-empty
   - If auth is enabled but authenticationRequirements is missing, flag as critical auth_inconsistency

3. **User Role Consistency** (CRITICAL)
   - Scan coreFlows, backendRequirements, suggestedFeatures for role mentions
   - Verify all mentioned roles exist in userRoles array
   - Common role references: "admin can...", "user can...", "moderator can..."
   - Flag undefined roles as critical role_mismatch

4. **Technology Stack Compliance** (CRITICAL)
   - Scan ALL text fields for unsupported technologies
   - Flag ANY reference to:
     * Databases: PostgreSQL, MySQL, MongoDB, SQLite, Redis (as primary DB)
     * ORMs: Prisma, Mongoose, Sequelize, TypeORM, Drizzle
     * Backend frameworks: Express, Fastify, NestJS, Koa, Hapi
     * BaaS: Firebase, Supabase, AWS Amplify, Parse
     * Auth services: Auth0, Clerk, Firebase Auth (not Totalum SDK)
   - Each violation is CRITICAL stack_violation
   - Recommend: "Use Totalum SDK for [functionality]" or "Use Next.js API routes"

5. **Circular Dependencies** (WARNING)
   - Check if any dataEntity field references create cycles
   - Example: User → Profile → User creates a cycle
   - Flag as warning circular_dependency

6. **Missing Core Flows** (WARNING)
   - If dataEntities are defined but no CRUD operations mentioned in coreFlows
   - Flag as warning missing_definition

7. **Incomplete Descriptions** (INFO)
   - If critical entities/flows lack descriptions
   - Flag as info suggestion

**ISSUE CLASSIFICATION**

- **critical**: MUST be fixed (missing entities, stack violations, auth inconsistency, role mismatches)
- **warning**: SHOULD be fixed (circular dependencies, missing CRUD flows)
- **info**: NICE to fix (missing descriptions, minor improvements)

**passesValidation RULE**

Set passesValidation = false if there are ANY critical issues.
Set passesValidation = true only if criticalIssues array is empty.

**FIELD PATH FORMAT**

Use JSONPath syntax:
- "$.dataEntities[0].name" for first entity name
- "$.coreFlows[2].description" for third flow description
- "$.authenticationRequirements" for auth field
- "$.backendRequirements[5]" for sixth backend requirement

**OUTPUT FORMAT**

Return ONLY a JSON object (no markdown, no explanation):

{
  "criticalIssues": [
    {
      "fieldPath": "string - JSONPath",
      "issueType": "missing_definition" | "inconsistent_reference" | "circular_dependency" | "stack_violation" | "role_mismatch" | "auth_inconsistency",
      "severity": "critical",
      "description": "string - what's wrong",
      "recommendation": "string - how to fix",
      "currentValue": "string (optional) - current problematic value",
      "suggestedValue": "string (optional) - recommended value"
    }
  ],
  "warnings": [
    {
      "fieldPath": "string",
      "issueType": "...",
      "severity": "warning",
      "description": "string",
      "recommendation": "string",
      "currentValue": "string (optional)",
      "suggestedValue": "string (optional)"
    }
  ],
  "suggestions": [
    {
      "fieldPath": "string",
      "issueType": "...",
      "severity": "info",
      "description": "string",
      "recommendation": "string",
      "currentValue": "string (optional)",
      "suggestedValue": "string (optional)"
    }
  ],
  "overallAssessment": "string - summary of the critique",
  "passesValidation": boolean - false if any critical issues exist
}

**IMPORTANT CONSTRAINTS**

- DO NOT modify the specification - only identify issues
- Be thorough - scan ALL text fields for entity/role/technology references
- All stack violations are CRITICAL
- Focus on issues that would cause build failures or incorrect behavior
- qualityScore and metadata will be calculated/added automatically`

/**
 * IndependentCritic validates ApplicationSpecifications without modifying them
 */
export class IndependentCritic {
  private modelRegistry: ModelRegistry

  constructor(modelRegistry?: ModelRegistry) {
    this.modelRegistry = modelRegistry || new ModelRegistry()
  }

  /**
   * Critique an ApplicationSpecification for issues
   * 
   * Validates the specification and generates a detailed critique report
   * identifying all consistency, completeness, and correctness issues.
   * 
   * @param specification - ApplicationSpecification to validate
   * @returns CritiqueReport with identified issues
   * @throws ValidationError if critique generation fails
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 6.1-6.7, 17.1, 17.6
   */
  async critique(specification: ApplicationSpecification): Promise<CritiqueReport> {
    logger.info("[IndependentCritic] Starting specification critique", "Beginning quality assessment", {
      title: specification.title,
      dataEntities: specification.dataEntities.length,
      coreFlows: specification.coreFlows.length,
    })

    try {
      // Use executeWithRetry wrapper for automatic retry with exponential backoff
      const report = await executeWithRetry(
        async () => this.callModelWithRetry(specification, 0),
        {
          maxAttempts: MAX_RETRIES,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        }
      )

      logger.info("[IndependentCritic] Critique completed", "Quality assessment finished", {
        title: specification.title,
        qualityScore: report.qualityScore,
        criticalIssues: report.criticalIssues.length,
        warnings: report.warnings.length,
        suggestions: report.suggestions.length,
        passesValidation: report.passesValidation,
      })

      return report
    } catch (error) {
      logger.error("[IndependentCritic] Critique generation failed", "Quality assessment error", {
        title: specification.title,
        error: error instanceof Error ? error.message : String(error),
      })

      // Wrap in ValidationError for consistent error handling
      if (error instanceof ValidationError) {
        throw error
      }

      throw new ValidationError(
        `Failed to critique specification: ${error instanceof Error ? error.message : String(error)}`,
        "Unable to validate specification. Please try again.",
        []
      )
    }
  }

  /**
   * Call the AI model to perform critique
   * 
   * @param specification - Specification to critique
   * @param attempt - Current attempt number (for fallback selection)
   * @returns Parsed and validated CritiqueReport
   * @throws ValidationError if generation or parsing fails
   * 
   * Requirements: 4.1, 4.2
   */
  private async callModelWithRetry(
    specification: ApplicationSpecification,
    attempt: number
  ): Promise<CritiqueReport> {
    // Get model config from registry
    const modelConfig =
      attempt === 0
        ? this.modelRegistry.getModelForStage("critique")
        : this.modelRegistry.getFallbackModel("critique", attempt)

    if (!modelConfig) {
      throw new ValidationError(
        "No fallback models available",
        "Unable to critique specification after multiple attempts. Please try again later.",
        []
      )
    }

    const modelName = modelConfig.primary
    const model = openrouter.chatModel(modelName)

    logger.info("[IndependentCritic] Calling AI model for critique", "Requesting quality assessment", {
      attempt: attempt + 1,
      modelName,
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
    })

    try {
      // Build critique prompt with specification data
      const prompt = this.buildCritiquePrompt(specification)

      // Call AI model with generateText
      const { text, usage } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
      })

      logger.info("[IndependentCritic] AI response received", "Model response received successfully", {
        responseLength: text.length,
        tokensUsed: usage?.totalTokens || 0,
      })

      // Parse and validate the response
      const report = this.parseAIResponse(text, modelName)

      return report
    } catch (error) {
      logger.error("[IndependentCritic] Model call failed", "AI model request failed", {
        attempt: attempt + 1,
        modelName,
        error: error instanceof Error ? error.message : String(error),
      })

      throw new ValidationError(
        `Model call failed on attempt ${attempt + 1}: ${error instanceof Error ? error.message : String(error)}`,
        "Unable to critique specification. Please try again.",
        []
      )
    }
  }

  /**
   * Build critique prompt from specification
   * 
   * @param specification - Specification to critique
   * @returns Formatted prompt for AI
   */
  private buildCritiquePrompt(specification: ApplicationSpecification): string {
    // Serialize specification as JSON for the AI to analyze
    const specJson = JSON.stringify(specification, null, 2)

    return `<specification>
${specJson}
</specification>

Critique this ApplicationSpecification for:
1. Data entity referential integrity (are all referenced entities defined?)
2. Authentication consistency (if auth enabled, are requirements specified?)
3. User role consistency (are all mentioned roles defined?)
4. Technology stack compliance (ONLY Totalum stack allowed - flag ANY unsupported tech)
5. Circular dependencies in data entities
6. Missing core flows for defined entities
7. Incomplete or missing descriptions

CRITICAL: Scan ALL text fields for references to:
- Data entities (in coreFlows, backendRequirements, suggestedFeatures, etc.)
- User roles (admin, moderator, etc.)
- Unsupported technologies (PostgreSQL, Prisma, Express, Firebase, etc.)

Return a complete critique report in JSON format.`
  }

  /**
   * Parse and validate AI response into CritiqueReport
   * 
   * @param text - Raw AI response text
   * @param modelName - Name of the model that generated the response
   * @returns Validated CritiqueReport object
   * @throws ValidationError if parsing or validation fails
   * 
   * Requirements: 17.1, 17.6
   */
  private parseAIResponse(text: string, modelName: string): CritiqueReport {
    try {
      // Extract JSON from response
      const jsonText = this.extractJson(text)

      // Parse JSON
      const parsedData = JSON.parse(jsonText)

      // Calculate quality score
      // Requirement 17.1: Calculate based on issue counts and severity
      const tempReport = {
        criticalIssues: parsedData.criticalIssues || [],
        warnings: parsedData.warnings || [],
        suggestions: parsedData.suggestions || [],
        overallAssessment: parsedData.overallAssessment || "No assessment provided",
        passesValidation: parsedData.passesValidation ?? true,
        qualityScore: 0,
        createdAt: Date.now(),
        modelUsed: modelName,
      }

      const qualityScore = calculateQualityScore(tempReport as CritiqueReport)

      // Override passesValidation if there are critical issues
      // Requirement 17.6: passesValidation = false if critical issues exist
      const passesValidation =
        (parsedData.criticalIssues || []).length === 0 &&
        (parsedData.passesValidation ?? true)

      // Add metadata and calculated scores
      const dataWithMetadata = {
        ...parsedData,
        qualityScore,
        passesValidation,
        createdAt: Date.now(),
        modelUsed: modelName,
      }

      // Validate against schema
      const report = CritiqueReportSchema.parse(dataWithMetadata)

      return report
    } catch (error) {
      logger.error("[IndependentCritic] Failed to parse AI response", "Response parsing failed", {
        error: error instanceof Error ? error.message : String(error),
        responsePreview: text.slice(0, 200),
      })

      if (error instanceof Error && "issues" in error) {
        // Zod validation error
        const issues = (error as any).issues
        throw new ValidationError(
          `Schema validation failed: ${JSON.stringify(issues)}`,
          "The AI response didn't match the expected format. Please try again.",
          []
        )
      }

      throw new ValidationError(
        `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`,
        "Unable to process the AI response. Please try again.",
        []
      )
    }
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
