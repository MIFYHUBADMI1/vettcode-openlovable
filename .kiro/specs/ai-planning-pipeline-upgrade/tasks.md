# Implementation Plan: AI Planning Pipeline Upgrade

## Overview

This implementation plan transforms the existing single-pass planning pipeline into a comprehensive multi-stage validated architecture. The upgrade introduces explicit understanding stages for both Idea and Website modes, adaptive research analysis, independent critique validation, and automated repair—all while maintaining 100% backward compatibility with existing Totalum builder integrations.

The implementation uses **TypeScript** throughout, leveraging the existing Next.js/React stack with Zod for schema validation, OpenRouter for AI model orchestration, and MongoDB for persistence.

## Tasks

- [x] 1. Define core data schemas and type system
  - Create Zod schemas for IdeaUnderstanding, ResearchFindings, CritiqueReport, and Planning_Run
  - Ensure all schemas support round-trip serialization
  - Add schema validation utilities
  - _Requirements: 15.1-15.8, 16.1-16.8, 17.1-17.8, 18.1-18.8, 22.1-22.8_
  - _Design: Data Models section, IdeaUnderstanding Schema, ResearchFindings Schema, CritiqueReport Schema_

- [x] 2. Implement IdeaUnderstanding schema and parser
  - [x] 2.1 Create lib/types/idea-understanding.ts with complete Zod schema
    - Define ConfidenceLevelSchema ('explicit' | 'inferred')
    - Define IdeaDataEntitySchema with confidence tagging
    - Define IdeaUserFlowSchema with steps and confidence
    - Define IdeaUnderstandingSchema with all required fields
    - Export TypeScript types from schemas
    - _Requirements: 15.1, 15.2, 15.3, 15.7_
    - _Design: IdeaUnderstanding Schema section_
  
  - [x] 2.2 Add round-trip serialization tests
    - Test JSON serialization and parsing preserves all data
    - Test schema validation catches invalid inputs
    - Test confidence level constraints
    - _Requirements: 22.1, 22.8_
    - _Design: Round-Trip Testing section_
  
  - [x] 2.3 Create parser utility for AI-generated IdeaUnderstanding JSON
    - Extract JSON from markdown code fences
    - Handle raw JSON without fences
    - Validate against schema with detailed error messages
    - _Requirements: 22.6, 22.7_
    - _Design: IdeaUnderstandingService implementation_
    - _Note: Implemented in IdeaUnderstandingService.extractJson() and parseAIResponse() methods_

- [x] 3. Implement ResearchFindings schema and utilities
  - [x] 3.1 Create lib/types/research-findings.ts with Zod schemas
    - Define SeverityLevelSchema ('critical' | 'warning' | 'info')
    - Define ProductGapSchema, SecurityGapSchema, UXGapSchema, TechnicalRiskSchema
    - Define ResearchFindingsSchema with all categories
    - Add completenessScore field (0-100)
    - _Requirements: 16.1, 16.2, 16.5_
    - _Design: ResearchFindings Schema section_
  
  - [x] 3.2 Implement completeness score calculator
    - Calculate score based on severity and count of issues
    - Deduct 20 for each critical security concern
    - Deduct 15 for each critical feature gap
    - Deduct 10 for each critical UX gap
    - Return value between 0-100
    - _Requirements: 16.5_
    - _Design: Completeness Score Algorithm_
  
  - [ ] 3.3 Add round-trip serialization tests
    - Test JSON serialization preserves all findings
    - Test completeness score calculation
    - Test schema validation
    - _Requirements: 22.2, 22.8_

- [x] 4. Implement CritiqueReport schema and utilities
  - [x] 4.1 Create lib/types/critique-report.ts with Zod schemas
    - Define IssueSchema with fieldPath (JSONPath), issueType, severity
    - Define CritiqueReportSchema with criticalIssues, warnings, suggestions
    - Add qualityScore field (0-100)
    - Add passesValidation boolean
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.6_
    - _Design: CritiqueReport Schema section_
  
  - [x] 4.2 Implement quality score calculator
    - Calculate based on issue counts and severity
    - Deduct 20 per critical issue, 5 per warning, 1 per suggestion
    - Return value between 0-100
    - _Requirements: 17.1_
    - _Design: Quality Score Calculation_
  
  - [ ] 4.3 Add round-trip serialization tests
    - Test schema validation
    - Test quality score calculation
    - Test JSONPath field references
    - _Requirements: 22.3, 22.8_

