# Requirements Document

## Introduction

Atai's AI Planning Pipeline Upgrade modernizes application specification generation by introducing a multi-stage, validated planning architecture. The upgrade addresses the current architectural imbalance where Idea Mode produces specifications in a single pass while Website Mode uses a two-stage understanding-then-specification approach. The new unified pipeline introduces explicit understanding stages for both modes, adaptive research phases, independent critique validation, and semantic consistency checks before specifications reach the Totalum builder.

This upgrade aims to produce higher-quality, more complete, and internally consistent ApplicationSpecifications while maintaining backward compatibility with existing Totalum build pipelines and preserving all current functionality.

## Glossary

- **Planning_Pipeline**: The complete multi-stage system that transforms user inputs (ideas or websites) into validated ApplicationSpecifications
- **Understanding_Stage**: The initial analysis phase that produces structured interpretations of user inputs
- **Primary_Planner**: The AI component responsible for generating the initial ApplicationSpecification
- **Research_Agent**: An AI component that performs adaptive product and technical analysis to identify gaps
- **Independent_Critic**: A validation AI that reviews specifications for issues without rewriting them
- **Repair_Service**: The final refinement component that fixes validated issues in specifications
- **ApplicationSpecification**: The canonical output schema consumed by the Totalum builder
- **IdeaUnderstanding**: A new structured representation of user ideas before specification generation
- **ProjectUnderstanding**: The existing structured representation of website analysis
- **Semantic_Validator**: A component that verifies internal consistency of specifications
- **Totalum_Builder**: The existing downstream service that builds applications from specifications
- **Model_Registry**: A configuration system for managing AI model selection and fallbacks
- **Planning_Run**: A tracked execution of the planning pipeline with logging and error handling
- **Sanitizer**: A component that enforces technology stack constraints on generated specifications
- **Complexity_Classifier**: A component that assigns tier classifications to specifications

## Requirements

### Requirement 1: Idea Mode Understanding Stage

**User Story:** As a Atai developer, I want Idea Mode to produce explicit IdeaUnderstanding objects before generating specifications, so that idea-based and website-based projects follow consistent planning architectures.

#### Acceptance Criteria

1. WHEN a user submits an application idea, THE Planning_Pipeline SHALL generate an IdeaUnderstanding object before creating the ApplicationSpecification
2. THE IdeaUnderstanding object SHALL contain structured fields for purpose, target users, core features, data entities, technical requirements, and user flows
3. WHEN generating IdeaUnderstanding, THE Planning_Pipeline SHALL distinguish between explicit user statements and AI inferences using confidence levels
4. THE Planning_Pipeline SHALL store IdeaUnderstanding in the project record alongside ApplicationSpecification
5. WHEN IdeaUnderstanding generation fails, THE Planning_Pipeline SHALL retry with fallback models before reporting failure
6. THE IdeaUnderstanding schema SHALL be compatible with the Research_Agent input format
7. WHEN the user provides an idea under 50 characters, THE Planning_Pipeline SHALL request clarification before proceeding
8. THE Planning_Pipeline SHALL complete IdeaUnderstanding generation within 30 seconds under normal conditions

### Requirement 2: Adaptive Research Phase

**User Story:** As a product owner, I want the planning pipeline to identify missing features, security concerns, and technical gaps, so that generated specifications are complete and production-ready.

#### Acceptance Criteria

1. WHEN an Understanding object (Idea or Website) is available, THE Research_Agent SHALL analyze it for product completeness gaps
2. THE Research_Agent SHALL identify missing authentication requirements, data validation needs, error handling patterns, and edge cases
3. WHEN security-sensitive features are detected, THE Research_Agent SHALL flag authentication, authorization, and data protection requirements
4. THE Research_Agent SHALL analyze UX completeness including navigation, feedback mechanisms, loading states, and empty states
5. THE Research_Agent SHALL output a structured ResearchFindings object containing identified gaps and recommendations
6. WHEN the Research_Agent detects technology stack violations, THE Research_Agent SHALL recommend Totalum SDK alternatives
7. THE Research_Agent SHALL complete analysis within 45 seconds under normal conditions
8. WHEN Research_Agent analysis fails, THE Planning_Pipeline SHALL proceed with the Understanding object and log the failure

