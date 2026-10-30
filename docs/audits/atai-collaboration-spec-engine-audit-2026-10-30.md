# ATAI Collaboration / Business-Completeness / Specification Engine — Phase 0 Audit

Date: 2026-10-30. Scope: read-only trace of the working tree as of this commit window.
Caveat: the working tree carries uncommitted edits from other sessions (notably
`lib/analysis/plan-sections.ts`, `lib/analysis/prompt-builder.ts`,
`lib/analysis/cofounder.ts`, and collaborate page-sections merging). Line numbers
below are from this audit snapshot; several files are moving. Nothing was modified
for this audit except today's separately-reported ResearchAgent parse/retry fix
and the collaboration gap-findings UI.

## 1. Current architecture and execution flow (verified by trace)

```
/start → POST /api/projects (skipAnalysis)        lib/projects/create-project.ts:101,122
  project.idea = founder's literal words (immutable; no code path rewrites it)
→ IdeaUnderstanding stage (AI)                    lib/planning/stages/idea-understanding.ts:191
  structured IdeaUnderstandingSchema; blocking (throws)
→ Research/gap-analysis stage                     lib/planning/stages/research.ts
  structured ResearchFindings; NON-blocking — catches its own failure,
  returns EMPTY findings with completenessScore 100 (see D-01)
→ PrimaryPlanner.planApplication(understanding, research)  lib/planning/stages/planner.ts:216
  structured inputs flattened into an XML-tagged PROSE prompt (planner.ts:456
  embeds completeness_score + gap lists); output structured, but most plan
  fields are prose strings (lib/types/specification.ts:50-80)
→ Critic → (conditional) Repair → Validator       critic.ts / repair.ts / validator.ts:56
  idea path throws on invalid (orchestrator.ts:276);
  website path logs and CONTINUES (orchestrator.ts:598-606)
→ Sanitize → complexity → store specification, state "specification_ready" (orchestrator.ts:335)
→ Collaboration page (sections, chat proposals, auto-complete, analysis)
→ Launch/Build: buildInitialBuildPrompt(spec, understanding, preferences)
  app/api/projects/[id]/build/route.ts:83 → lib/integrations/totalum/service.ts launchProject
  → POST api-accounts.totalum.app/api/v1/vcaas/projects/launch (client.ts:23)
```

Three independent callers produce the same brief shape: build route,
`lib/analysis/pipeline.ts:107` (auto-launch), `lib/projects/project-actions.ts:130`.
Duplicate-build protection is real: atomic `store.claimBuildSlot` (build:95,
pipeline:94, actions:138) + reserve→refund-on-failure credits.

Data shape verdict: every stage hop that matters (idea→understanding→research→
planner) converts STRUCTURED data into flattened prompt prose and expects the
model to re-emit structure. Acceptance criteria, permissions, idempotency and
verification status never exist as structure at any point — see D-14.

## 2. Key files, functions, data structures

- Pipeline: `lib/planning/orchestrator.ts`, `stages/{idea-understanding,research,planner,critic,repair,validator}.ts`, `utils/retry.ts` (`classifyError`, `executeWithRetry`, `STAGE_RETRY_CONFIGS` — the latter referenced only by tests), `lib/planning/tracking/planning-run.ts:161,181`.
- Persistence: `lib/store` (`updateProject`, `claimBuildSlot`), `lib/projects/ai-artifacts.ts`, `lib/types/ai-artifacts.ts` (status `ready|fallback|unparsed|failed`), `lib/types/research-findings.ts`, `lib/types/specification.ts`, `lib/planning/schemas/specification.ts:113` (`validateSpecificationCompleteness` — defined, never called).
- Collaboration: `app/project/[projectId]/collaborate/collaborate-client.tsx`, `app/api/projects/[id]/route.ts` (PATCH: `sectionUpdate`, `dismissProposalId`, `understanding`, `specification` only — lines 103-109), `analyze-plan/route.ts`, `auto-complete/route.ts`, `plan-chat/route.ts`, `lib/analysis/{plan-sections,plan-analysis-service,cofounder,prompt-builder}.ts`, `lib/cofounder/tools/plans.ts`.
- Build/runtime: `lib/analysis/prompt-builder.ts:121-261`, `lib/integrations/totalum/{service,client}.ts`, `packages/atai-sdk/src/capabilities/*`, `lib/analysis/runtime-capabilities.ts`, `runtime/contracts/router.ts:103`, `lib/runtime/router/capability-registry.ts`.

