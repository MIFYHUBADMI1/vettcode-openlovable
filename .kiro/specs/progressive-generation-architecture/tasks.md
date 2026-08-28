# Implementation Plan: Progressive Generation Architecture

## Overview

Replace the monolithic single-pass generation pipeline with a five-phase progressive pipeline: Analyze → Instant Preview → Progressive Cloning → Validate → Polish. The implementation builds on top of existing infrastructure (`SandboxProvider`, `sandboxManager`, `build-validator.ts`, `file-parser.ts`, `morph-fast-apply.ts`) and extends them rather than replacing them. All new code lives under `lib/pipeline/` with new API routes under `app/api/`.

---

## Tasks

- [x] 1. Scaffold pipeline directory structure and shared types
  - Create `lib/pipeline/` directory with subdirectories: `phases/`, `prompts/`, `types/`
  - Create `lib/pipeline/types/blueprint.ts` — define `SiteBlueprint`, `BlueprintSection`, `SectionType`, `ColorEntry`, `TypographyInfo`, `ImageEntry` interfaces as specified in the design
  - Create `lib/pipeline/types/pipeline.ts` — define `PhaseState`, `PhaseTransitionEvent`, `PhaseExecutionLog`, `PipelineContext`, `PipelineEvent`, `PipelineEventType`, `SectionStatus`, `SectionPriority`, `SectionResult`, `ProgressEvent`, and `QueuedEdit` types
  - Create `lib/pipeline/types/index.ts` re-exporting all types from the `types/` subdirectory
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 3.9_

- [x] 2. Implement BlueprintParser
  - [x] 2.1 Implement `lib/pipeline/blueprint-parser.ts` with `BlueprintParser.parse()`, `validate()`, and `normalize()` static methods
    - `parse()`: parse raw AI JSON response, validate required fields (`sections`, `colors`, `typography`, `images`), return `SiteBlueprint` or descriptive error string
    - `validate()`: type guard that checks all required fields are present and non-null using the JSON Schema defined in the design
    - `normalize()`: convert section names to lowercase-hyphenated form (e.g. `"Hero Section"` → `"hero-section"`)
    - Log the original AI response alongside any parse error
    - Return `"parsing failed"` generic string when the specific field cannot be determined
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6, 12.7_

  - [ ]\* 2.2 Write property test for BlueprintParser — Property 1: Blueprint required fields are always present
    - **Property 1: Blueprint required fields are always present**
    - Generate arbitrary valid blueprint JSON via fast-check arbitraries; assert `sections`, `colors`, `typography`, `images` are all present and non-null on parse output
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 12.2**

  - [ ]\* 2.3 Write property test for BlueprintParser — Property 2: Section types are always from the recognized set
    - **Property 2: Section types are always from the recognized set**
    - For any parsed `SiteBlueprint`, every section `type` is a non-empty string and every section `name` matches the lowercase-hyphen pattern `^[a-z][a-z0-9-]*$`
    - **Validates: Requirements 1.2, 12.6**

  - [ ]\* 2.4 Write property test for BlueprintParser — Property 3: Blueprint round-trip serialization
    - **Property 3: Blueprint round-trip serialization**
    - `BlueprintParser.parse(JSON.stringify(blueprint))` must produce an object structurally equal to the original
    - **Validates: Requirements 12.4, 14.5**

  - [ ]\* 2.5 Write unit tests for BlueprintParser
    - Valid JSON → correct structure; missing required field → descriptive error naming that field; `null` input → error; empty sections array → valid; completely invalid JSON → `"parsing failed"`
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 3. Implement PrettyPrinter
  - [x] 3.1 Implement `lib/pipeline/pretty-printer.ts` with `PrettyPrinter.format(blueprint: SiteBlueprint): string`
    - Output 2-space indented JSON
    - Section names in bulleted list format
    - Color palette as hex codes
    - Typography as readable table (font family, weights, sizes)
    - Escape all special characters in string values (quotes, angle brackets, backslashes)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.6_

  - [ ]\* 3.2 Write property test for PrettyPrinter — Property 4: Pretty printer output is valid JSON
    - **Property 4: Pretty printer output is valid JSON**
    - For any `SiteBlueprint`, `JSON.parse(PrettyPrinter.format(blueprint))` must produce an object equivalent to the original
    - **Validates: Requirements 14.1, 14.5**

  - [ ]\* 3.3 Write property test for PrettyPrinter — Property 5: Pretty printer escapes special characters
    - **Property 5: Pretty printer escapes special characters**
    - Generate blueprints with arbitrary special characters in section names and image alt texts; assert the formatter output is still parseable JSON
    - **Validates: Requirement 14.6**

  - [ ]\* 3.4 Write unit tests for PrettyPrinter
    - Example blueprint → expected formatted string; verify 2-space indentation; verify bulleted section list present
    - _Requirements: 14.1, 14.2_