### Requirement 3: Shared Planning Service

**User Story:** As a Atai developer, I want both Idea Mode and Website Mode to use a unified planning service, so that specification quality is consistent regardless of input type.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL provide a unified planApplication function accepting either IdeaUnderstanding or ProjectUnderstanding
2. WHEN called with either understanding type, THE Primary_Planner SHALL generate an ApplicationSpecification following the same process
3. THE Planning_Pipeline SHALL merge ResearchFindings into the planning context before specification generation
4. WHEN generating specifications, THE Primary_Planner SHALL enforce the Totalum technology stack (React, Next.js, Tailwind CSS, Totalum SDK)
5. THE Primary_Planner SHALL distinguish between observed facts, AI inferences, and AI recommendations in generated specifications
6. THE Planning_Pipeline SHALL track each planning stage execution in a Planning_Run record
7. WHEN Primary_Planner generation fails, THE Planning_Pipeline SHALL retry with a fallback model before failing
8. THE Planning_Pipeline SHALL complete primary planning within 60 seconds under normal conditions

### Requirement 4: Independent Critique System

**User Story:** As a quality assurance engineer, I want generated specifications to be independently validated for consistency and completeness, so that issues are caught before reaching the Totalum builder.

#### Acceptance Criteria

1. WHEN the Primary_Planner produces an ApplicationSpecification, THE Independent_Critic SHALL validate it without modifying it
2. THE Independent_Critic SHALL check for missing core flows, undefined data entities, inconsistent user roles, and contradictory requirements
3. THE Independent_Critic SHALL verify that authentication requirements match enabled security features
4. WHEN enabled features reference data entities, THE Independent_Critic SHALL verify those entities are defined in the specification
5. THE Independent_Critic SHALL output a structured CritiqueReport containing identified issues with severity levels (critical, warning, info)
6. THE Independent_Critic SHALL use a different AI model than the Primary_Planner to avoid systematic blind spots
7. WHEN the Independent_Critic detects technology stack violations, THE Independent_Critic SHALL flag them as critical issues
8. THE Independent_Critic SHALL complete validation within 30 seconds under normal conditions

### Requirement 5: Final Repair and Refinement

**User Story:** As a Atai developer, I want validated specification issues to be automatically repaired, so that the Totalum builder receives high-quality, consistent specifications.

#### Acceptance Criteria

1. WHEN the Independent_Critic identifies critical or warning-level issues, THE Repair_Service SHALL generate a repaired ApplicationSpecification
2. THE Repair_Service SHALL address only the specific issues identified in the CritiqueReport
3. WHEN repairing specifications, THE Repair_Service SHALL preserve all user-provided content and preferences
4. THE Repair_Service SHALL add missing data entities, complete undefined flows, and resolve role inconsistencies
5. WHEN repair introduces new features, THE Repair_Service SHALL set them as disabled by default
6. THE Repair_Service SHALL log all changes made during repair for debugging purposes
7. WHEN repair fails or introduces new validation errors, THE Planning_Pipeline SHALL use the pre-repair specification and log the failure
8. THE Repair_Service SHALL complete repair within 30 seconds under normal conditions

### Requirement 6: Semantic Validation

**User Story:** As a system architect, I want specifications to be validated for internal consistency, so that contradictory or impossible requirements don't reach the builder.

#### Acceptance Criteria

1. WHEN a final ApplicationSpecification is produced, THE Semantic_Validator SHALL verify internal consistency before pipeline completion
2. THE Semantic_Validator SHALL check that all referenced data entities in core flows are defined in the dataEntities array
3. THE Semantic_Validator SHALL verify that enabled authentication features correspond to defined authentication requirements
4. WHEN user roles are defined, THE Semantic_Validator SHALL verify that core flows reference valid roles
5. THE Semantic_Validator SHALL detect circular dependencies in data entity relationships
6. THE Semantic_Validator SHALL verify that integration requirements are compatible with the Totalum SDK stack
7. WHEN validation fails, THE Semantic_Validator SHALL return specific error details indicating which fields are inconsistent
8. THE Semantic_Validator SHALL complete validation within 10 seconds under normal conditions