- [x] 5. Implement Planning_Run tracking schema and database operations
  - [x] 5.1 Create lib/types/planning-run.ts with Zod schema
    - Define PipelineStage type
    - Define StageResult interface with timing and model info
    - Define PlanningRunSchema with all tracking fields
    - Add status enum ('running' | 'completed' | 'failed')
    - _Requirements: 18.1, 18.2, 18.3, 18.4_
    - _Design: Planning_Run Schema section_
  
  - [x] 5.2 Create MongoDB collection and indexes
    - Add planning_runs collection to database
    - Create index on projectId
    - Create index on userId + startedAt (descending)
    - Create TTL index on createdAt (90 days expiry)
    - _Requirements: 18.6_
    - _Design: Database Collections section_
  
  - [ ] 5.3 Add round-trip serialization tests
    - Test schema validation
    - Test all status transitions
    - Test stage result tracking
    - _Requirements: 22.4, 22.8_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement ModelRegistry for AI model configuration
  - [x] 7.1 Create lib/planning/models/registry.ts
    - Define ModelConfig interface (primary, fallbacks, maxTokens, temperature)
    - Define ModelConfiguration interface for all stages
    - Implement getModelForStage method
    - Implement getFallbackModel method
    - _Requirements: 7.1, 19.1_
    - _Design: ModelRegistry component section_
  
  - [x] 7.2 Add environment variable configuration loading
    - Read PLANNER_MODEL, RESEARCH_MODEL, CRITIC_MODEL, REPAIR_MODEL
    - Read PLANNER_FALLBACK_MODEL for each stage
    - Fall back to OPENROUTER_MODEL if stage-specific not set
    - Support PLANNING_STRATEGY preset selection
    - _Requirements: 19.2, 19.3, 19.4, 19.6_
    - _Design: Environment Variable Mapping section_
  
  - [x] 7.3 Implement strategy presets
    - cost_optimized: Use faster/cheaper models
    - quality_optimized: Use highest quality models
    - speed_optimized: Balance speed and quality
    - _Requirements: 19.6, 7.6_
    - _Design: ModelRegistry Configuration Structure_
  
  - [ ] 7.4 Write unit tests for ModelRegistry
    - Test environment variable parsing
    - Test fallback model selection
    - Test strategy preset application
    - Test invalid model handling
    - _Requirements: 14.3, 19.7_

- [x] 8. Implement PlanningRunTracker service
  - [x] 8.1 Create lib/planning/tracking/planning-run.ts
    - Implement startRun method
    - Implement recordStageCompletion method
    - Implement completeRun method
    - Implement failRun method
    - _Requirements: 18.1, 18.2, 18.5_
    - _Design: PlanningRunTracker component section_
  
  - [x] 8.2 Add database persistence layer
    - Create PlanningRunDocument interface
    - Implement save/update operations
    - Implement query operations (getByProjectId, getByUserId)
    - _Requirements: 18.6_
    - _Design: Database Collections section_
  
  - [x] 8.3 Add stage result tracking
    - Record model used, tokens consumed, duration
    - Track retry attempts
    - Record success/failure status
    - _Requirements: 18.3, 18.4_
  
  - [ ] 8.4 Write unit tests for PlanningRunTracker
    - Test run lifecycle tracking
    - Test stage result recording
    - Test failure capture
    - _Requirements: 14.1_

- [x] 9. Implement retry logic and error handling utilities
  - [x] 9.1 Create lib/planning/utils/retry.ts
    - Implement ErrorType enum (retryable, non_retryable, fatal)
    - Implement classifyError function
    - Implement executeWithRetry with exponential backoff
    - Add timeout handling
    - _Requirements: 11.1, 11.2_
    - _Design: Error Handling Flow, Retry Strategy_
  
  - [x] 9.2 Create error taxonomy classes
    - PipelineError base class
    - UnderstandingError, ResearchError, PlanningError
    - ValidationError with field details
    - CreditInsufficientError
    - _Requirements: 11.3_
    - _Design: Error Taxonomy section_
  
  - [ ] 9.3 Write unit tests for retry logic
    - Test exponential backoff calculation
    - Test error classification
    - Test max retry limit enforcement
    - Test fatal error immediate failure
    - _Requirements: 14.3_