- [x] 4. Extend FileParser for progressive extraction
  - [x] 4.1 Extend `lib/file-parser.ts` with `parseAIResponse(rawResponse: string)` additions for progressive mode
    - Extract files from `<file path="...">` tags with incomplete closing tags (streaming partials)
    - Detect duplicate file declarations and merge by preferring the longer version (complete beats incomplete; among equals, longer wins)
    - Strip standalone ellipsis placeholders (`...` on their own line, not in operator context) while preserving spread operators (`...props`, `...rest`, `...args`)
    - Log a warning for truncated files but still return them
    - Validate extracted files have recognized extensions (`.jsx`, `.js`, `.tsx`, `.ts`, `.css`, `.json`)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]\* 4.2 Write property test for FileParser — Property 18: File parser prefers longer complete version on duplicate
    - **Property 18: File parser prefers longer complete version on duplicate**
    - Generate arbitrary file paths and two content strings where `longContent.length > shortContent.length`; assert `parseAIResponse` returns the longer content for that path
    - **Validates: Requirements 13.2, 13.3**

  - [ ]\* 4.3 Write property test for FileParser — Property 19: Ellipsis stripping does not remove spread operators
    - **Property 19: Ellipsis stripping does not remove spread operators**
    - Generate file contents containing both spread operators (`...props`) and standalone ellipsis lines; assert spread operators survive and standalone ellipsis lines are removed
    - **Validates: Requirement 13.7**

  - [ ]\* 4.4 Write unit tests for FileParser extensions
    - Streaming partial (no closing tag) → file extracted; duplicate declarations → longer content retained; spread operators preserved; standalone ellipsis stripped; invalid extension → excluded
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.7_

- [x] 5. Checkpoint — Ensure all foundational type and parser tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement PhaseStateMachine
  - [x] 6.1 Implement `lib/pipeline/phase-state-machine.ts` — `PhaseStateMachine` class extending `EventEmitter`
    - Internal state initialized to `"idle"`; `transition(to, metadata?)` validates the transition is legal per the state diagram (throw on illegal transitions), updates state, emits `PhaseTransitionEvent` with timestamp and metadata
    - `recordPhaseStart(phase)` and `recordPhaseEnd(phase, outcome, reason?)` maintain `executionLog` array in `PipelineContext`
    - `getState()`, `getContext()` (returns `Readonly<PipelineContext>`), `canResume()`, `getLastSuccessfulPhase()` accessors
    - `context.isInitialGeneration` flag set to `true` from `idle` → `analyzing` and cleared on `complete`
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ]\* 6.2 Write property test for PhaseStateMachine — Property 7: Phase state is always from the valid set
    - **Property 7: Phase state is always from the valid set**
    - Apply random sequences of valid transitions; after each one assert `getState()` is one of the eight defined states
    - **Validates: Requirement 6.1**

  - [ ]\* 6.3 Write property test for PhaseStateMachine — Property 8: Phase transition events always carry timestamp and metadata
    - **Property 8: Phase transition events always carry timestamp and metadata**
    - For any valid transition, the emitted `PhaseTransitionEvent` has `timestamp > 0` and `metadata` is a non-null object
    - **Validates: Requirement 6.2**

  - [ ]\* 6.4 Write property test for PhaseStateMachine — Property 9: Every completed phase has a log entry
    - **Property 9: Every completed phase has a log entry**
    - After any phase that transitions to success or failure outcome, `executionLog` contains an entry for that phase with non-null `startTime`, non-null `endTime`, and defined `outcome`
    - **Validates: Requirements 6.3, 6.5**

  - [ ]\* 6.5 Write unit tests for PhaseStateMachine
    - Valid transitions succeed and update state; invalid transitions throw; state is correct after each valid transition; `canResume()` returns `true` only when `lastSuccessfulPhase` is non-null
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 7. Implement EditQueue
  - [x] 7.1 Implement `lib/pipeline/edit-queue.ts` — `EditQueue` class
    - `enqueue(edit: QueuedEdit): void` — appends to internal queue
    - `drain(): QueuedEdit[]` — returns all queued edits in order and clears the queue
    - `isEmpty(): boolean`, `size(): number`
    - Thread-safe: concurrent `drain()` calls must not produce duplicate edits (use a simple lock flag)
    - `prependToFront(edit: QueuedEdit): void` — for re-queueing conflicting user edits after AI fix (Req 9.6)
    - _Requirements: 11.2, 9.6_

  - [ ]\* 7.2 Write unit tests for EditQueue
    - `enqueue` / `drain` round-trip preserves order; `isEmpty` correctness; concurrent drain safety (call `drain()` twice — second call returns empty array); `prependToFront` inserts at position 0
    - _Requirements: 11.2, 9.6_

