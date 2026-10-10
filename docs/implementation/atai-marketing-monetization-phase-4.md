# Atai Marketing & Monetization — Phase 4 implementation report

**Phase:** W3 — AI Marketing Studio v1 (draft-only marketing copy, in the founder's own brand voice)
**Date:** 2026-10-10
**Branch:** `main` (changes left uncommitted for review — nothing was committed, pushed, or deployed)
**Predecessor:** `docs/implementation/atai-marketing-monetization-phase-3.md` (Phase 3 — SEO & Visibility)
**Roadmap source:** Phase 1 audit section 14 — W3 (prerequisite W1 satisfied in Phase 2)

---

## 1. What was implemented (production code, not a plan)

| Area | Deliverable | Files |
|---|---|---|
| Durable content history | New additive `content_items` collection (raw Mongo, dual `_id: ObjectId` + string `id`, indexes: `content_items_id_unique` unique+sparse, `{projectId,updatedAt}`, `{userId,createdAt}`, `{parentContentId,version}`). NEVER embedded in `projects`. | `lib/types/db.ts` (`ContentItemDoc`, `StudioTemplate`, `ContentItemStatus`), `lib/db/collections.ts` (`contentItemsCol` + index block) |
| Content-vs-spec-prose guard | Every stored draft carries `origin: "ai_generated_marketing_content"` and `kind: "marketing_copy"`, structurally distinct from the founder-authored `specification` plan prose. There is **no publish/schedule field at all** (publishing needs the W4/W5 job substrate). | `lib/types/db.ts`, `lib/marketing/studio/service.ts` |
| Deterministic prompt layer | PURE, reproducible brand-voice derivation + template prompt assembly with an explicit anti-fabrication instruction (no invented numbers/prices/rankings/results). Separated from the single network call so it is unit-testable without the model. | `lib/marketing/studio/generator.ts` (+ test) |
| Generation service | `generateMarketingDraft` reads the project, derives voice from existing plan fields, runs ONE bounded `generateText` via the repo's canonical `MODEL` handle, persists a v1 draft. `reviseContentItem` appends an immutable next version (free, non-destructive). `listContentItems` tenant-scoped read. | `lib/marketing/studio/service.ts` (+ test) |
| Credit wiring | Cost via env `STUDIO_CREDIT_COST` (default 10); charge/refund reuse the shared credit service with a project-attributable reference; charge is **idempotent on the approved pending-action id** (durable key, not a fresh random one); zero-cost skips the ledger; refund never throws. | `lib/marketing/studio/credits.ts` |
| Feature flag (default OFF) | `isStudioEnabledForUser(userId)` — same env + deterministic-percent convention, **defaults OFF**; hard-on / kill-switch / fail-safe garbage→off. When off the route falls back to the exact coming-soon page and the tool refuses loudly. | `lib/marketing/feature-flags.ts` (+ test) |
| §6 Co-founder tool | CONFIRM-tier `generate_marketing_copy`: `prepare()` flag/provider/ownership/affordability-gates and prices a pending action WITHOUT generating or charging; `executeApproved()` charges (idempotently), generates one draft, persists it, refunds on failure; returns `navigation: { target: "studio" }`. Never publishes. | `lib/cofounder/tools/studio.ts` (+ test), `tool-registry.ts`, `schemas.ts` (`generateMarketingCopySchema`), `types.ts` (`marketing_content` result type) |
| Direct API | `/api/projects/:id/content-studio` — GET lists drafts (free, read-only); POST generates one draft (charged, refunded on failure); PATCH saves an edited version (free, non-destructive). Session-auth, fail-closed ownership (uniform 404), rate-limited, flag-gated, provider-gated. **Input is a fixed template + optional brief — no client-supplied URL or model.** | `app/api/projects/[id]/content-studio/route.ts` |
| Studio surface | `/project/[projectId]/studio` page mirroring the market page (flag-gated, coming-soon fallback, viewing is free); `StudioView` lists drafts with an "AI draft · not published" badge, a fixed template picker + brief, generate + edit-as-new-version actions, and an honest "brand voice derived from your plan; nothing is measured" note. | `app/project/[projectId]/studio/page.tsx`, `components/marketing/studio-view.tsx` |
| §69 Navigation registry | New project target `studio` → `/project/[id]/studio` (the AI still never authors an href). | `lib/navigation/routes.ts` (+ test) |

No new dependencies, no new secrets, no changes to the `specification` schema, no changes to shared billing schema/auth/build logic. SEO cost precedent reused: `AI_UNAVAILABLE` added to the `ErrorCode` union (a code `respond.ts` already emitted at runtime but that was never in the type — an additive, feature-connected fix).

## 2. AI / brand-voice approach (honest, derived-from-plan)

The audit established that `specification.brandIdentity` is a **single free-text string** and there is **no dedicated brand-voice field**. Rather than invent a spec field (a schema/prose change), `deriveBrandVoice` assembles a compact voice from the plan sections that already exist — `brandIdentity`, `valueProposition`, `marketPositioning`, `marketingPlan`, `targetUsers` — and reports which contributed (`brandVoiceSources`) so the UI can be truthful that the voice is **derived from the founder's own plan**, not a stored preference or a measured signal. Generation reuses the verified one-shot path (`MODEL` from `lib/analysis/model.ts` + `ai`'s `generateText` with an `AbortSignal.timeout`), the same approach the existing marketing-playbook route uses — no model-registry reimplementation, no new provider surface.