## 3. Verified defects (with evidence)

### Success semantics — "a stage can claim success while producing invalid output"

- **D-01 (High) Research failure is indistinguishable from a perfect plan.**
  `research.ts` `getEmptyFindings()` returns `completenessScore: 100` and
  `analyzeForGaps` catches its own terminal failure and RETURNS the empty object
  instead of throwing; therefore the orchestrator's try/catch substitute
  (orchestrator.ts:187-209, also score 100) is dead code. The planner reads only
  `completenessScore` + gap arrays (planner.ts:225,456) — never `modelUsed` —
  so it plans as if research found zero gaps. The truth exists only in the
  aiArtifacts `status` field, which is not on the planner's data path.
- **D-02 (High) `executeStage` records `success: true` for degraded output.**
  orchestrator.ts:824-832 marks success whenever `fn()` returns. Observed live
  on 2026-10-30: `planning.stage.completed … "Stage research completed"
  success:true` immediately after `Gap analysis failed` + empty findings.
- **D-03 (Med) Fallback models never engage in planner/critic/repair/idea-understanding.**
  `callModelWithRetry(…, 0)` is hardcoded inside the retry closure at
  planner.ts:232, critic.ts:200, repair.ts:182, idea-understanding.ts:203 —
  the same defect fixed in research.ts today still stands everywhere else.
  `registry.getFallbackModel` (registry.ts:138) is unreachable on retries.
- **D-04 (Med) Malformed/schema-invalid output is classified NON_RETRYABLE.**
  retry.ts:110-117 matches `'validation failed'` / `schemaerror`; a
  `ResearchError("Schema validation failed: …")` aborts the loop immediately
  and (via D-01) degrades silently. Regeneration usually fixes malformed JSON;
  this classification guarantees it never happens.

### Path inconsistency

- **D-05 (High) The website/mirror pipeline bypasses its own gates.**
  Invalid validator result: log-and-continue (orchestrator.ts:598-606). Failed
  critique: fabricates `{ passesValidation: true, qualityScore: 50 }`
  (:541-550), skips repair, persists `specification_ready`. The idea path
  throws `ValidationError` for the same condition (:281).

### Spec completeness

- **D-06 (Med) The spec schema accepts an empty plan as success.**
  `lib/types/specification.ts:38-45`: title/description/purpose are `.string()`
  without `.min(1)`; entity/flow arrays `.default([])`.
  `validateSpecificationCompleteness` (planning/schemas/specification.ts:113)
  is never invoked anywhere; `buildPlanningContext` / `mergeResearchFindings`
  (:59,:67) are dead code.

### Founder-intent preservation

- **D-07 (High) The founder's literal idea never reaches the builder.**
  `buildInitialBuildPrompt(spec, understanding, preferences)` has no `idea`
  parameter (prompt-builder.ts:121-125; build/route.ts:83). `project.idea` is
  authoritative and immutable (good) but used only as `founderVision` in
  chat/analysis context (plan-chat/route.ts:157, analyze-plan/route.ts:84).
  Whatever the founder typed verbatim is absent from the launched brief.
- **D-08 (High) Placeholders and open questions travel as MANDATORY requirements.**
  `isPlaceholderValue` is never applied in prompt-builder (verified: zero
  matches in the file). `Application type:` (:170), `Business model` (:191),
  pricing under "must present and enforce" (:195-196) inject the generator's
  own `"Not defined yet: <question>"` text (specification.ts:100) into the
  brief; a placeholder `seoPlan` fires the "MANDATORY SEO" block (:103-119).
  (Note: prompt-builder.ts is under active edit by another session — verify
  before fixing.)
- **D-09 (Med) Stale proposal accept can overwrite newer founder edits.**
  PATCH sectionUpdate applies the accepted value with no comparison against
  the CURRENT section value (route.ts:168-196); proposals are stamped at
  analysis time (analyze-plan/route.ts:151). Classic lost-update race; no plan
  versioning exists.
- **D-10 (Med) Rejected proposals reappear.**
  `dismissProposalId` removes from the cached list only (route.ts:112-126);
  `PlanAnalysis` has no rejected/dismissed field
  (lib/types/plan-analysis.ts:36-41); re-analysis replaces the whole object
  (analyze-plan/route.ts:155).