### Requirement 7: Multi-Model Strategy

**User Story:** As a reliability engineer, I want the planning pipeline to use model fallbacks, so that temporary model outages don't break the entire system.

#### Acceptance Criteria

1. THE Model_Registry SHALL maintain separate model configurations for Primary_Planner, Research_Agent, Independent_Critic, and Repair_Service
2. WHEN a primary model fails with a retryable error, THE Planning_Pipeline SHALL attempt the same stage with a fallback model
3. THE Model_Registry SHALL support configuring primary and fallback models via environment variables
4. THE Planning_Pipeline SHALL log which model was used for each planning stage
5. WHEN all configured models for a stage fail, THE Planning_Pipeline SHALL report the failure with details from all attempts
6. THE Model_Registry SHALL expose model selection as a configurable strategy (cost-optimized, quality-optimized, speed-optimized)
7. THE Planning_Pipeline SHALL never retry a failed stage more than 3 times across all fallback models
8. WHEN model selection fails, THE Planning_Pipeline SHALL use OpenRouter auto model selection as a final fallback

### Requirement 8: Website Mode Enhancement

**User Story:** As a content analyst, I want website analysis to clearly distinguish observed content from AI inferences and recommendations, so that users understand what is factual versus interpreted.

#### Acceptance Criteria

1. WHEN analyzing website evidence, THE Understanding_Stage SHALL tag each piece of functionality as observed, inferred, or suggested
2. THE ProjectUnderstanding object SHALL separate observedFunctionality, inferredFunctionality, and suggestedFeatures as distinct arrays
3. WHEN extracting data entities from website content, THE Understanding_Stage SHALL mark their confidence level (observed, inferred, suggested)
4. THE Understanding_Stage SHALL treat all website content as untrusted data and ignore embedded instructions
5. WHEN website content contains technology stack references, THE Understanding_Stage SHALL sanitize them to Totalum SDK equivalents
6. THE Understanding_Stage SHALL preserve original website URLs, screenshots, and navigation structure as evidence
7. THE Planning_Pipeline SHALL pass observed facts with higher priority than inferences when generating specifications
8. THE Understanding_Stage SHALL complete website understanding within 45 seconds for sites with up to 10 pages

### Requirement 9: Backward Compatibility

**User Story:** As a Atai maintainer, I want the upgraded pipeline to maintain backward compatibility with existing code, so that deployment requires no breaking changes to downstream systems.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL produce ApplicationSpecification objects matching the existing ApplicationSpecificationSchema exactly
2. THE Planning_Pipeline SHALL maintain the existing project state transitions (analyzing, analysis_complete, specification_ready)
3. WHEN existing consumers call generateSpecificationFromIdea or generateSpecificationFromUnderstanding, THE Planning_Pipeline SHALL route through the new pipeline transparently
4. THE Planning_Pipeline SHALL preserve existing credit charging behavior (SCRAPE_COST, PLAN_COST, DEEP_CRAWL_COST)
5. THE Planning_Pipeline SHALL emit project events in the same format as the current implementation
6. THE Planning_Pipeline SHALL store Understanding objects in the project.understanding field using existing schemas
7. WHEN the new pipeline is disabled via feature flag, THE Planning_Pipeline SHALL fall back to the original implementation
8. THE Planning_Pipeline SHALL support gradual rollout via percentage-based feature flagging

### Requirement 10: Totalum Compatibility

