/**
 * Validation Stage Schemas
 * ------------------------
 * Type definitions and utilities for semantic validation of specifications.
 * 
 * The validation stage performs final consistency checks before specifications
 * are returned to ensure no contradictions exist. This includes:
 * - Entity reference validation
 * - Circular dependency detection
 * - Role reference validation
 * - Authentication consistency validation
 * 
 * (Requirements 6.1-6.8)
 */

import { z } from "zod"
import type { ApplicationSpecification } from "@/lib/types/specification"

/**
 * Validation Error Schema
 * -----------------------
 * Detailed error information from validation failures.
 */
export const ValidationErrorSchema = z.object({
  field: z.string(), // JSONPath format: "$.dataEntities[2].name"
  message: z.string(),
  severity: z.enum(["critical", "warning"]),
})
export type ValidationError = z.infer<typeof ValidationErrorSchema>

/**
 * Validation Result Schema
 * ------------------------
 * Result from semantic validation checks.
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(ValidationErrorSchema).default([]),
})
export type ValidationResult = z.infer<typeof ValidationResultSchema>

/**
 * Create validation error
 * ----------------------
 * Helper to create a validation error object.
 */
export function createValidationError(
  field: string,
  message: string,
  severity: "critical" | "warning" = "critical"
): ValidationError {
  return { field, message, severity }
}

/**
 * Create successful validation result
 * -----------------------------------
 * Helper to create a passing validation result.
 */
export function createSuccessResult(): ValidationResult {
  return { valid: true, errors: [] }
}

/**
 * Create failed validation result
 * -------------------------------
 * Helper to create a failing validation result with errors.
 */
export function createFailureResult(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors }
}

/**
 * Validate entity references in specification
 * -------------------------------------------
 * Checks that all entity references in flows and features exist in dataEntities.
 */
export function validateEntityReferences(spec: ApplicationSpecification): ValidationError[] {
  const errors: ValidationError[] = []
  const entityNames = new Set(spec.dataEntities.map(e => e.name.toLowerCase()))
  
  // Check core flows for entity references
  for (let i = 0; i < spec.coreFlows.length; i++) {
    const flow = spec.coreFlows[i]
    const description = flow.description || ""
    
    // Look for potential entity references (capitalized words)
    const potentialEntities = description.match(/\b[A-Z][a-z]+\b/g) || []
    
    for (const entityRef of potentialEntities) {
      if (!entityNames.has(entityRef.toLowerCase())) {
        // Only flag if it looks like it might be an entity reference
        const looksLikeEntity = spec.dataEntities.some(e => 
          entityRef.toLowerCase().includes(e.name.toLowerCase().slice(0, 4))
        )
        
        if (looksLikeEntity) {
          errors.push(createValidationError(
            `$.coreFlows[${i}].description`,
            `Referenced entity "${entityRef}" is not defined in dataEntities`,
            "warning"
          ))
        }
      }
    }
  }
  
  // Check backend requirements for entity references
  for (let i = 0; i < spec.backendRequirements.length; i++) {
    const requirement = spec.backendRequirements[i]
    const potentialEntities = requirement.match(/\b[A-Z][a-z]+\b/g) || []
    
    for (const entityRef of potentialEntities) {
      if (!entityNames.has(entityRef.toLowerCase())) {
        const looksLikeEntity = spec.dataEntities.some(e => 
          entityRef.toLowerCase().includes(e.name.toLowerCase().slice(0, 4))
        )
        
        if (looksLikeEntity) {
          errors.push(createValidationError(
            `$.backendRequirements[${i}]`,
            `Referenced entity "${entityRef}" is not defined in dataEntities`,
            "warning"
          ))
        }
      }
    }
  }
  
  return errors
}

/**
 * Validate role references in specification
 * -----------------------------------------
 * Checks that all role references in flows match defined userRoles.
 */
export function validateRoleReferences(spec: ApplicationSpecification): ValidationError[] {
  const errors: ValidationError[] = []
  const roles = new Set(spec.userRoles.map(r => r.toLowerCase()))
  
  // Check core flows for role references
  for (let i = 0; i < spec.coreFlows.length; i++) {
    const flow = spec.coreFlows[i]
    const description = flow.description || ""
    
    // Look for role references (common patterns: "as a X", "X can", etc.)
    const rolePatterns = [
      /as (?:a|an) (\w+)/gi,
      /(\w+) can/gi,
      /(\w+) should/gi,
    ]
    
    for (const pattern of rolePatterns) {
      const matches = description.matchAll(pattern)
      for (const match of matches) {
        const roleRef = match[1]
        if (!roles.has(roleRef.toLowerCase())) {
          errors.push(createValidationError(
            `$.coreFlows[${i}].description`,
            `Referenced role "${roleRef}" is not defined in userRoles`,
            "warning"
          ))
        }
      }
    }
  }
  
  return errors
}

/**
 * Validate authentication consistency
 * -----------------------------------
 * Checks that auth features match authentication requirements.
 */