- [x] 10. Implement CircuitBreaker for external service resilience
  - [x] 10.1 Create lib/planning/utils/circuit-breaker.ts
    - Implement CircuitBreaker class with state machine
    - Track failure/success counts
    - Implement state transitions (closed → open → half-open)
    - Add timeout configuration
    - _Requirements: 11.6_
    - _Design: Circuit Breaker Pattern section_
  
  - [x] 10.2 Create circuit breakers for external services
    - firecrawlCircuitBreaker (5 failures, 60s timeout)
    - openrouterCircuitBreaker (5 failures, 30s timeout)
    - _Requirements: 11.6_
  
  - [ ] 10.3 Write unit tests for CircuitBreaker
    - Test state transitions
    - Test failure threshold triggering
    - Test timeout and recovery
    - _Requirements: 14.3_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement IdeaUnderstandingService
  - [x] 12.1 Create lib/planning/stages/idea-understanding.ts
    - Implement generateUnderstanding method
    - Create system prompt distinguishing explicit vs inferred
    - Add minimum idea length validation (50 characters)
    - Use ModelRegistry for model selection
    - _Requirements: 1.1, 1.2, 1.3, 1.7_
    - _Design: IdeaUnderstandingService implementation_
  
  - [x] 12.2 Implement AI prompt and response parsing
    - Wrap user idea in XML tags
    - Extract JSON from AI response (code fences or raw)
    - Parse and validate with IdeaUnderstandingSchema
    - Add metadata (createdAt, modelUsed)
    - _Requirements: 1.2, 15.7_
    - _Design: IdeaUnderstandingService code example_
  
  - [x] 12.3 Add retry logic with model fallbacks
    - Use executeWithRetry wrapper
    - Switch to fallback model on retryable errors
    - Maximum 3 retry attempts
    - _Requirements: 1.5, 7.2_
    - _Design: Model Fallback Integration_
  
  - [ ] 12.4 Write unit tests for IdeaUnderstandingService
    - Test valid idea parsing
    - Test minimum length rejection
    - Test confidence level tagging
    - Test retry on rate limits
    - _Requirements: 14.1_
    - _Design: Unit Testing section, IdeaUnderstandingService tests_

- [x] 13. Implement ResearchAgent
  - [x] 13.1 Create lib/planning/stages/research.ts
    - Implement analyzeForGaps method accepting IdeaUnderstanding or ProjectUnderstanding
    - Create system prompt for gap analysis
    - Implement completeness score calculation
    - Add getEmptyFindings method for failure fallback
    - _Requirements: 2.1, 2.2, 2.5, 16.5_
    - _Design: ResearchAgent component section_
  
  - [x] 13.2 Implement gap analysis categories
    - Product completeness (missing features, incomplete flows)
    - Security concerns (auth, validation, authorization)
    - UX gaps (error states, loading, navigation)
    - Technical risks (stack violations, conflicts)
    - _Requirements: 2.2, 2.3, 2.4_
    - _Design: ResearchAgent Analysis Categories_
  
  - [x] 13.3 Add technology stack violation detection
    - Scan for PostgreSQL, MySQL, MongoDB, SQLite
    - Scan for Prisma, Mongoose, Sequelize, TypeORM
    - Flag as technicalRisks with 'stack_violation' category
    - Recommend Totalum SDK alternatives
    - _Requirements: 2.6_
    - _Design: Technology Stack Violation Detection_
  
  - [ ] 13.4 Write unit tests for ResearchAgent
    - Test gap identification for minimal understanding
    - Test security concern flagging
    - Test technology stack violation detection
    - Test completeness score calculation
    - Test empty findings fallback
    - _Requirements: 14.1_
    - _Design: Unit Testing section, ResearchAgent tests_

- [x] 14. Implement PrimaryPlanner
  - [x] 14.1 Create lib/planning/stages/planner.ts
    - Implement planApplication method
    - Accept IdeaUnderstanding or ProjectUnderstanding + ResearchFindings
    - Merge understanding and research into unified planning context
    - Generate ApplicationSpecification
    - _Requirements: 3.1, 3.2, 3.3_
    - _Design: PrimaryPlanner component section_
  
  - [x] 14.2 Implement planning context construction
    - Extract purpose, features, entities from understanding
    - Merge research findings (gaps, recommendations)
    - Add Totalum stack constraints
    - Build comprehensive prompt
    - _Requirements: 3.3, 3.5_
    - _Design: Planning Context Construction_
  
  - [x] 14.3 Enforce Totalum technology stack
    - System prompt enforces React, Next.js, Tailwind, Totalum SDK only
    - Reject references to external databases and ORMs
    - Ensure only Next.js API routes for backend
    - _Requirements: 3.4, 10.1_
    - _Design: Totalum Stack Enforcement_
  
  - [ ] 14.4 Write unit tests for PrimaryPlanner
    - Test planning from IdeaUnderstanding
    - Test planning from ProjectUnderstanding
    - Test research findings integration
    - Test stack constraint enforcement
    - _Requirements: 14.1_