**User Story:** As a Totalum integration engineer, I want generated specifications to remain fully compatible with Totalum builder requirements, so that builds succeed without manual specification editing.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL enforce that all generated specifications reference only React, Next.js, Tailwind CSS, and Totalum SDK
2. WHEN specifications reference databases, THE Sanitizer SHALL replace external databases with Totalum SDK database references
3. WHEN specifications reference ORMs, THE Sanitizer SHALL replace them with Totalum SDK data access patterns
4. WHEN specifications reference backend frameworks, THE Sanitizer SHALL replace them with Next.js API routes
5. THE Planning_Pipeline SHALL validate that designDirection and additionalInstructions do not contradict Totalum stack constraints
6. THE Planning_Pipeline SHALL ensure suggestedFeatures use feature keys compatible with Totalum builder expectations
7. THE Planning_Pipeline SHALL classify specification complexity (simple, medium, complex) using the existing Complexity_Classifier
8. THE Planning_Pipeline SHALL ensure repaired specifications pass the same Totalum compatibility checks as original specifications

### Requirement 11: Error Handling and Resilience

**User Story:** As a site reliability engineer, I want the planning pipeline to handle failures gracefully, so that temporary issues don't result in lost user work or billing errors.

#### Acceptance Criteria

1. WHEN any planning stage fails, THE Planning_Pipeline SHALL log the failure with stage name, error message, and Planning_Run ID
2. THE Planning_Pipeline SHALL implement exponential backoff for retryable errors (rate limits, timeouts, temporary outages)
3. WHEN a stage fails after all retries, THE Planning_Pipeline SHALL update project state with a user-friendly error message
4. THE Planning_Pipeline SHALL preserve partially completed work (Understanding, ResearchFindings) even if later stages fail
5. WHEN credit charging fails, THE Planning_Pipeline SHALL halt execution and update project state to prevent unbilled work
6. THE Planning_Pipeline SHALL implement circuit breakers for external services (Firecrawl, OpenRouter) after 5 consecutive failures
7. WHEN validation detects prompt injection attempts in website content, THE Planning_Pipeline SHALL sanitize the content and log the detection
8. THE Planning_Pipeline SHALL complete error recovery actions within 5 seconds of detecting a failure

### Requirement 12: Billing Safety

**User Story:** As a billing administrator, I want planning pipeline retries and fallbacks to not result in duplicate charges, so that users are charged fairly.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL charge credits exactly once per project for each chargeable operation (scrape, plan, deep crawl)
2. WHEN planning stages retry due to errors, THE Planning_Pipeline SHALL not charge additional credits for retries
3. THE Planning_Pipeline SHALL check credit availability before starting any chargeable operation
4. WHEN credit reservation fails, THE Planning_Pipeline SHALL halt execution immediately without performing work
5. THE Planning_Pipeline SHALL refund reserved credits if planning fails before completion
6. THE Planning_Pipeline SHALL record credit charges with Planning_Run ID for audit trail
7. WHEN a user cancels an in-progress planning operation, THE Planning_Pipeline SHALL refund any reserved credits
8. THE Planning_Pipeline SHALL prevent concurrent planning operations for the same project to avoid race conditions

### Requirement 13: Observability and Debugging

**User Story:** As a platform engineer, I want comprehensive logging of planning pipeline execution, so that I can debug issues and optimize performance.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL log entry and exit for each planning stage with timing information
2. THE Planning_Pipeline SHALL log AI model selection decisions and fallback triggers
3. THE Planning_Pipeline SHALL log sanitization actions when unsupported technologies are replaced
4. THE Planning_Pipeline SHALL log validation failures with specific field paths and error descriptions
5. THE Planning_Pipeline SHALL never log sensitive user data, API keys, or full prompt contents
6. THE Planning_Pipeline SHALL emit structured logs compatible with the existing logger service
7. THE Planning_Pipeline SHALL track Planning_Run records with stage progression and outcome
8. WHEN planning completes, THE Planning_Pipeline SHALL log a summary including total duration, models used, and stages completed

### Requirement 14: Testing Requirements