- [x] 8. Implement AI generation endpoint (generate-ai-phase)
  - [x] 8.1 Create `app/api/generate-ai-phase/route.ts` — streaming SSE route accepting `PhaseGenerationRequest`
    - Validate `phase` parameter against the allowed set (`analyze`, `instant_preview`, `progressive_clone`, `polish`); return `400` for any unrecognized value
    - Validate that `targetSection` is present when `phase === "progressive_clone"`; return `400` if missing
    - Validate that `blueprint` is present for all phases except `"analyze"`; return `400` if missing
    - Stream response as SSE events with shape `{ type: 'status' | 'stream' | 'complete' | 'error', ... }`
    - _Requirements: 7.1, 7.2_

  - [x] 8.2 Create `lib/pipeline/system-prompt-builder.ts` — `SystemPromptBuilder.build(phase, targetSection?)`
    - Selects the correct prompt template from `lib/pipeline/prompts/`; interpolates `{targetSection}` and `{passType}` slots
    - Returned string must contain the phase name; when `targetSection` is provided it must also contain the section name
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 8.3 Create prompt template files in `lib/pipeline/prompts/`
    - `analyze.prompt.ts` — instructs AI to output JSON-only `SiteBlueprint`
    - `instant-preview.prompt.ts` — minimal layout with placeholders, apply color/font from blueprint
    - `progressive-clone.prompt.ts` — single-section generation with `{targetSection}` slot
    - `polish.prompt.ts` — responsive/spacing/animation pass with `{passType}` slot
    - `validation-fix.prompt.ts` — targeted fix: given file content + error, return fixed file only
    - All prompts instruct AI to output only `<file path="...">` blocks, no conversational text
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ]\* 8.4 Write property test for SystemPromptBuilder — Property 10: AI generation endpoint rejects invalid phase values
    - **Property 10: AI generation endpoint rejects invalid phase values**
    - For any string not in `{analyze, instant_preview, progressive_clone, polish}`, the endpoint returns a 4xx response; for any valid phase value it does not reject solely on phase
    - **Validates: Requirement 7.1**

  - [ ]\* 8.5 Write property test for SystemPromptBuilder — Property 11: System prompt contains phase name
    - **Property 11: System prompt contains phase name**
    - For any valid `(phase, targetSection)` pair, `SystemPromptBuilder.build()` output contains the phase name string; when `targetSection` is provided, output also contains the section name
    - **Validates: Requirements 7.3, 7.4, 7.5**

  - [ ]\* 8.6 Write unit tests for generate-ai-phase route
    - Missing `phase` → 400; unrecognized `phase` → 400; `progressive_clone` without `targetSection` → 400; valid request → 200 with SSE stream started
    - _Requirements: 7.1, 7.2_