- [x] 15. Implement IndependentCritic
  - [x] 15.1 Create lib/planning/stages/critic.ts
    - Implement critique method (validation only, no modification)
    - Check for missing core flows
    - Check for undefined data entities
    - Check for inconsistent user roles
    - Generate CritiqueReport
    - _Requirements: 4.1, 4.2_
    - _Design: IndependentCritic component section_
  
  - [x] 15.2 Implement data entity referential integrity check
    - Scan coreFlows for entity references
    - Verify all referenced entities exist in dataEntities array
    - Flag missing entities as critical issues
    - _Requirements: 4.4, 6.2_
    - _Design: Data Entity Referential Integrity_
  
  - [x] 15.3 Implement authentication consistency check
    - Check if auth features are enabled
    - Verify authenticationRequirements is defined
    - Flag inconsistency if enabled auth but no requirements
    - _Requirements: 4.3, 6.3_
    - _Design: Authentication Consistency_
  
  - [x] 15.4 Implement technology stack violation check
    - Scan all text fields for unsupported technologies
    - Flag PostgreSQL, Prisma, Express, etc. as critical violations
    - Provide Totalum SDK alternatives in recommendations
    - _Requirements: 4.7, 6.1_
    - _Design: Technology Stack Violation Detection_
  
  - [x] 15.5 Add quality score calculation
    - Calculate based on issue severity and count
    - Set passesValidation based on critical issue count
    - _Requirements: 17.1, 17.6_
  
  - [ ] 15.6 Write unit tests for IndependentCritic
    - Test undefined entity detection
    - Test technology stack violation detection
    - Test authentication consistency check
    - Test validation pass for well-formed specs
    - _Requirements: 14.1_
    - _Design: Unit Testing section, IndependentCritic tests_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implement RepairService
  - [x] 17.1 Create lib/planning/stages/repair.ts
    - Implement repair method accepting spec + CritiqueReport
    - Address only issues explicitly flagged in critique
    - Preserve all user-provided content
    - Return repaired ApplicationSpecification
    - _Requirements: 5.1, 5.2, 5.3_
    - _Design: RepairService component section_
  
  - [x] 17.2 Implement missing data entity repair
    - Parse criticalIssues for 'missing_definition' type
    - Add missing entities with inferred fields
    - Log all additions
    - _Requirements: 5.4_
    - _Design: RepairService repair operations_
  
  - [x] 17.3 Implement role inconsistency repair
    - Fix user role references in flows
    - Add missing roles to userRoles array
    - _Requirements: 5.4_
  
  - [x] 17.4 Implement authentication consistency repair
    - Complete missing authenticationRequirements when auth enabled
    - Add default providers if needed
    - _Requirements: 5.4_
  
  - [x] 17.5 Set new features as disabled by default
    - When adding features, set enabled: false
    - _Requirements: 5.5_
  
  - [x] 17.6 Add repair audit logging
    - Log every change with before/after values
    - Track which issues were addressed
    - _Requirements: 5.6_
  
  - [ ] 17.7 Write unit tests for RepairService
    - Test missing entity addition
    - Test user content preservation
    - Test new features default to disabled
    - Test audit trail logging
    - _Requirements: 14.1_
    - _Design: Unit Testing section, RepairService tests_