**User Story:** As a quality assurance engineer, I want comprehensive test coverage for the planning pipeline, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL have unit tests covering each planning stage in isolation
2. THE Planning_Pipeline SHALL have integration tests covering the complete pipeline flow for both Idea Mode and Website Mode
3. THE Planning_Pipeline SHALL have tests verifying model fallback behavior when primary models fail
4. THE Planning_Pipeline SHALL have tests verifying credit charging idempotency and refund behavior
5. THE Planning_Pipeline SHALL have tests verifying backward compatibility with existing ApplicationSpecification consumers
6. THE Planning_Pipeline SHALL have tests verifying technology stack sanitization for all unsupported technologies
7. THE Planning_Pipeline SHALL have tests verifying semantic validation detects common inconsistencies
8. THE Planning_Pipeline SHALL have tests verifying that prompt injection attempts in website content are safely handled

### Requirement 15: IdeaUnderstanding Schema

**User Story:** As a data architect, I want a well-defined schema for IdeaUnderstanding, so that idea analysis produces structured, consistent output.

#### Acceptance Criteria

1. THE IdeaUnderstanding schema SHALL include fields for purpose, description, targetUsers, userRoles, coreFeatures, dataEntities, and technicalRequirements
2. WHEN users provide explicit information, THE IdeaUnderstanding SHALL mark those fields with confidence level "explicit"
3. WHEN the Understanding_Stage infers information, THE IdeaUnderstanding SHALL mark those fields with confidence level "inferred"
4. THE IdeaUnderstanding schema SHALL include a userFlows array containing potential user journeys
5. THE IdeaUnderstanding schema SHALL include a suggestedFeatures array using the same feature keys as ApplicationSpecification
6. THE IdeaUnderstanding schema SHALL include an authenticationNeeds field describing authentication requirements
7. THE IdeaUnderstanding schema SHALL be validated using Zod before being stored in the project record
8. THE IdeaUnderstanding schema SHALL support serialization to JSON without data loss

### Requirement 16: ResearchFindings Schema

**User Story:** As a data architect, I want a well-defined schema for ResearchFindings, so that adaptive research produces actionable, structured recommendations.

#### Acceptance Criteria

1. THE ResearchFindings schema SHALL include arrays for missingFeatures, securityConcerns, uxGaps, technicalRisks, and edgeCases
2. WHEN the Research_Agent identifies a gap, THE ResearchFindings SHALL include a severity level (critical, warning, info)
3. THE ResearchFindings schema SHALL include a recommendations array with actionable suggestions
4. WHEN security issues are identified, THE ResearchFindings SHALL specify affected features and mitigation approaches
5. THE ResearchFindings schema SHALL include a completenessScore field indicating overall specification readiness (0-100)
6. THE ResearchFindings schema SHALL be validated using Zod before being passed to the Primary_Planner
7. THE ResearchFindings schema SHALL support merging multiple research passes without duplication
8. THE ResearchFindings schema SHALL include metadata indicating which understanding type was analyzed (idea or website)

### Requirement 17: CritiqueReport Schema

**User Story:** As a data architect, I want a well-defined schema for CritiqueReport, so that validation findings are structured and actionable.

#### Acceptance Criteria

1. THE CritiqueReport schema SHALL include arrays for criticalIssues, warnings, and suggestions
2. WHEN the Independent_Critic identifies an issue, THE CritiqueReport SHALL include the affected field path in JSONPath format
3. THE CritiqueReport schema SHALL include a description field explaining each identified issue
4. THE CritiqueReport schema SHALL include a recommendation field for each issue suggesting how to fix it
5. THE CritiqueReport schema SHALL include an overallAssessment field summarizing specification quality
6. THE CritiqueReport schema SHALL include a passesValidation boolean indicating if the specification is acceptable as-is
7. THE CritiqueReport schema SHALL be validated using Zod before being passed to the Repair_Service
8. THE CritiqueReport schema SHALL support serialization to JSON for audit logging

### Requirement 18: Planning Run Tracking