- **D-11 (Med) No per-section provenance (founder vs AI).**
  `applySectionUpdate`'s `mode: "manual"|"proposal"` (plan-sections.ts:737-745)
  is never persisted. Provenance survives only as truncated strings
  (`planUpdateNotes.slice(-50)`, auto-complete/route.ts:310-314). Auto-run
  undo `action:"clear"` (auto-complete/route.ts:174-203) does not verify the
  section was AI-drafted and restores nothing prior; `clearSectionUpdate`
  blanks whole COMBINED sections including legacy founder fields
  (plan-sections.ts:596-659).
- **D-12 (High) Launch is gated on spec existence only.**
  launch/route.ts:40-41, build/route.ts:59. `LaunchButton` enables at
  `plan_ready` (collaborate-client.tsx ~2602); missing-section and coverage
  signals are advisory UI. A founder can build with critical sections empty,
  while `computePlanHealth`/`isPlaceholderValue` already exist to gate it.
- **D-13 (Low) Unresolved chat questions are not persisted** anywhere except
  embedded as `"Not defined yet:"` text — which auto-complete then erases (D-11).
  Cosmetic: pipeline overwrites the project name with the AI title
  (pipeline.ts:559).

### Capability verification (Phase-C material, recorded now)

- **D-14 (High) The planning pipeline has no Atai Runtime awareness.**
  planner.ts:49 and critic.ts:52 system prompts assert only the "Totalum
  stack"; they never mention `@atai-group/sdk` or any `atai.*` operation. The
  only grounding check, `isRuntimeIntegrationsGrounded`
  (runtime-capabilities.ts:137-144), verifies a capability NAME string appears,
  not that the operation exists — a plan naming `atai.payments.refund` passes.
- **D-15 (Med) Four hand-written capability copies drift.**
  SDK reality (packages/atai-sdk/src/capabilities, verified source):
  `ai.chat`, `voice.synthesize`, `search.web`, `web.scrape`, `email.send`,
  `notifications.send`, `maps.geocode|reverseGeocode`,
  `calendar.listBookings|createBooking`, `vectors.*`, `db.*`,
  `payments.createCheckout|createSubscription|listPayments|listPayouts`,
  `health.check`. Meanwhile router.ts:103-104 and runtime-capabilities.ts:34
  advertise `ai.text: [chat, completion, embed]`, embed/image/video/speech/
  transcribe/vision, 8 extra maps ops, `test.echo` — not callable via SDK
  (`AiCapability` exposes only `chat`, ai.ts:57). prompt-builder.ts:82 is a
  fourth copy. Payments have NO refund/cancel-subscription operations, yet
  plans routinely promise refunds (see DevPath §14.2 expectations).
- **D-16 (Med) Totalum launch has no idempotency key and no retry.**
  totalumFetch single-attempt (client.ts:23,35). A timeout after the remote
  created the project releases credits and orphans the Totalum project.
  Mitigations exist (`requestedProjectId` as caller key, claimBuildSlot) but
  the timeout branch should `getProject(requestedProjectId)` before refunding.

### Brief content gaps vs a production specification (prompt-builder.ts:157-219)

ABSENT: acceptance criteria; error/retry/idempotency requirements; role→
permission matrix (only a `User roles:` name list :179); security requirements
beyond "never expose the API key" (:74); test requirements; deployment
constraints; data RELATIONSHIPS (entities list fields only :128-134).
PARTIAL: payment/entitlement enforcement stated as mandate (:72,:195-198) with
no concrete entitlement rules. PRESENT: runtime payments rules, SEO, tech stack.
This is the central brief-mandated finding: **the build request is a long
prompt, not a verified specification.**

## 4. Hypotheses (not yet verified — do not treat as defects)

- H-1: if `sanitizeItems` (research.ts) drops ALL entries of a real answer, the
  recomputed score becomes 100 — a variant of D-01 with different trigger.
- H-2: the `/retry` understanding path may regenerate spec over founder edits —
  not fully traced (recovery is gated on `!project.specification`, route.ts:65).
- H-3: `STAGE_RETRY_CONFIGS` (retry.ts:299) intent (e.g. research 45s timeout)
  is unenforced — orchestrator uses inline configs; only tests reference it.

## 5. Root causes of incomplete specifications

1. Success is keyed on "the function returned", not "the output is valid and
   complete" (D-01/02/05/06).
2. Structure is flattened to prose at every stage boundary, so nothing
   downstream can diff, verify, or trace requirements — only re-parse text.
3. No provenance/approval ledger exists, so AI and founder content are
   indistinguishable to every guard that would need to tell them apart
   (D-09/10/11).
4. Capability truth has four divergent copies and none is wired into the
   planner (D-14/15); "grounding" is a name-string check.