export function validateAuthenticationConsistency(spec: ApplicationSpecification): ValidationError[] {
  const errors: ValidationError[] = []
  
  const authFeatureEnabled = spec.suggestedFeatures.some(
    f => f.key === "auth" && f.enabled
  )
  
  const hasAuthRequirements = 
    spec.authenticationRequirements !== undefined &&
    spec.authenticationRequirements.trim() !== ""
  
  if (authFeatureEnabled && !hasAuthRequirements) {
    errors.push(createValidationError(
      "$.authenticationRequirements",
      "Authentication feature is enabled but authenticationRequirements is not defined",
      "critical"
    ))
  }
  
  if (!authFeatureEnabled && hasAuthRequirements) {
    errors.push(createValidationError(
      "$.suggestedFeatures",
      "Authentication requirements defined but auth feature is not enabled",
      "warning"
    ))
  }
  
  return errors
}

/**
 * Detect circular dependencies in data entities
 * ---------------------------------------------
 * Checks for circular references in entity relationships.
 */
export function detectCircularDependencies(spec: ApplicationSpecification): ValidationError[] {
  const errors: ValidationError[] = []
  
  // Build dependency graph
  const dependencies = new Map<string, Set<string>>()
  
  for (const entity of spec.dataEntities) {
    const deps = new Set<string>()
    
    // Look for entity references in fields
    for (const field of entity.fields) {
      const fieldLower = field.toLowerCase()
      
      // Check if field references another entity
      for (const otherEntity of spec.dataEntities) {
        if (entity.name !== otherEntity.name) {
          if (fieldLower.includes(otherEntity.name.toLowerCase())) {
            deps.add(otherEntity.name)
          }
        }
      }
    }
    
    dependencies.set(entity.name, deps)
  }
  
  // Detect cycles using DFS
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  
  function hasCycle(node: string, path: string[]): boolean {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)
    
    const neighbors = dependencies.get(node) || new Set()
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor, [...path])) {
          return true
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor)
        const cycle = [...path.slice(cycleStart), neighbor]
        
        const entityIndex = spec.dataEntities.findIndex(e => e.name === node)
        errors.push(createValidationError(
          `$.dataEntities[${entityIndex}]`,
          `Circular dependency detected: ${cycle.join(" → ")}`,
          "critical"
        ))
        return true
      }
    }
    
    recursionStack.delete(node)
    return false
  }
  
  for (const entity of spec.dataEntities) {
    if (!visited.has(entity.name)) {
      hasCycle(entity.name, [])
    }
  }
  
  return errors
}

/**
 * Validate feature consistency
 * ----------------------------
 * Checks that enabled features are supported and consistent.
 */
export function validateFeatureConsistency(spec: ApplicationSpecification): ValidationError[] {
  const errors: ValidationError[] = []
  
  // Check for duplicate feature keys
  const seenKeys = new Set<string>()
  for (let i = 0; i < spec.suggestedFeatures.length; i++) {
    const feature = spec.suggestedFeatures[i]
    if (seenKeys.has(feature.key)) {
      errors.push(createValidationError(
        `$.suggestedFeatures[${i}]`,
        `Duplicate feature key: ${feature.key}`,
        "critical"
      ))
    }
    seenKeys.add(feature.key)
  }
  
  // Check for required features
  const enabledKeys = new Set(
    spec.suggestedFeatures.filter(f => f.enabled).map(f => f.key)
  )
  
  // If payments enabled, database should also be enabled
  if (enabledKeys.has("payments") && !enabledKeys.has("database")) {
    errors.push(createValidationError(
      "$.suggestedFeatures",
      "Payments feature requires database feature to be enabled",
      "warning"
    ))
  }
  
  // If admin enabled, auth should also be enabled
  if (enabledKeys.has("admin") && !enabledKeys.has("auth")) {
    errors.push(createValidationError(
      "$.suggestedFeatures",
      "Admin panel feature typically requires authentication",
      "warning"
    ))
  }
  
  return errors
}

/**
 * Perform complete semantic validation
 * ------------------------------------
 * Runs all validation checks and returns combined result.
 */
export function validateSpecification(spec: ApplicationSpecification): ValidationResult {
  const errors: ValidationError[] = [
    ...validateEntityReferences(spec),
    ...validateRoleReferences(spec),
    ...validateAuthenticationConsistency(spec),
    ...detectCircularDependencies(spec),
    ...validateFeatureConsistency(spec),
  ]
  
  // Only fail on critical errors
  const hasCriticalErrors = errors.some(e => e.severity === "critical")
  
  return {
    valid: !hasCriticalErrors,
    errors,
  }
}

/**
 * Format validation errors for logging
 * ------------------------------------
 * Returns human-readable string representation of validation errors.
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return "Validation passed"
  }
  
  const criticalErrors = result.errors.filter(e => e.severity === "critical")
  const warnings = result.errors.filter(e => e.severity === "warning")
  
  const lines: string[] = []
  
  if (criticalErrors.length > 0) {
    lines.push("Critical Validation Errors:")
    for (const error of criticalErrors) {
      lines.push(`  - ${error.field}: ${error.message}`)
    }
  }
  
  if (warnings.length > 0) {
    lines.push("\nValidation Warnings:")
    for (const error of warnings) {
      lines.push(`  - ${error.field}: ${error.message}`)
    }
  }
  
  return lines.join("\n")
}