**User Story:** As a platform engineer, I want planning executions to be tracked with metadata, so that I can monitor performance and debug failures.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL create a Planning_Run record at the start of each planning operation
2. THE Planning_Run record SHALL include fields for projectId, userId, startedAt, completedAt, status, and stageResults
3. WHEN each planning stage completes, THE Planning_Pipeline SHALL record the stage name, duration, model used, and outcome
4. THE Planning_Run record SHALL track total AI tokens consumed across all planning stages
5. WHEN planning fails, THE Planning_Run record SHALL capture the failing stage, error message, and retry attempts
6. THE Planning_Run record SHALL be stored in the database with a retention policy of 90 days
7. THE Planning_Pipeline SHALL expose Planning_Run records via an admin API for monitoring
8. THE Planning_Pipeline SHALL aggregate Planning_Run metrics for performance monitoring dashboards

### Requirement 19: Model Configuration

**User Story:** As a DevOps engineer, I want AI model selection to be configurable via environment variables, so that I can optimize for cost, quality, or speed without code changes.

#### Acceptance Criteria

1. THE Model_Registry SHALL read model configurations from environment variables at startup
2. THE Model_Registry SHALL support separate environment variables for PLANNER_MODEL, RESEARCH_MODEL, CRITIC_MODEL, and REPAIR_MODEL
3. WHEN a stage-specific model is not configured, THE Model_Registry SHALL fall back to the OPENROUTER_MODEL value
4. THE Model_Registry SHALL support configuring fallback models via PLANNER_FALLBACK_MODEL environment variables
5. THE Model_Registry SHALL validate model names against OpenRouter's available models at startup
6. THE Model_Registry SHALL support model strategy presets (cost_optimized, quality_optimized, speed_optimized) via PLANNING_STRATEGY
7. WHEN an invalid model name is configured, THE Model_Registry SHALL log a warning and use OpenRouter auto selection
8. THE Model_Registry SHALL expose current model configuration via an admin health check endpoint

### Requirement 20: Sanitization and Stack Enforcement

**User Story:** As a Totalum integration engineer, I want generated specifications to be automatically sanitized for stack compatibility, so that no unsupported technologies reach the builder.

#### Acceptance Criteria

1. THE Sanitizer SHALL scan all text fields in ApplicationSpecification for unsupported technology references
2. WHEN PostgreSQL, MongoDB, MySQL, or SQLite are mentioned, THE Sanitizer SHALL replace them with "Totalum SDK database"
3. WHEN Prisma, Mongoose, Sequelize, TypeORM, or Drizzle are mentioned, THE Sanitizer SHALL replace them with "Totalum SDK"
4. WHEN Express, Fastify, or NestJS are mentioned, THE Sanitizer SHALL replace them with "Next.js API routes"
5. THE Sanitizer SHALL scan suggestedFeatures descriptions, backendRequirements, integrations, designDirection, and additionalInstructions
6. THE Sanitizer SHALL log each sanitization action with the original text and replacement
7. THE Sanitizer SHALL set a sanitized flag on the ApplicationSpecification when changes are made
8. THE Sanitizer SHALL complete sanitization within 5 seconds regardless of specification size

### Requirement 21: Performance Requirements

**User Story:** As a product manager, I want planning pipeline execution to complete quickly, so that users don't abandon projects due to slow processing.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL complete Idea Mode planning (understanding → research → planning → critique → repair) within 180 seconds under normal load
2. THE Planning_Pipeline SHALL complete Website Mode planning (existing understanding → research → planning → critique → repair) within 150 seconds under normal load
3. THE Planning_Pipeline SHALL execute planning stages in parallel when dependencies allow
4. WHEN Research_Agent fails or times out, THE Planning_Pipeline SHALL proceed without research findings rather than waiting indefinitely
5. THE Planning_Pipeline SHALL set timeout limits of 60 seconds for planning stages and 30 seconds for validation stages
6. THE Planning_Pipeline SHALL use streaming responses for AI generation when supported by the model
7. THE Planning_Pipeline SHALL cache IdeaUnderstanding and ResearchFindings for 1 hour to support user specification edits
8. THE Planning_Pipeline SHALL process up to 10 concurrent planning operations without performance degradation

### Requirement 22: Parser and Round-Trip Requirements