5. Gates are advisory UI (coverage chips, health) rather than server-side
   fail-closed validation (D-06/12).

## 6. Missing validation and test coverage

Baseline: 197 test files today (was 193/2302 tests green 2026-10-28; not
re-run). Parser-level truncation IS covered (json-parser, raw-chat,
plan-update-stream, idea-understanding). Uncovered end-to-end:
- ResearchAgent/planner/critic/repair/validator/orchestrator: zero tests —
  including behavior on truncated/schema-invalid model output.
- `build/route.ts`, `plan-chat`, `analyze-plan`, `auto-complete`, PATCH
  `projects/[id]` routes: zero tests (ownership, credit charge/refund, 402
  pause, lost-update, dismiss persistence).
- Proposal lifecycle (dismiss reappearing), provenance/overwrite, brief
  placeholder passthrough (D-07/08), launch gating: no tests.
- Capability verification: 2 cases only; advertised-vs-callable drift untested.
- No DevPath fixture exists anywhere in repo (grep: zero hits) — Part 14 of the
  brief needs one authored, not found.

## 7. Compatibility and migration risks

- Adding `.min(1)`/completeness gates to spec parsing can break reads of
  existing stored projects (schemas are used on read paths) — gate at WRITE
  time, keep reads permissive.
- Server-side launch gating can break `autoLaunchBuild` pipeline mode and
  existing credit-resume tests — gate must honor an explicit force/ack flag.
- Changing placeholder behavior alters `computeBriefCoverage` and the two
  prompt-builder suites — expect test updates; prompt-builder.ts is being
  edited concurrently by another session (coordinate before touching).
- Making parse/schema errors retryable increases provider spend (OpenRouter
  credits constraint is known) — cap by existing maxAttempts, no change there.
- Persisting provenance/dismissals adds fields to Project docs — additive,
  default-empty; no migration script needed for Mongo schema-if-anything.

## 8. Recommended minimal changes (smallest safe diff per defect)

- D-01/D-02: return `completenessScore: 0` + `failed: true` on empty findings;
  planner prompt branches on it ("research did not complete — gaps unknown");
  executeStage inspects the returned marker. ~30 lines, 3 files.
- D-03: thread real attempt index (one-line-per-file, pattern proven in research.ts today).
- D-04: classify stage-local "response parse/schema" errors as retryable;
  keep cross-stage ValidationError non-retryable.
- D-05: unify website path with idea path on critical validation (or new
  `specification_degraded` state).
- D-06/D-12: call `validateSpecificationCompleteness` before
  `specification_ready`; launch/build route 409s on
  `computePlanHealth` critical-missing unless `force` acknowledged flag.
- D-07/D-08: include `project.idea` verbatim as a bounded "founder's own
  words" block; run `isPlaceholderValue` before emitting mandatory blocks.
- D-09/D-10/D-11: stale-accept 409 vs `proposal.currentValue`; persist
  `dismissedProposalKeys`; per-section author map written on every patch;
  clear gated on author==ai.
- D-14/D-15: single source of truth — generate prompt-builder capability line
  and router advertisements FROM the SDK's exported operations; add a
  runtime-capabilities block to planner/critic system prompts; validate
  operation tokens in grounding check.
- D-16: on launch timeout/SERVER_NOT_READY, query Totalum
  `getProject(requestedProjectId)` before releasing the credit reservation.

## 9. Phased implementation plan (maps to brief Parts 3-13)

- Phase B (next): D-01/02/03/04 success semantics + real retries; then the
  structured requirements ledger (brief Part 3) as an additive field on
  Project with provenance/status — designed so D-07/08/09/10/11 fixes consume
  it rather than each patching ad hoc.
- Phase C: capability single-source (D-14/15/16) wired into planner/critic.
- Phase D: completeness gate (D-06/12), workflows/domain/acceptance criteria
  as structured spec sections the brief builder consumes (replaces prose-only
  transport at the last hop; brief Parts 5-11).
- Phase E: tests for every defect above (Part 15 list), routes first.
- Phase F: author one DevPath-style fixture from the brief §14 checklist; run
  it through non-billable validation only.

## 10. Explicit non-goals

- No new pipeline, no second project-creation path, no replacement of Totalum
  integration or credit semantics (brief §1.1).
- No DevPath-specific rules in the general engine.
- No UI redesign; underlying planning behavior first.
- No paid production build to test prompt generation.
- No claims about runtime capabilities beyond the SDK inventory in §3/D-15.