- [x] 18. Implement SemanticValidator
  - [x] 18.1 Create lib/planning/stages/validator.ts
    - Implement validate method returning ValidationResult
    - Check entity references in flows
    - Check circular dependencies
    - Check role references
    - Return detailed errors with field paths
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.7_
    - _Design: SemanticValidator component section_
  
  - [x] 18.2 Implement entity reference validation
    - Scan coreFlows, suggestedFeatures, backendRequirements
    - Verify all entity names exist in dataEntities
    - Return ValidationError with JSONPath for each missing reference
    - _Requirements: 6.2, 6.7_
  
  - [x] 18.3 Implement circular dependency detection
    - Build dependency graph from entity relationships
    - Detect cycles using depth-first search
    - Report cycle path in error message
    - _Requirements: 6.5_
  
  - [x] 18.4 Implement role reference validation
    - Verify role references in flows exist in userRoles array
    - _Requirements: 6.4_
  
  - [x] 18.5 Implement authentication consistency validation
    - Check enabled auth features match authenticationRequirements
    - _Requirements: 6.3_
  
  - [ ] 18.6 Write unit tests for SemanticValidator
    - Test entity reference validation
    - Test circular dependency detection
    - Test role reference validation
    - Test validation passes for consistent specs
    - _Requirements: 14.1_
    - _Design: Unit Testing section, SemanticValidator tests_

- [x] 19. Implement Sanitizer for technology stack enforcement
  - [x] 19.1 Create lib/planning/utils/sanitizer.ts
    - Implement sanitize method accepting ApplicationSpecification
    - Scan all text fields for unsupported tech
    - Replace with Totalum SDK equivalents
    - Return SanitizationResult with sanitized spec and flag
    - _Requirements: 20.1, 20.2_
    - _Design: Sanitizer component section_
  
  - [x] 19.2 Define replacement rules
    - PostgreSQL/MySQL/MongoDB/SQLite → "Totalum SDK database"
    - Prisma/Mongoose/Sequelize/TypeORM → "Totalum SDK"
    - Express/Fastify/NestJS → "Next.js API routes"
    - Firebase/Supabase → "Totalum SDK"
    - _Requirements: 20.2, 20.3, 20.4_
    - _Design: Replacement Rules_
  
  - [x] 19.3 Scan all relevant text fields
    - backendRequirements, integrations, designDirection
    - additionalInstructions, suggestedFeatures descriptions
    - _Requirements: 20.5_
  
  - [x] 19.4 Add sanitization logging
    - Log every replacement with original and new text
    - Set sanitized flag to true when changes made
    - _Requirements: 20.6, 20.7_
  
  - [ ] 19.5 Write unit tests for Sanitizer
    - Test PostgreSQL → Totalum SDK database replacement
    - Test Prisma → Totalum SDK replacement
    - Test multiple replacements in same text
    - Test case-insensitive matching
    - Test no changes when already compliant
    - _Requirements: 14.1_
    - _Design: Unit Testing section, Sanitizer tests_

- [ ] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Implement PlanningOrchestrator
  - [x] 21.1 Create lib/planning/orchestrator.ts
    - Define PlanningOrchestrator class
    - Inject all stage dependencies (IdeaService, Research, Planner, etc.)
    - Implement executeIdeaPipeline method
    - Implement executeWebsitePipeline method
    - _Requirements: 1.1, 3.1, 9.1_
    - _Design: PlanningOrchestrator component section_
  
  - [x] 21.2 Implement Idea Mode pipeline flow
    - Validate minimum idea length (50 chars)
    - Reserve PLAN_COST credits
    - Create Planning_Run record
    - Execute IdeaUnderstanding stage
    - Execute Research stage (optional - continue on failure)
    - Execute Planning stage
    - Execute Critique stage
    - Execute Repair stage (if needed)
    - Execute SemanticValidator
    - Execute Sanitizer
    - Save specification and consume credits
    - _Requirements: 1.1, 1.4, 1.7, 2.8, 3.1_
    - _Design: Idea Mode Flow sequence diagram_
  
  - [x] 21.3 Implement Website Mode pipeline flow
    - Accept existing ProjectUnderstanding
    - Reserve PLAN_COST credits
    - Create Planning_Run record
    - Skip to Research stage
    - Execute Planning, Critique, Repair, Validation, Sanitization
    - Save specification and consume credits
    - _Requirements: 3.1, 8.1_
    - _Design: Website Mode Flow sequence diagram_
  
  - [x] 21.4 Implement stage execution with tracking
    - Wrap each stage in executeStage helper
    - Record start/end time, model used, tokens
    - Handle retries with model fallbacks
    - Update Planning_Run after each stage
    - _Requirements: 3.6, 18.2_
  
  - [x] 21.5 Implement error handling and cleanup
    - Catch stage failures
    - Preserve partial results (Understanding, Research)
    - Refund credits on fatal errors
    - Update project state with error messages
    - Complete Planning_Run with failure status
    - _Requirements: 11.1, 11.3, 11.4, 12.5_
    - _Design: Error Handling Flow, handlePipelineFailure_
  
  - [x] 21.6 Add project state updates
    - Update state to 'analyzing' at start
    - Update state to 'specification_ready' on completion
    - Append project events for user visibility
    - _Requirements: 9.2_
  
  - [ ] 21.7 Write integration tests for PlanningOrchestrator
    - Test complete Idea Mode pipeline
    - Test complete Website Mode pipeline
    - Test research stage failure handling
    - Test credit insufficiency handling
    - Test retry on rate limits
    - _Requirements: 14.2_
    - _Design: Integration Testing section_