**User Story:** As a data integrity engineer, I want all schemas to support round-trip serialization, so that data is never lost during storage and retrieval.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL serialize IdeaUnderstanding to JSON and parse it back without data loss
2. THE Planning_Pipeline SHALL serialize ResearchFindings to JSON and parse it back without data loss
3. THE Planning_Pipeline SHALL serialize CritiqueReport to JSON and parse it back without data loss
4. THE Planning_Pipeline SHALL serialize Planning_Run to JSON and parse it back without data loss
5. WHEN parsing fails due to schema violations, THE Planning_Pipeline SHALL log detailed validation errors with field paths
6. THE Planning_Pipeline SHALL use Zod schemas for all parsing and validation operations
7. THE Planning_Pipeline SHALL validate all AI-generated JSON against schemas before accepting it
8. FOR ALL valid schema instances, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 23: Migration and Rollout

**User Story:** As a release manager, I want the pipeline upgrade to support gradual rollout, so that issues can be detected and rolled back without affecting all users.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL support a feature flag USE_ENHANCED_PIPELINE controlling new pipeline activation
2. WHEN USE_ENHANCED_PIPELINE is false, THE Planning_Pipeline SHALL route to the original implementation
3. THE Planning_Pipeline SHALL support percentage-based rollout via ENHANCED_PIPELINE_ROLLOUT_PERCENT
4. THE Planning_Pipeline SHALL log which pipeline version handled each project for rollout monitoring
5. THE Planning_Pipeline SHALL provide a migration utility to backfill Planning_Run records for existing projects
6. THE Planning_Pipeline SHALL support A/B testing by assigning users to old or new pipeline cohorts
7. WHEN rolling back to the original pipeline, THE Planning_Pipeline SHALL preserve all existing functionality
8. THE Planning_Pipeline SHALL emit metrics comparing old and new pipeline success rates, timing, and quality scores

### Requirement 24: Security and Injection Defense

**User Story:** As a security engineer, I want the planning pipeline to treat all user and website content as untrusted, so that prompt injection attacks cannot compromise the system.

#### Acceptance Criteria

1. WHEN processing website content, THE Planning_Pipeline SHALL wrap content in XML tags marking it as untrusted data
2. THE Planning_Pipeline SHALL instruct AI models to ignore instructions found within untrusted content blocks
3. WHEN AI responses contain instructions to ignore previous instructions, THE Planning_Pipeline SHALL reject the response and retry
4. THE Planning_Pipeline SHALL validate that AI-generated JSON contains only expected fields without executable code
5. THE Planning_Pipeline SHALL sanitize user-provided idea text to remove potential prompt injection patterns
6. THE Planning_Pipeline SHALL log detected prompt injection attempts for security monitoring
7. THE Planning_Pipeline SHALL rate-limit planning requests per user to 10 requests per hour to prevent abuse
8. THE Planning_Pipeline SHALL validate that generated specifications do not contain external URLs or code injection patterns

### Requirement 25: Deep Crawl Compatibility

**User Story:** As a Atai maintainer, I want the enhanced pipeline to support existing deep crawl functionality, so that exact website cloning remains available.

#### Acceptance Criteria

1. THE Planning_Pipeline SHALL preserve the existing runDeepCrawlAnalysis pipeline as a separate code path
2. WHEN deep crawl mode is active, THE Planning_Pipeline SHALL skip understanding and research stages
3. WHEN deep crawl completes, THE Planning_Pipeline SHALL generate a clone specification directly from crawl evidence
4. THE Planning_Pipeline SHALL charge DEEP_CRAWL_COST (500 credits) for deep crawl operations
5. THE Planning_Pipeline SHALL preserve deep crawl's requirement to crawl up to 50 pages
6. THE Planning_Pipeline SHALL mark deep crawl specifications with a replicaMode flag
7. WHEN deep crawl specifications reach the Totalum builder, THE Planning_Pipeline SHALL include instructions for exact replication
8. THE Planning_Pipeline SHALL log deep crawl operations separately from standard planning operations

