# ATAI Collaboration Pipeline — Phase 0 Root-Cause Report (confirmed findings)

Date: 2026-10-30
Scope: repository audit only. No implementation file was modified for this report.
Supersedes/complements: `docs/audits/atai-collaboration-spec-engine-audit-2026-10-30.md` (defect register D-01…D-16). This report re-classifies those findings around the reviewer's question — **is the failure in Atai's implementation, in the instructions sent to the AI models, or in the handoff between stages** — and states which are reproduced by tests.

Repro tests (passing today because they pin the *wrong* behavior; each flips to a normal regression test when its defect is fixed):
- `lib/analysis/build-handoff-defects.test.ts` — RB-01, RB-02, RB-03
- `lib/planning/utils/json-parser.test.ts` — truncated-JSON salvage (fix already landed)

---

## 1. How the current collaboration pipeline actually works

One execution path, traced end-to-end through real calls (not filenames):

**1.1 Idea submission → project record**
- `/start` hero creates a project in one of four modes (`lib/analytics/start-funnel.ts:51` — `idea | website | url | github`). The founder's verbatim text is stored as **`project.idea`** (scratch/idea mode).
- Analysis starts via `lib/analysis/pipeline.ts:353-362`: reads `project.idea`, then calls `generateSpecificationFromIdea(project.idea, userId, projectId, pipelineMode)`.

**1.2 Specification generation — three paths, one silent**
- `lib/analysis/specification.ts:34-59` `shouldUseEnhancedPipeline(userId)`: env flag or sha256-hash rollout percentage (`ENHANCED_PIPELINE_ROLLOUT_PERCENT`) picks cohort.
- Enhanced/heavy path: `orchestrator.executeIdeaPipeline` (`lib/planning/orchestrator.ts`), a staged pipeline (understand → research → specify) that appends events for the collaborate page (`orchestrator.ts:175-224`) and persists the resulting `ApplicationSpecification` onto `project.specification`.
- **Silent degradation (confirmed, RC-06 below):** if the heavy pipeline throws, `specification.ts:399-458` falls through to a legacy one-shot `generateSpecFromPrompt("from idea", <user_idea>)` and reports success. The founder and every downstream stage cannot tell which pipeline produced the plan.

**1.3 Research / gap analysis**
- `lib/planning/stages/research.ts` `analyzeForGaps` calls the model, parses JSON gap arrays, scores completeness. On total failure it returns `getEmptyFindings` (`research.ts:351`, `:658-665`; `lib/planning/schemas/research.ts:40-52`) — see RB-03.

**1.4 Collaboration page (founder works on the plan)**
- Server shell `app/project/[projectId]/collaborate/page.tsx` (header slots :62-66) + client `collaborate-client.tsx` (~4,300 lines).
- Section edits are written **straight into `project.specification`** via `store.updateProject` — free prose, no per-decision records.
- The only machine-readable founder decisions are **capability toggles**: `spec.suggestedFeatures[].enabled` (and `label`). These *are* honored at build time: enabled lines go to the builder, disabled ones are listed as declined (`prompt-builder.ts:29-45`).
- Co-founder chat (`lib/analysis/cofounder.ts`, raw-chat/plan-update-stream) rewrites section text; the "never contradict sibling sections" rule is a **prompt instruction** (section clusters, memory 2026-10-30), not code.

**1.5 Retry / recovery**
- `app/api/projects/[id]/retry/route.ts` → `retryProjectStep` → `lib/projects/pipeline-recovery.ts`: `startProjectPipeline` (:236+), `startPlanRegeneration` (:290+), `recoverStalledPipeline` (:329+), with atomic `claimPipelineSlot` and auto-retry loop.

**1.6 Build handoff**
- The brief sent to Totalum is `buildInitialBuildPrompt(spec, understanding, preferences)` (`lib/analysis/prompt-builder.ts:121`), called identically from `pipeline.ts:107`, `lib/projects/project-actions.ts:130`, `app/api/projects/[id]/build/route.ts:83`, `components/collaborate/builder-review.tsx:97` (and now the collaborate-page download button).
- Totalum launch: single-attempt POST, no idempotency key (previously documented; unchanged).

---

## 2. Exactly where requirements, decisions, or constraints are lost or contradicted

Classification: **IMPL** = underlying implementation defect · **INSTR** = defect in instructions sent to models · **HANDOFF** = information exists but is dropped between stages.