- [x] 22. Implement backward compatibility layer
  - [x] 22.1 Modify lib/analysis/specification.ts
    - Add USE_ENHANCED_PIPELINE feature flag
    - Add ENHANCED_PIPELINE_ROLLOUT_PERCENT flag
    - Implement shouldUseEnhancedPipeline function
    - Route generateSpecificationFromIdea to new pipeline when enabled
    - Route generateSpecificationFromUnderstanding to new pipeline when enabled
    - _Requirements: 9.3, 9.7, 23.1, 23.2_
    - _Design: Backward Compatibility Layer section_
  
  - [x] 22.2 Implement percentage-based rollout
    - Hash userId to determine cohort assignment
    - Compare hash % 100 to rollout percentage
    - Log which pipeline version is used
    - _Requirements: 23.3, 23.4_
  
  - [x] 22.3 Preserve existing function signatures
    - Keep generateSpecificationFromIdea signature unchanged
    - Keep generateSpecificationFromUnderstanding signature unchanged
    - Return ApplicationSpecification matching existing schema
    - _Requirements: 9.1, 9.3_
  
  - [ ] 22.4 Write backward compatibility tests
    - Test routing to enhanced pipeline when enabled
    - Test routing to legacy pipeline when disabled
    - Test percentage-based rollout assignment
    - Test existing API signatures maintained
    - Test schema compatibility
    - _Requirements: 14.5_
    - _Design: Backward Compatibility tests_

- [x] 23. Add security and prompt injection defense
  - [x] 23.1 Create lib/planning/utils/security.ts
    - Implement wrapUntrustedContent function
    - Add XML tags marking content as untrusted
    - Include instructions to AI to ignore embedded instructions
    - _Requirements: 24.1, 24.2_
    - _Design: Prompt Injection Defense_
  
  - [x] 23.2 Implement AI output validation
    - Scan for suspicious patterns (ignore previous instructions, etc.)
    - Reject responses containing injection attempts
    - Log detected injection attempts
    - _Requirements: 24.3, 24.6_
    - _Design: Output Validation_
  
  - [x] 23.3 Implement input sanitization
    - Remove potential XSS vectors from user input
    - Limit input length to MAX_LENGTH
    - _Requirements: 24.5_
    - _Design: Data Sanitization_
  
  - [x] 23.4 Implement rate limiting check
    - Check planning requests per user per hour (max 10)
    - Check planning requests per user per day (max 50)
    - Reject if limits exceeded
    - _Requirements: 24.7_
    - _Design: Rate Limiting_
  
  - [ ] 23.5 Write security tests
    - Test prompt injection detection
    - Test untrusted content wrapping
    - Test rate limit enforcement
    - _Requirements: 14.7_

- [ ] 24. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 25. Add complexity classification integration
  - [x] 25.1 Integrate existing ComplexityClassifier
    - Call classifyComplexity after sanitization
    - Add complexity field to ApplicationSpecification
    - _Requirements: 10.7_
  
  - [ ] 25.2 Write tests for complexity integration
    - Test complexity assigned to final spec
    - Test all complexity tiers (simple, medium, complex)

- [x] 26. Implement deep crawl compatibility
  - [x] 26.1 Add executeDeepCrawlPipeline method to orchestrator
    - Skip understanding and research stages
    - Generate clone specification directly
    - Set replicaMode flag
    - Charge DEEP_CRAWL_COST
    - _Requirements: 25.1, 25.2, 25.3, 25.4_
  
  - [ ] 26.2 Write tests for deep crawl pipeline
    - Test direct spec generation from evidence
    - Test replicaMode flag set
    - Test DEEP_CRAWL_COST charged
    - _Requirements: 25.7_