- [x] 9. Implement ProgressiveFileApplicationService
  - [x] 9.1 Implement `lib/pipeline/progressive-file-application.ts` — `ProgressiveFileApplicationService`
    - `applyFiles(files, provider, options)`: in progressive mode write each file immediately as parsed; on write failure retry that file once in a background task without blocking parsing of subsequent files
    - Batch writes for files sharing the same `sectionName` (Req 8.6)
    - `triggerHotReload(provider)`: signal Vite HMR via `provider.runCommand`; verify preview updates within 5 s; on first failure retry once; on retry failure call `provider.restartViteServer()`
    - Guard: only call `triggerHotReload` after both parse success AND write success are confirmed (pending background retry does NOT satisfy write-success guard)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 3.6, 3.7, 3.8_

  - [ ]\* 9.2 Write unit tests for ProgressiveFileApplicationService
    - Progressive mode writes files immediately; failed write triggers background retry without blocking; hot reload called only after successful write; hot reload failure → retry once → fallback restart
    - _Requirements: 8.2, 8.3, 3.6, 3.7, 3.8_

- [x] 10. Checkpoint — Ensure all infrastructure layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Phase 1 — AnalysisPhaseHandler
  - [x] 11.1 Implement `lib/pipeline/phases/analysis.ts` — `AnalysisPhaseHandler`
    - `execute(input: AnalysisInput): Promise<AnalysisOutput>`: call AI with `phase="analyze"`, pass `scrapedContent`; enforce 25 s hard timeout (abort + error)
    - On AI response: call `BlueprintParser.parse()` to get `SiteBlueprint`; on parse success attempt `JSON.stringify(blueprint)` — if serialization throws, record phase as `"failure"` with serialization error and do NOT pass the blueprint forward
    - On success: record phase as `"success"`, return `{ blueprint, tokenUsage }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9_

  - [ ]\* 11.2 Write unit tests for AnalysisPhaseHandler
    - Valid scraped content → blueprint returned; timeout after 25 s → error surfaced; malformed AI response → descriptive parse error; serialization failure → phase marked failure, blueprint not returned
    - _Requirements: 1.6, 1.8, 1.9_

- [x] 12. Implement Phase 2 — InstantPreviewPhaseHandler
  - [x] 12.1 Implement `lib/pipeline/phases/instant-preview.ts` — `InstantPreviewPhaseHandler`
    - `execute(blueprint, sandboxProvider)`: call AI with `phase="instant_preview"`, write layout files via `ProgressiveFileApplicationService` with `isProgressive=false`
    - Install baseline packages (`react`, `react-dom`, `tailwindcss`) via `sandboxProvider.installPackages()`
    - Start Vite dev server; return preview URL immediately even if files have errors (Req 2.9)
    - After returning URL, start background error-fixing coroutine: re-run validation on preview files and apply targeted fixes without blocking phase transition
    - Transition pipeline to `progressive_cloning` as soon as URL is available
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]\* 12.2 Write unit tests for InstantPreviewPhaseHandler
    - Blueprint → layout files written → packages installed → Vite started → URL returned; preview URL returned even when file errors exist; background fix coroutine starts after URL returned
    - _Requirements: 2.8, 2.9_

- [x] 13. Implement Phase 3 — ProgressiveCloningPhaseHandler
  - [x] 13.1 Implement `lib/pipeline/phases/progressive-cloning.ts` — `ProgressiveCloningPhaseHandler`
    - `classifySectionPriority(sectionType: string): SectionPriority`: map section type to `hero | primary | secondary | footer`; unknown types map to `secondary`
    - `sortSectionsByPriority(sections: BlueprintSection[]): BlueprintSection[]`: sort by tier order then ascending `order` value within each tier
    - `execute(blueprint, sandboxProvider, onProgress)`:
      - Sort sections via `sortSectionsByPriority`
      - For each section: emit `{ type: "section_status", status: "generating", ... }` event; call AI `phase="progressive_clone"` with `targetSection`; enforce 45 s per-section timeout
      - On success: write files via `ProgressiveFileApplicationService` (progressive mode), trigger hot reload, emit `complete` event
      - On failure: retry up to 2 times with modified prompt; on final failure emit `failed` event; increment `consecutiveFailureCount`
      - On success: reset `consecutiveFailureCount` to 0
      - When `consecutiveFailureCount >= 3`: throw `"CONSECUTIVE_FAILURE_THRESHOLD_REACHED"` immediately without processing further sections
      - Emit `overallPercent` on each event as `(completedCount / totalCount) * 100`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.9, 3.11, 9.1, 9.2, 9.3, 9.7, 9.8_

  - [ ]\* 13.2 Write property test — Property 6: Section priority ordering invariants
    - **Property 6: Section priority ordering invariants**
    - For any arbitrary array of `BlueprintSection`, `sortSectionsByPriority` returns a list where all `hero` sections precede `primary`, `primary` precede `secondary`, `secondary` precede `footer`; within each tier, ascending `order` value
    - **Validates: Requirements 3.1, 3.2**

  - [ ]\* 13.3 Write property test — Property 12: Progressive cloning emits valid progress events
    - **Property 12: Progressive cloning emits valid progress events**
    - For any section being processed, at least one `ProgressEvent` is emitted with the section's name and a status from `{pending, generating, complete, failed}`
    - **Validates: Requirement 3.9**

  - [ ]\* 13.4 Write property test — Property 13: All sections reach terminal status
    - **Property 13: All sections reach terminal status**
    - For any set of sections (when not halted by consecutive failure threshold), after `execute()` resolves every input section has status `complete` or `failed` in returned `SectionResult[]`
    - **Validates: Requirement 3.11**

  - [ ]\* 13.5 Write property test — Property 14: Section retry count never exceeds 2
    - **Property 14: Section retry count never exceeds 2**
    - For any failing section, `retryCount` in its `SectionResult` is `<= 2`
    - **Validates: Requirement 9.3**

  - [ ]\* 13.6 Write property test — Property 15: Consecutive failure threshold halts processing
    - **Property 15: Consecutive failure threshold halts processing**
    - When 3 or more consecutive sections fail, no sections are processed after the third consecutive failure; subsequent sections have `pending` status or do not appear in result array
    - **Validates: Requirement 9.8**

  - [ ]\* 13.7 Write unit tests for ProgressiveCloningPhaseHandler
    - Sections sorted in correct priority order; 45 s timeout marks section failed; per-section retry up to 2×; consecutive 3 failures halt pipeline; progress events emitted per section; `overallPercent` increments correctly
    - _Requirements: 3.1, 3.2, 3.5, 9.3, 9.8_

- [x] 14. Implement Phase 4 — ValidationPhaseHandler
  - [x] 14.1 Implement `lib/pipeline/phases/validation.ts` — `ValidationPhaseHandler`
    - `execute(sandboxProvider)`: run `sandboxProvider.runCommand("npm run build")`; check exit code
    - If exit code 0: return `ValidationResult` with `success: true`, empty `errors`
    - If non-zero: call `extractErrorsFromBuildOutput(stdout + stderr)` to get `ValidationError[]`
    - For each failing file: call AI with `phase="validation-fix"` with file content + error; validate response via `validateAIFixResponse()`; on valid response rewrite file via `sandboxProvider.writeFile()`; re-run build
    - Retry per file up to 3 times total; on exhaustion: add to `permanentlyFailedFiles` with `attemptCount: 3`
    - Invalid/empty AI fix response counts as a failed attempt
    - Surface permanently failed files with path, final error, and attempt count
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]\* 14.2 Write property test — Property 16: Validation retry count never exceeds 3 per file
    - **Property 16: Validation retry count never exceeds 3 per file**
    - For any file that permanently fails, `attemptCount` in `FailedFile` is exactly 3; no file ever receives more than 3 AI fix attempts
    - **Validates: Requirement 4.10**

  - [ ]\* 14.3 Write property test — Property 17: Build error extraction finds all failing files
    - **Property 17: Build error extraction finds all failing files**
    - For any build output string containing file path error patterns, `extractErrorsFromBuildOutput()` returns at least one `ValidationError` for each unique erroring file path
    - **Validates: Requirement 4.3**

  - [ ]\* 14.4 Write unit tests for ValidationPhaseHandler
    - Exit code 0 → success immediately; exit code 1 + build output → errors extracted; per-file fix loop up to 3×; invalid AI response counts as failed attempt; permanently failed files surfaced with correct `attemptCount`
    - _Requirements: 4.1, 4.2, 4.10, 4.11_

- [x] 15. Implement Phase 5 — PolishPhaseHandler
  - [x] 15.1 Implement `lib/pipeline/phases/polish.ts` — `PolishPhaseHandler`
    - `execute(blueprint, sandboxProvider)`: run three passes in order — responsive breakpoints, spacing and consistency, animation (only if `blueprint` indicates original site had animations)
    - Log each pass start/end/outcome via `PipelineContext.executionLog`
    - Set `hasCriticalErrors: true` when errors from validation or progressive cloning exist in `PipelineContext`
    - On pass failure: if `hasCriticalErrors` is `false`, set `completedWithWarnings: true` and continue; if `hasCriticalErrors` is `true`, re-throw to surface critical errors
    - Mark phase complete after all passes finish
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]\* 15.2 Write unit tests for PolishPhaseHandler
    - All passes succeed → `completedWithWarnings: false`; pass fails + no critical errors → `completedWithWarnings: true`; pass fails + critical errors exist → re-throws; animation pass skipped when original site has no animations; all operations logged
    - _Requirements: 5.5, 5.7, 5.8_

- [x] 16. Checkpoint — Ensure all phase handler tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Implement the pipeline orchestration API route and session persistence
  - [ ] 17.1 Create `app/api/generation-pipeline/route.ts` — SSE orchestration endpoint
    - Accept `{ url, sessionId, sandboxId? }` request body
    - Instantiate `PhaseStateMachine` and wire all five phase handlers
    - Stream `PipelineEvent` objects as SSE; include `phase_transition`, `section_status`, `file_written`, `hot_reload`, `build_error`, `fix_attempt`, `token_usage`, `complete`, and `error` event types
    - Deduct total token usage from user balance via existing `/api/tokens` mechanism after pipeline completes
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 7.6_

  - [ ] 17.2 Add pipeline context persistence to MongoDB
    - On each phase transition, serialize `PipelineContext` (`lastSuccessfulPhase`, `blueprint`, `sandboxId`, `executionLog`, `sectionResults`) to MongoDB session store keyed on `sessionId + sandboxId`
    - On pipeline startup, check for existing persisted context; if found, expose it so the resume/restart prompt can be shown
    - `canResume()` on `PhaseStateMachine` checks persisted context for non-null `lastSuccessfulPhase`
    - _Requirements: 6.4_

  - [ ] 17.3 Extend the existing `generate-ai-code-stream` endpoint to check `context.isInitialGeneration`
    - When `isInitialGeneration` is `true`, call `EditQueue.enqueue()` instead of processing the edit immediately
    - On pipeline `complete` state transition, drain the `EditQueue` and process each edit in order using the existing edit flow unchanged
    - When AI fix loop rewrites a file that has a pending queued user edit for the same file, apply the fix, then call `EditQueue.prependToFront()` with the user's edit so it is applied immediately after
    - _Requirements: 11.1, 11.2, 11.4, 9.6_

  - [ ]\* 17.4 Write integration test: full pipeline run with mock sandbox
    - Use a mocked `SandboxProvider` (implementing the abstract class); verify all 5 phases execute in order; verify correct `PipelineEvent` types emitted; verify final state is `"complete"`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]\* 17.5 Write integration test: validation fix loop
    - Mock sandbox build that fails twice then succeeds on third attempt for the same file; assert `ValidationResult.success: true` and `retriedFiles` contains the fixed path
    - _Requirements: 4.9, 4.10_

  - [ ]\* 17.6 Write integration test: consecutive failure halt
    - Mock 3 consecutive section generation failures; assert pipeline transitions to `"error"` state with reason `CONSECUTIVE_FAILURE_THRESHOLD_REACHED`
    - _Requirements: 9.8_

  - [ ]\* 17.7 Write integration test: edit queue drains after generation
    - Submit a chat edit request during initial generation; assert edit is queued (not executed); assert edit is applied after pipeline reaches `"complete"` state
    - _Requirements: 11.2_

- [ ] 18. Implement the ProgressUI component and progress display
  - [ ] 18.1 Create `components/app/ProgressUI.tsx` — progress panel component
    - Display current phase name mapped to user-facing label: `analyzing → "Analyzing"`, `instant_preview → "Generating Preview"`, `progressive_cloning → "Cloning Sections"`, `validating → "Validating"`, `polishing → "Polishing"`
    - During `progressive_cloning`: render per-section rows with status icons (pending / generating spinner / complete checkmark / failed ×) and section name
    - Render overall progress bar (0–100%) derived from `SectionStatusPayload.overallPercent`
    - Display estimated remaining time (derive from historical phase durations stored in `executionLog`)
    - Animate completion indicator when a section transitions to `complete`
    - When errors occur, display error row with section name and error type
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 18.2 Implement expandable phase detail panel in `ProgressUI`
    - Each phase row is clickable to expand; expanded panel renders both `PhaseExecutionLog` entries (start time, end time, outcome, failure reason) and `tokenUsage` for that phase **in the same panel** (not separate tabs)
    - _Requirements: 10.7_

  - [ ] 18.3 Update `app/generation/page.tsx` to integrate pipeline orchestration
    - Connect to `/api/generation-pipeline` SSE stream; dispatch `PipelineEvent` objects to `ProgressUI`
    - Show resume/restart prompt when persisted context with `lastSuccessfulPhase` is detected on page load; wait for explicit user choice before triggering any state machine transition
    - Wire the preview iframe `src` to the sandbox URL returned from the Instant Preview phase
    - _Requirements: 6.4, 6.6, 10.1, 10.2_

  - [ ]\* 18.4 Write unit tests for ProgressUI component
    - Renders correct phase label for each `PhaseState`; progress bar reflects `overallPercent`; section rows appear during `progressive_cloning`; expanded panel shows log and token usage together; error row shown on error event
    - _Requirements: 10.1, 10.2, 10.3, 10.6, 10.7_

- [ ] 19. Checkpoint — Ensure all UI and orchestration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Install fast-check and wire up property-based test infrastructure
  - [x] 20.1 Add `fast-check` and a test runner (`vitest`) as dev dependencies in `package.json`
    - Add `vitest` and `@vitest/ui` to `devDependencies`; add `fast-check` to `devDependencies`
    - Add `"test": "vitest --run"` and `"test:watch": "vitest"` scripts to `package.json`
    - Create `vitest.config.ts` at workspace root with `include: ['**/*.test.ts', '**/*.spec.ts']`
    - _Requirements: All property-based test tasks_

  - [ ] 20.2 Create fast-check arbitraries in `lib/pipeline/__tests__/arbitraries.ts`
    - `arbitrarySiteBlueprint()` — generates valid `SiteBlueprint` objects with valid hex colors, lowercase-hyphen section names, valid font weights (100–900), and URI image URLs
    - `arbitraryBlueprintSections()` — array of `BlueprintSection` with random `type` values and non-negative `order` values
    - `arbitraryFilePath()` — valid file path with recognized extension
    - `arbitraryFileContent()` — non-empty string of arbitrary printable characters
    - _Requirements: All property-based test tasks_

- [ ] 21. Wire property-based test files to fast-check arbitraries
  - [ ] 21.1 Create `lib/pipeline/__tests__/blueprint-parser.property.test.ts`
    - Import arbitraries from `arbitraries.ts`; implement Properties 1, 2, 3 (each `fc.assert` with `numRuns: 100`); tag each test with `// Feature: progressive-generation-architecture, Property N: ...`
    - _Requirements: 12.2, 12.4, 12.6_

  - [ ] 21.2 Create `lib/pipeline/__tests__/pretty-printer.property.test.ts`
    - Implement Properties 4, 5 with `numRuns: 100`; tag each test
    - _Requirements: 14.1, 14.5, 14.6_

  - [ ] 21.3 Create `lib/pipeline/__tests__/file-parser.property.test.ts`
    - Implement Properties 18, 19 with `numRuns: 100`; tag each test
    - _Requirements: 13.2, 13.3, 13.7_

  - [ ] 21.4 Create `lib/pipeline/__tests__/phase-state-machine.property.test.ts`
    - Implement Properties 7, 8, 9 with `numRuns: 100`; tag each test
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 21.5 Create `lib/pipeline/__tests__/progressive-cloning.property.test.ts`
    - Implement Properties 6, 12, 13, 14, 15 with `numRuns: 100`; tag each test
    - _Requirements: 3.1, 3.2, 3.9, 3.11, 9.3, 9.8_

  - [ ] 21.6 Create `lib/pipeline/__tests__/validation.property.test.ts`
    - Implement Properties 16, 17 with `numRuns: 100`; tag each test
    - _Requirements: 4.3, 4.10_

  - [ ] 21.7 Create `lib/pipeline/__tests__/system-prompt-builder.property.test.ts`
    - Implement Properties 10, 11 with `numRuns: 100`; tag each test
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