The prompt is built from four fixed, product-owned templates only (`landing_hero`, `feature_blurb`, `email_welcome`, `ad_headline`). The AI fills scaffolds; it cannot invent a template, a kind, or a publishing action.

## 3. Trust posture (carried from Phase 2 / Phase 3)

- Output is always an **AI DRAFT** — persisted with `status: "draft"`, `origin: "ai_generated_marketing_content"`, and an explicit note "not published, and not a measured result."
- The system prompt **forbids fabricating** numbers, prices, statistics, rankings, reviews, testimonials, or claims about results; if a fact isn't provided the model is told to write around it.
- Editing is **immutable versioning** (v2, v3 … chained by `parentContentId`), never an overwrite, so nothing the founder approved is silently replaced.
- **No publish/scheduling capability exists** anywhere in the code, UI, or tool — the roadmap defers it to the job substrate (W4/W5); this phase deliberately ships none.

## 4. Security posture actually applied

- **No new attack surface.** The generation input is a closed template enum + bounded optional brief; there is no client-supplied URL, model id, or provider credential path, so no SSRF/proxy surface is opened (contrast Phase 3, where the audited URL is the project's own recorded production URL).
- **Ownership fail-closed everywhere.** Page: `requireOwnedProject` (uniform 404). API: `checkProjectOwnership` → uniform 404 with a `UNAUTHORIZED_PROJECT_ACCESS` message. Tool: `ownedProject(ctx, projectId)` with the session `ctx.user.id`. The generation service ALSO re-asserts `project.userId === userId` as defense in depth, and refuses WITHOUT calling the model when it fails (asserted in tests). **No client-supplied `userId` is ever trusted** (schema `.strip()`s unknown keys; tests prove a session id reaches the service).
- **Confirmation is real.** `generate_marketing_copy` is `CONFIRM`: `prepare()` mutates/charges/spends NOTHING (no generation) — only prices a pending action; the charge + generation happen in `executeApproved()` after the framework's atomic claim, so double-click/retry cannot double-execute or double-charge.
- **Credits are honest and reversible.** Charged only for a real generation attempt; idempotent on the pending-action id so a retried approval can't double-spend; any failure refunds through a project-attributable reversal; zero-cost config skips the ledger.
- **Rate limited** at 20 generations / hour / user.
- **Flag server-side only**, default OFF; no `NEXT_PUBLIC_*` exposure.
- **Registry invariant preserved.** The exact-set test now includes `generate_marketing_copy` (CONFIRM, has `prepare`+`executeApproved`, no `execute`); forbidden-capability and risk-ladder tests still pass.

## 5. Out-of-scope discipline

Not built, not touched: publishing/scheduling, channels/social posting, image/creative generation (reuses existing visuals only in spirit — not wired here), A/B testing, analytics ingestion, campaign execution, a tasks system, or any change to the `specification` schema or shared billing/auth/build internals. The Studio is intentionally NOT flipped to a live workspace nav link while its flag defaults OFF — the route is reachable and the co-founder tool navigates to the registered `studio` target; a permanent nav link waits for the operator to enable it (documented in §7).

## 6. Verification outcomes (actual, this machine)

All commands run on this Windows host (`C:\Users\USER\Desktop\mirrorsiteai`). No CI, no deploy, no production build was executed (see §7).

**Full test suite** — `npx vitest run`
- Result: **`Test Files 87 passed (87)` · `Tests 1122 passed (1122)`** (vitest exit `0`; ~220s). This is the first fully-green full-suite record for this workspace across Phases 2–4.
- Every Phase 4 suite is included and green: `marketing/studio/generator` (9), `marketing/studio/service` (7), `cofounder/tools/studio` (11), `cofounder/tool-registry` (10), `marketing/feature-flags` (15), `navigation/routes` (7); the Phase 3 suites (`cofounder/tools/seo` 9, `marketing/seo/auditor` 8) stayed green.

**Phase 4 type check** — scoped `tsc --noEmit` over the new/changed files (`lib/marketing/studio/*`, the tool, the API route, the page, the view, `routes.ts`, `feature-flags.ts`, `errors.ts`, `types/db.ts`, `db/collections.ts`, `cofounder/{schemas,types,tool-registry}.ts` and their tests)
- Result: **clean (exit 0)**.
- The tree-wide `tsc` and `next build` were NOT run — pathologically slow / broken on this host (Turbopack worker-spawn failures), same constraint as Phases 2–3.

**Two fixes found during verification (both applied):**
1. *(in scope)* `lib/errors.ts` — adding `AI_UNAVAILABLE` to the `ErrorCode` union left the parallel `STATUS_BY_CODE: Record<ErrorCode, number>` map incomplete; the scoped type check caught `TS2741`. Added `AI_UNAVAILABLE: 503` (consistent with the other `*_UNAVAILABLE` codes). `ERROR_MESSAGES` already had it, and `lib/api/respond.ts` had been emitting the code at runtime before it was a typed union member.
2. *(out of scope — disclosed)* `lib/analysis/collaborate-credits.ts` — the full suite reported 2 failures in an **earlier-phase** file: `collaborate-credits.test.ts` imports `collaborationIdempotencyKey`, but that helper was declared `function` (module-private) instead of `export function`. The helper's output already matched the test's expected key string exactly, so the sole cause was the missing `export`. I added the keyword (zero behavior change; existing internal callers untouched) to clear a failure that otherwise pollutes the shared suite and would be misread as a Phase 4 regression. It does not connect to the Studio — revert if you prefer that area stays untouched.

**Targeted re-confirmation** — `npx vitest run` over `collaborate-credits`, studio generator/service/tool, `tool-registry`: **`5 files / 48 tests passed`**, with `collaborate-credits` flipping from 2 failed → green.

**NOT claimed:** no live-MongoDB integration run, no live model call, no `pnpm build`, no deploy, no production smoke test. The pure generator + service + tool contract are unit-tested against a mocked model and store.

## 7. Known limitations / what is NOT claimed

- Compiles and its pure generator + service + tool contract are unit-tested with mocked model/store; **not** smoke-tested against a live MongoDB or a live model call this session.
- Brand voice is derived from existing plan prose; if a project's plan is sparse, drafts fall back to "neutral, specific to the product name" — an honest limitation, not a fabricated persona.
- No publish/scheduling (by design). Reaching a live nav entry and any "send/publish" flow requires the W4/W5 job substrate.
- A green production build has not been demonstrated on this host this session (same environmental Turbopack/`tsc` constraints as Phase 2 and Phase 3); CI is the first real build check.

## 8. Phase 5 handoff

1. **Job substrate** (Phase 2 §5 / Phase 3 §4, still the gate): a persisted job collection with atomic claim (mirroring pending-actions) BEFORE publish/scheduling, recurring SEO crawls, or campaign execution.
2. **Studio v1.1** within the same draft-only boundary: content collections/folders, per-template history, and a read-only "draft → plan-reference" link — no external posting.
3. **Visitor analytics ingestion** (opt-in, privacy posture) so Growth Overview `siteVisitors` becomes measured and Studio drafts can be tied to real outcomes.
4. Only after a publish substrate: a separate HARD_CONFIRM `publish_content` capability with its own flag and audit trail — never folded into this draft tool.