- [x] 27. Add admin monitoring and observability
  - [x] 27.1 Create admin API endpoint for Planning_Run queries
    - GET /api/admin/planning-runs?userId=X
    - GET /api/admin/planning-runs/:runId
    - Return Planning_Run with stage details
    - _Requirements: 18.7_
  
  - [x] 27.2 Add health check endpoint
    - GET /api/health/planning
    - Check OpenRouter connectivity
    - Check database connectivity
    - Report circuit breaker states
    - Report model configuration
    - Return metrics (active pipelines, success rate, avg duration)
    - _Requirements: 13.1-13.8_
    - _Design: Health Checks section_
  
  - [x] 27.3 Implement structured logging
    - Log entry/exit for each stage with timing
    - Log model selection and fallback triggers
    - Log sanitization actions
    - Log validation failures with field paths
    - Never log sensitive data or full prompts
    - _Requirements: 13.1-13.7_
    - _Design: Logging Standards_

- [ ] 28. Add comprehensive unit tests for all components
  - [ ] 28.1 Write schema validation tests
    - Test all Zod schemas accept valid inputs
    - Test schemas reject invalid inputs
    - Test round-trip serialization for all schemas
    - _Requirements: 14.1, 22.1-22.8_
  
  - [ ] 28.2 Write model registry tests
    - Test environment variable loading
    - Test fallback model selection
    - Test strategy preset application
    - _Requirements: 14.3_
  
  - [ ] 28.3 Write retry logic tests
    - Test exponential backoff
    - Test error classification
    - Test max retries enforced
    - _Requirements: 14.3_
  
  - [ ] 28.4 Write circuit breaker tests
    - Test state transitions
    - Test failure threshold
    - Test recovery after timeout
    - _Requirements: 14.3_

- [ ] 29. Add integration tests for complete pipelines
  - [ ] 29.1 Write Idea Mode end-to-end test
    - Test complete pipeline from idea to specification
    - Verify all stages execute in order
    - Verify project state transitions
    - Verify credits consumed correctly
    - _Requirements: 14.2_
  
  - [ ] 29.2 Write Website Mode end-to-end test
    - Test complete pipeline from understanding to specification
    - Verify research stage integration
    - Verify final spec matches schema
    - _Requirements: 14.2_
  
  - [ ] 29.3 Write failure scenario tests
    - Test research stage failure graceful handling
    - Test planning stage retry on rate limit
    - Test credit insufficiency early termination
    - Test validation failure handling
    - _Requirements: 14.2_
  
  - [ ] 29.4 Write model fallback integration test
    - Mock primary model failure
    - Verify fallback model used
    - Verify Planning_Run tracks model switch
    - _Requirements: 14.3_
  
  - [ ] 29.5 Write backward compatibility integration test
    - Test old API functions still work
    - Test schema compatibility with existing code
    - Test credit charging behavior unchanged
    - _Requirements: 14.5_

- [ ] 30. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 31. Create migration utilities
  - [ ] 31.1 Create migration script for Planning_Run backfill
    - Query all existing projects with specifications
    - Create synthetic Planning_Run records
    - Mark as legacy: true in outcome
    - _Requirements: 23.5_
    - _Design: Migration Utilities section_
  
  - [ ] 31.2 Create database migration for new collections
    - Add planning_runs collection
    - Create required indexes
    - Set TTL for 90-day retention
    - _Requirements: 18.6_
  
  - [ ] 31.3 Add environment variable validation script
    - Check all required env vars present
    - Validate model names against OpenRouter
    - Report configuration issues
    - _Requirements: 19.5_

- [x] 32. Add rollout configuration and monitoring
  - [x] 32.1 Document environment variables
    - List all feature flags
    - List all model configuration vars
    - List all stage control flags
    - Provide recommended values for each environment
    - _Design: Environment Configuration section_
  
  - [x] 32.2 Create rollout metrics dashboard query
    - Query Planning_Run records for success rates
    - Compare enhanced vs legacy pipeline metrics
    - Report average duration by pipeline version
    - Report quality scores
    - _Requirements: 23.8_
    - _Design: Rollout Metrics section_
  
  - [x] 32.3 Document rollback procedures
    - Emergency rollback: Set USE_ENHANCED_PIPELINE=false
    - Partial rollback: Reduce ROLLOUT_PERCENT
    - Stage-specific disable flags
    - _Design: Rollback Plan section_