- [ ] 22. Implement Playwright E2E tests
  - [ ] 22.1 Add Playwright as a dev dependency and create `playwright.config.ts`
    - Add `@playwright/test` to `devDependencies`; configure `baseURL`, `testDir: 'e2e/'`, `use: { screenshot: 'on' }`
    - Add `"test:e2e": "playwright test"` script to `package.json`
    - _Requirements: E2E test coverage_

  - [ ]\* 22.2 Write E2E test: full clone — preview under 30 seconds
    - Navigate to generation page; submit a public URL; assert preview iframe `src` becomes non-empty within 30 seconds
    - **Validates: Requirement 2.8**

  - [ ]\* 22.3 Write E2E test: section-level progress UI
    - During progressive cloning phase, assert section rows with spinners appear and transition to checkmarks as sections complete
    - **Validates: Requirements 10.2, 10.5**

  - [ ]\* 22.4 Write E2E test: resume after interruption
    - Start generation; navigate away mid-cloning; reload; assert resume/restart prompt appears; choose resume; assert only remaining sections regenerate (verify already-complete sections do not re-emit `generating` events)
    - **Validates: Requirement 6.4**

- [ ] 23. Final checkpoint — All tests green, integration verified
  - Run `npm run test -- --run` and confirm all unit and property-based tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they validate correctness properties and provide long-term regression safety
