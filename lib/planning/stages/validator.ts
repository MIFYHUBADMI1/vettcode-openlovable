/**
 * SemanticValidator - Final consistency validation without AI
 * 
 * Performs programmatic validation checks on ApplicationSpecification to ensure:
 * - All entity references resolve
 * - No circular dependencies
 * - All role references are defined
 * - Authentication is consistent
 * 
 * This is a final safety check after repair - uses deterministic logic, not AI.
 * 
 * Requirements: 6.1-6.7
 * Design: SemanticValidator component section
 * 
 * @module lib/planning/stages/validator
 */

import { logger } from "@/lib/logging/logger"
import type { ApplicationSpecification } from "@/lib/types/specification"

/**
 * Validation error with field path
 */
export interface ValidationError {
  field: string // JSONPath format
  message: string
  severity: "critical" | "warning"
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * SemanticValidator performs final consistency checks on specifications
 */
export class SemanticValidator {
  /**
   * Validate an ApplicationSpecification for consistency
   * 
   * Performs deterministic validation checks:
   * - Entity reference integrity
   * - Circular dependency detection
   * - Role reference validation
   * - Authentication consistency
   * 
   * @param specification - ApplicationSpecification to validate
   * @returns ValidationResult with errors if any
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
   */
  validate(specification: ApplicationSpecification): ValidationResult {
    logger.info("[SemanticValidator] Starting validation", "Validating specification", {
      title: specification.title,
    })

    const errors: ValidationError[] = []

    // Requirement 6.2: Validate entity references
    errors.push(...this.validateEntityReferences(specification))

    // Requirement 6.5: Detect circular dependencies
    errors.push(...this.validateCircularDependencies(specification))

    // Requirement 6.4: Validate role references
    errors.push(...this.validateRoleReferences(specification))

    // Requirement 6.3: Validate authentication consistency
    errors.push(...this.validateAuthenticationConsistency(specification))

    const valid = errors.filter((e) => e.severity === "critical").length === 0

    logger.info("[SemanticValidator] Validation complete", "Validation finished", {
      title: specification.title,
      valid,
      errors: errors.length,
      critical: errors.filter((e) => e.severity === "critical").length,
      warnings: errors.filter((e) => e.severity === "warning").length,
    })

    return { valid, errors }
  }

  /**
   * Validate that all entity references resolve to defined entities
   * 
   * Requirement 6.2: Check entity references in flows
   */
  private validateEntityReferences(specification: ApplicationSpecification): ValidationError[] {
    const errors: ValidationError[] = []
    const entityNames = new Set(specification.dataEntities.map((e) => e.name.toLowerCase()))

    // Scan core flows for entity references
    specification.coreFlows.forEach((flow, idx) => {
      const text = `${flow.name} ${flow.description || ""}`
      const words = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g) || []

      words.forEach((word) => {
        if (!entityNames.has(word.toLowerCase()) && word.length > 3) {
          // Skip common words that aren't entities
          if (!["Create", "Update", "Delete", "View", "List", "Manage"].includes(word)) {
            errors.push({
              field: `$.coreFlows[${idx}]`,
              message: `May reference undefined entity "${word}". Verify it exists in dataEntities.`,
              severity: "warning",
            })
          }
        }
      })
    })

    return errors
  }

  /**
   * Detect circular dependencies in data entity relationships
   * 
   * Requirement 6.5: Detect cycles using depth-first search
   */
  private validateCircularDependencies(specification: ApplicationSpecification): ValidationError[] {
    const errors: ValidationError[] = []
    const entityMap = new Map(specification.dataEntities.map((e) => [e.name, e]))

    // Build adjacency list from field references
    const graph = new Map<string, Set<string>>()
    specification.dataEntities.forEach((entity) => {
      const deps = new Set<string>()
      entity.fields.forEach((field) => {
        // Look for entity references in field names
        const match = field.match(/^([A-Z][a-z]+(?:[A-Z][a-z]+)*)(Id|Ids)?$/)
        if (match && match[1]) {
          const referencedEntity = match[1]
          if (entityMap.has(referencedEntity) && referencedEntity !== entity.name) {
            deps.add(referencedEntity)
          }
        }
      })
      graph.set(entity.name, deps)
    })

    // DFS to detect cycles
    const visited = new Set<string>()
    const recStack = new Set<string>()

    const hasCycle = (node: string, path: string[]): string[] | null => {
      visited.add(node)
      recStack.add(node)
      path.push(node)

      const neighbors = graph.get(node) || new Set()
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cyclePath = hasCycle(neighbor, [...path])
          if (cyclePath) return cyclePath
        } else if (recStack.has(neighbor)) {
          return [...path, neighbor]
        }
      }

      recStack.delete(node)
      return null
    }

    specification.dataEntities.forEach((entity) => {
      if (!visited.has(entity.name)) {
        const cyclePath = hasCycle(entity.name, [])
        if (cyclePath) {
          errors.push({
            field: "$.dataEntities",
            message: `Circular dependency detected: ${cyclePath.join(" → ")}`,
            severity: "warning",
          })
        }
      }
    })

    return errors
  }

  /**
   * Validate that all role references exist in userRoles array
   * 
   * Requirement 6.4: Verify role references
   */
  private validateRoleReferences(specification: ApplicationSpecification): ValidationError[] {
    const errors: ValidationError[] = []
    const definedRoles = new Set(specification.userRoles.map((r) => r.toLowerCase()))

    // Common role-indicating phrases
    const rolePatterns = [
      /\b(admin|administrator)s?\b/gi,
      /\b(user|member)s?\b/gi,
      /\b(moderator|mod)s?\b/gi,
      /\b(guest|visitor)s?\b/gi,
      /\b(owner|creator)s?\b/gi,
    ]

    // Scan core flows
    specification.coreFlows.forEach((flow, idx) => {
      const text = `${flow.name} ${flow.description || ""}`

      rolePatterns.forEach((pattern) => {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
          const role = match[1].toLowerCase()
          if (!definedRoles.has(role) && !definedRoles.has(role + "s")) {
            errors.push({
              field: `$.coreFlows[${idx}]`,
              message: `References role "${role}" which is not in userRoles array.`,
              severity: "warning",
            })
          }
        }
      })
    })

    return errors
  }

  /**
   * Validate authentication consistency
   * 
   * Requirement 6.3: Check enabled auth features match authenticationRequirements
   */
  private validateAuthenticationConsistency(specification: ApplicationSpecification): ValidationError[] {
    const errors: ValidationError[] = []

    // Check if auth feature is enabled
    const authFeature = specification.suggestedFeatures.find(
      (f) => f.key === "auth" || f.key === "authentication"
    )

    if (authFeature && authFeature.enabled) {
      // Auth is enabled, verify authenticationRequirements exists
      if (
        !specification.authenticationRequirements ||
        specification.authenticationRequirements.trim() === ""
      ) {
        errors.push({
          field: "$.authenticationRequirements",
          message: "Authentication feature is enabled but authenticationRequirements is empty. Add authentication requirements or disable the auth feature.",
          severity: "critical",
        })
      }
    }

    return errors
  }
}