| # | Class | Where the loss/contradiction happens | Evidence |
|---|-------|--------------------------------------|----------|
| RB-01 | HANDOFF | **The founder's verbatim idea never reaches the build brief.** `buildInitialBuildPrompt` has no idea parameter; `project.idea` is stored but no launch caller passes it. The idea survives only if the model copied it into a spec section — and a plan regeneration re-derives sections from the model's own prior output, not from the founder's words. | `prompt-builder.ts:121` (arity 3); call sites §1.6; test RB-01 ✅ |
| RB-02 | IMPL + INSTR | **"Not defined yet:" placeholders are mandated by the prompt and then shipped to the builder as mandatory.** `specification.ts:100` instructs the model to write placeholders for unknown fields; `prompt-builder.ts` has zero placeholder filtering (grep-verified — no `isPlaceholderValue`/`placeholder` logic). The brief then says e.g. "Pricing plans this product **must present and enforce**" followed by the placeholder question. | `specification.ts:100`; `prompt-builder.ts:195-198`; test RB-02 ✅ |
| RB-03 | IMPL | **A failed research stage reports completeness 100/100.** `getEmptyFindings` returns `completenessScore: 100` with empty gap arrays (comment: "no gaps found = perfect score"); the catch path at `research.ts:351` and orchestrator fallbacks (`orchestrator.ts:204, :492, :875`) persist that. Downstream UI cannot distinguish "researched and found nothing" from "research died." | test RB-03 ✅ |
| RC-04 | IMPL | **No requirement provenance or decision ledger.** Nothing in the data model distinguishes founder-authored text, AI-authored text, approved decisions, or rejected suggestions inside `specification` sections. Only capability toggles (`suggestedFeatures[].enabled`) are structured decisions. An approved price lives in prose and can be rewritten by any section regeneration. | types at `lib/types/specification.ts`; §1.4 |
| RC-05 | IMPL | **No contradiction detection anywhere in code.** Contradictions between sections can only be prevented by prompt instructions (cofounder's never-contradict cluster rule = INSTR mitigation). There is no reconciliation/validation stage before launch. | grep across `lib/analysis`, `lib/planning` — no validator exists |
| RC-06 | IMPL | **Silent heavy→legacy fallback** reports a degraded plan as success (see §1.2), so "which pipeline produced this spec" is unknowable after the fact. | `specification.ts:399-458`; log-only tell |
| RC-07 | HANDOFF | **Runtime capability knowledge is duplicated in four drifting copies** (SDK types, `router.ts:103-104`, `runtime-capabilities.ts:34`, hardcoded list in `prompt-builder.ts:82`). No stage validates the spec's promised integrations against the registry. Verified real gap: SDK payments support checkout/subscriptions/payment & payout reads — **no refunds or subscription cancel** — yet nothing stops a plan section from promising refunds; the brief would carry it to the builder verbatim. | `prompt-builder.ts:64-95`; runtime contract audit (earlier session) |
| RC-08 | IMPL (guarded) | **Plan regeneration would clobber the specification wholesale** (`pipeline-recovery.ts:114-153`), *but* every entry point refuses when a specification exists (`startProjectPipeline` 409 :236-238; `startPlanRegeneration` 409 :290-292; `recoverStalledPipeline` returns false :329). H-2 resolved: normal flow cannot overwrite a founder-approved plan. | `retry/route.test.ts` covers guard responses |

---

## 3. Problems confirmed by source code AND tests

| Defect | Source evidence | Test | Status today |
|---|---|---|---|
| RB-01 idea dropped at handoff | §2 row | `build-handoff-defects.test.ts` | pinned, green |
| RB-02 placeholders ship as mandatory | §2 row | same file | pinned, green |
| RB-03 failure → score 100 | §2 row | same file | pinned, green |
| Research truncation killed whole stage | `registry.ts` 4000-token cap, `attempt` never incremented | fixed this session; `json-parser.test.ts` (6 cases) | repaired |
| Regeneration cannot clobber an approved plan | guard lines §2 RC-08 | `retry/route.test.ts` | safe |
| Hook-order crash on collaborate | early return after hooks | repaired; type check green | repaired |

Baseline for regressions: `lib/planning` + `lib/analysis` suites were green at last run (11 files / 293 tests, plus the 4 new defect pins).

## 4. Problems only suspected (need verification before fixing)

- **H-A Declined suggestions reappearing in prose.** A disabled capability is listed as "declined," yet the same feature can live on in section text (chat regenerations don't cross-check `suggestedFeatures`). No code guard exists (fact), but no reproduced artifact yet — needs a staging scenario.
- **H-B Chat rewriting founder edits.** Whether plan-update streams preserve the founder's manual section text byte-for-word is unverified end-to-end; needs a staging test against a live project.
- **H-C Totalum brief size limits / followup-edit 4k cap.** Known open question from earlier sessions; unmeasured against worst-case plans.
- **H-D Concurrent-session clobbering.** `store.updateProject` is last-writer-wins for section edits; two tabs editing different sections may each drop the other. Needs a repro.
- **H-E Completeness score consumers.** RB-03's fix surface depends on who reads `completenessScore` (insights UI, gates); must enumerate before changing semantics.

## 5. Smallest safe implementation plan (dependency + risk order)

> **STATUS 2026-10-30: fixes #1–#3 and #5 (RB-01, RB-02, RB-03, RC-06) and #4 (RC-07) have landed** with the pinned tests flipped to regression tests, plus new provenance tests (`spec-provenance.test.ts`) and capability-drift tests (`prompt-builder.test.ts`). RB-02 keeps founder text verbatim (per the nothing-hidden rule) but reclassifies it via an OPEN QUESTIONS block; RC-07 now generates the brief's capability catalog from `runtime-capabilities.ts` and flags runtime-impossible claims (refunds/cancel/SMS) both in the brief and as an amber warning in Builder Review. Phase B (items RC-04/RC-05) remains gated on reviewer sign-off.

Nothing below creates a second pipeline, duplicates project state, touches credits, or changes billing.

1. **RB-01 (low risk, additive):** extend `buildInitialBuildPrompt` with an optional `originalIdea?: string`; render it as a fenced, injection-neutralized "THE FOUNDER'S ORIGINAL WORDS (authoritative intent)" block; pass `project.idea` at the four launch call sites. Flip RB-01 test.
2. **RB-02 (low risk):** in prompt assembly, route any line starting `Not defined yet:` out of mandatory sections into a single "OPEN QUESTIONS — do not build placeholders for these" tail block. Flip RB-02 tests.
3. **RB-03 (low-medium):** make failed research honestly report (score 0 + status field, or reuse artifact `status: "failed"`); check `completenessScore` consumers first (H-E). Flip RB-03 test.
4. **RC-07 (medium):** single source of truth — generate the prompt-builder capability block from `runtime-capabilities.ts` (already tested); add a validation that rejects spec integration lines naming unsupported operations (e.g. refunds) with a founder-visible flag rather than silently sending them.
5. **RC-06 (medium):** mark specs born from the legacy fallback (`specification` gains a `pipeline: "legacy"|"enhanced"` provenance field; surface in collaborate UI). No behavior change to generation.
6. **RC-04/RC-05 (large — the brief's Phase B):** decision/provenance model and contradiction reconciliation. **Deliberately last**: it only makes sense once 1–5 stop the biggest silent losses, and it is where most regression risk lives. Requires reviewer sign-off on the Phase 1 model before code.

## 6. How each fix is tested without breaking existing functionality

- 1–3: flip their pinned tests in `build-handoff-defects.test.ts` (assert fixed behavior), keep all existing `prompt-builder.test.ts` cases unchanged (they pass today and must pass after).
- 1: new case — idea text containing injection phrases is neutralized but preserved (pattern exists in `buildRuntimeIntegrationsBlock` tests).
- 2: new case — a clean plan emits no OPEN QUESTIONS block; placeholder in `seoPlan`/`runtimeIntegrations` is diverted, real text verbatim.
- 3: orchestrator-level test that a thrown model call persists an artifact founders see as failed, not perfect; research suite baseline (293 tests) guards no-consumer-breakage.
- 4: test asserting every namespace/method in the generated capability block exists in `runtime-capabilities.ts` (drift can then fail CI); `runtime-capabilities.test.ts` stays.
- 5: retry-route + pipeline-recovery tests unchanged (guards verified in RC-08 stay green).
- 6: contract tests per stage boundary (input/output schema) before any model change; no existing test weakened.
- All staging verification uses free models only; no paid production builds; no migrations (5 adds an optional field only — no destructive change).

## Reviewer's ten evidence questions — short answers

1. **Where is the original founder idea stored?** `project.idea` (`pipeline.ts:353`), read by analysis and `plan-analysis-service.ts:86` (founderVision) — but never by the build brief (§2 RB-01).
2. **Where are approved decisions stored?** Prose inside `project.specification` sections + `suggestedFeatures[].enabled` toggles. No decision records.
3. **Can the system distinguish founder-approved requirements from AI suggestions?** Only for capability toggles; not for section content (RC-04).
4. **Can rejected suggestions reappear?** Structurally yes in prose (no guard); toggle state itself is respected at build (RC-08-adjacent code `prompt-builder.ts:38-45`). Repro pending (H-A).
5. **Single authoritative requirements representation?** No — the spec prose is authoritative but unstructured; capabilities, integrations, and preferences are partially structured.
6. **Does every stage get the context it needs?** No at handoff (RB-01); within the enhanced pipeline stages pass structured outputs (orchestrator), but the silent fallback bypasses them (RC-06).
7. **How are contradictions detected today?** They aren't, in code. Only prompt-level never-contradict instructions for section clusters (RC-05).
8. **How does Atai verify Runtime/Totalum capability availability?** It doesn't — four drifting hardcoded lists; only human-docs cross-check exists (RC-07).
9. **How does the final specification reach the generator?** `buildInitialBuildPrompt` → `launchProject` POST to Totalum VCAAS, identical builder used by all four call sites (+ the download button, so founders can see exactly what the builder sees).
10. **Which defects are test-reproducible?** RB-01/02/03 today; H-A…H-E need staging scenarios (§3/§4).

---

**Bottom line for the reviewer's distinction:** the three largest confirmed losses (RB-01 idea, RB-02 placeholders, RB-03 false-perfect research) are **implementation and handoff defects**, not prompt-wording problems — longer prompts would not fix any of them. The contradiction/decision problems (RC-04/05) need both: a structured decision model (implementation) and section-cluster rules already present (instructions) that must become code-enforced validations. Fixes 1–3 are surgical and test-flippable; Phase B should wait for their landing and reviewer re-review.