- All new code lives under `lib/pipeline/` (services, phases, prompts, types) and `app/api/generate-ai-phase/` + `app/api/generation-pipeline/` (routes)
- Existing endpoints (`generate-ai-code-stream`, `apply-ai-code-stream`) are extended minimally — only the `isInitialGeneration` flag check is added; their core logic is untouched
- `SandboxProvider` abstract class is used as-is; phase handlers depend on the interface, not concrete implementations
- Each property test must include the tag comment `// Feature: progressive-generation-architecture, Property N: <property_text>` for traceability
- Checkpoints at tasks 5, 10, 16, 19, and 23 act as integration gates — do not proceed past a checkpoint until all prior tests pass

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "6.1", "7.1"] },
    {
      "id": 2,
      "tasks": [
        "2.2",
        "2.3",
        "2.4",
        "2.5",
        "3.2",
        "3.3",
        "3.4",
        "4.2",
        "4.3",
        "4.4",
        "6.2",
        "6.3",
        "6.4",
        "6.5",
        "7.2"
      ]
    },
    { "id": 3, "tasks": ["8.1", "8.2", "8.3", "9.1", "20.1"] },
    { "id": 4, "tasks": ["8.4", "8.5", "8.6", "9.2", "20.2"] },
    { "id": 5, "tasks": ["11.1", "12.1"] },
    { "id": 6, "tasks": ["11.2", "12.2", "13.1"] },
    {
      "id": 7,
      "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "14.1"]
    },
    { "id": 8, "tasks": ["14.2", "14.3", "14.4", "15.1"] },
    { "id": 9, "tasks": ["15.2", "17.1"] },
    { "id": 10, "tasks": ["17.2", "17.3"] },
    { "id": 11, "tasks": ["17.4", "17.5", "17.6", "17.7", "18.1"] },
    { "id": 12, "tasks": ["18.2", "18.3"] },
    {
      "id": 13,
      "tasks": ["18.4", "21.1", "21.2", "21.3", "21.4", "21.5", "21.6", "21.7"]
    },
    { "id": 14, "tasks": ["22.1"] },
    { "id": 15, "tasks": ["22.2", "22.3", "22.4"] }
  ]
}
```