- [ ] 33. Create comprehensive documentation
  - [ ] 33.1 Document architecture and design decisions
    - Explain multi-stage pipeline rationale
    - Document schema design choices
    - Explain error handling strategy
    - Document model selection approach
  
  - [ ] 33.2 Create developer guide
    - How to add new pipeline stages
    - How to modify AI prompts
    - How to add new validation rules
    - How to test pipeline changes
  
  - [ ] 33.3 Create operations guide
    - Deployment procedures
    - Rollout strategy execution
    - Monitoring and alerting
    - Troubleshooting common issues
  
  - [ ] 33.4 Document API changes and migration
    - List all new exports
    - Document backward compatibility guarantees
    - Provide migration timeline
    - List deprecation schedule

- [ ] 34. Performance optimization and caching
  - [ ] 34.1 Implement Understanding/Research caching
    - Cache IdeaUnderstanding by idea hash (1 hour TTL)
    - Cache ResearchFindings by understanding hash (1 hour TTL)
    - Enable user to edit specs without re-running expensive stages
    - _Requirements: 21.7_
  
  - [ ] 34.2 Add streaming support for AI responses
    - Enable streaming for Planning stage when model supports it
    - Stream progress updates to client
    - _Requirements: 21.6_
  
  - [ ] 34.3 Write performance tests
    - Test concurrent pipeline execution (10 concurrent)
    - Test timeout enforcement
    - Test caching effectiveness
    - _Requirements: 21.8_

- [ ] 35. Final integration and deployment preparation
  - [ ] 35.1 Run full test suite
    - Execute all unit tests
    - Execute all integration tests
    - Verify all properties hold
    - Check code coverage (>85% target)
  
  - [ ] 35.2 Prepare deployment configuration
    - Set USE_ENHANCED_PIPELINE=false initially
    - Configure model selections for production
    - Set rollout percentage to 0
    - Configure monitoring and alerts
  
  - [ ] 35.3 Create deployment checklist
    - Database migrations
    - Environment variable updates
    - Feature flag configuration
    - Rollback procedures documented
    - Monitoring dashboards ready

- [ ] 36. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "7.1", "8.1", "9.1", "10.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "7.2", "7.3", "8.2", "9.2", "10.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.2", "4.3", "5.2", "5.3", "7.4", "8.3", "8.4", "9.3", "10.3"] },
    { "id": 3, "tasks": ["12.1", "13.1", "14.1", "15.1", "17.1", "18.1", "19.1"] },
    { "id": 4, "tasks": ["12.2", "13.2", "14.2", "15.2", "15.3", "15.4", "17.2", "17.3", "17.4", "18.2", "18.3", "18.4", "19.2", "19.3"] },
    { "id": 5, "tasks": ["12.3", "13.3", "14.3", "15.5", "17.5", "17.6", "18.5", "19.4"] },
    { "id": 6, "tasks": ["12.4", "13.4", "14.4", "15.6", "17.7", "18.6", "19.5"] },
    { "id": 7, "tasks": ["21.1", "23.1"] },
    { "id": 8, "tasks": ["21.2", "21.3", "21.4", "23.2", "23.3", "23.4"] },
    { "id": 9, "tasks": ["21.5", "21.6", "22.1", "23.5", "25.1"] },
    { "id": 10, "tasks": ["21.7", "22.2", "22.3", "25.2", "26.1"] },
    { "id": 11, "tasks": ["22.4", "26.2", "27.1", "27.2", "27.3"] },
    { "id": 12, "tasks": ["28.1", "28.2", "28.3", "28.4", "29.1", "29.2", "29.3", "29.4", "29.5"] },
    { "id": 13, "tasks": ["31.1", "31.2", "31.3", "32.1", "32.2", "32.3", "33.1", "33.2", "33.3", "33.4"] },
    { "id": 14, "tasks": ["34.1", "34.2", "34.3"] },
    { "id": 15, "tasks": ["35.1", "35.2", "35.3"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breaks
- The dependency graph enables parallel execution of independent tasks
- TypeScript is used throughout for type safety and IDE support
- All schemas use Zod for runtime validation
- OpenRouter handles AI model routing and fallbacks
- MongoDB stores all persistent data with appropriate indexes
- Backward compatibility is maintained through feature flags and routing layer
- Gradual rollout strategy minimizes risk during deployment
- Comprehensive testing ensures quality and correctness at every stage

This implementation plan transforms the planning pipeline while preserving all existing functionality and enabling safe, incremental deployment.





