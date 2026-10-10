# Atai Marketing & Monetization — Phase 3 implementation report

**Phase:** W2 — SEO & Visibility v1 (durable, crawl-based on-page audits of a project's OWN deployed URL)
**Date:** 2026-10-10
**Branch:** `main` (changes left uncommitted for review — nothing was committed, pushed, or deployed)
**Predecessor:** `docs/implementation/atai-marketing-monetization-phase-2.md` (Phase 2 — Growth Overview)
**Roadmap source:** Phase 1 audit section 14 — W2 (SEO & Visibility)

---

## 1. What was implemented (production code, not a plan)

| Area | Deliverable | Files |
|---|---|---|
| Durable SEO history | New additive `seo_audits` collection (raw Mongo, dual `_id: ObjectId` + string `id`, id-index + `{projectId,createdAt}` + `{userId,createdAt}` indexes). SEO history is NEVER embedded in `projects`. | `lib/types/db.ts` (`SeoAuditDoc`, `SeoFinding`, status unions), `lib/db/collections.ts` (`seoAuditsCol`, index block) |
| Deterministic auditor | Pure function turning the Firecrawl `WebsiteEvidence` already produced into on-page findings with fixed, reproducible rules. **No AI, no network.** Every uncapturable signal is `not_observed`, never guessed. | `lib/marketing/seo/auditor.ts` (+ test) |
| Crawl service | Thin wrapper that runs the SSRF guard then the existing bounded crawl; normalizes failures to safe `AppError` codes. Reuses the shared 7-day Firecrawl cache (surfaced as `fromCache`). | `lib/marketing/seo/crawl.ts` |
| Audit orchestration | `runSeoAudit({ userId, projectId, url, creditsCharged })` — crawl → audit → persist one `completed`/`failed` doc; `getLatestSeoAudit(projectId)` for read-only display. | `lib/marketing/seo/service.ts` |
| Credit wiring | Cost read from env (`SEO_AUDIT_CREDIT_COST`, default 15); `charge`/`refund` reuse the shared credit service with a project-attributable ledger reference; zero-cost skips the ledger; refund never throws. | `lib/marketing/seo/credits.ts` |
| Feature flag (default OFF) | `isSeoAuditEnabledForUser(userId)` — same env + deterministic-percent convention as Phase 2, but **defaults to 0% (OFF)**; hard-on / kill-switch / fail-safe garbage→off. When off, both the route and the tool refuse loudly. | `lib/marketing/feature-flags.ts` (+ test) |
| §6 Co-founder tool | CONFIRM-tier `run_seo_audit` registered in the closed registry: `prepare()` validates/flag-gates/ownership/deploy/affordability and prices a pending action WITHOUT crawling or charging; `executeApproved()` charges, crawls the project's OWN recorded production URL, audits, persists, and returns a structured `navigation: { target: "market" }`; refunds on any failure. | `lib/cofounder/tools/seo.ts` (+ test), `tool-registry.ts`, `schemas.ts`, `types.ts` (`seo_audit` result type) |
| Direct API | `GET` returns the latest stored audit (free); `POST` runs a fresh audit (charged). Session-authenticated, fail-closed ownership (uniform 404), rate-limited, flag-gated, provider-gated, deploy-gated, affordability-gated. **The audited URL is only ever the project's own recorded production URL — the client cannot supply a URL.** | `app/api/projects/[id]/seo-audit/route.ts` |
| Market UI section | `SeoAuditPanel` renders the latest findings with pass/fail/not-observed badges and an honest "run a fresh audit" action (POST → toast → refresh); disabled state when the flag is off or the project has no live deployment. Takes `projectId` as an explicit prop (no DOM probing). | `components/marketing/seo-audit-panel.tsx`, `app/project/[projectId]/market/page.tsx` |

No new dependencies, no new secrets, no schema changes to existing collections, no new auth/credit primitives, no new job platform. `pnpm`/Next/React/Mongo versions unchanged.

## 2. Metric-trust continuation (carried from Phase 2's policy)

The auditor is the SEO embodiment of the Phase 2 rule "never present an estimate as a measurement." Concretely:

- **observed** findings (`https`, `title`, `meta_description`, `headings`, `internal_links`, `indexable_content`, `site_breadth`, `images`) are pass/fail ONLY when the evidence actually carries the field; the finding stores the concrete observed value so the UI shows WHY.
- **`not_observed`** findings (`canonical`, `robots.txt`/sitemap) reflect signals the normalized markdown-only evidence does not contain. They are NEVER rendered as failures and NEVER drive a recommendation — we do not guess what the crawler could not see.
- **No rankings, traffic, conversions, or "position #N" claims exist as fields at all.** The serialized findings are asserted (in tests) to contain none of `rank|traffic|page one|visitors`.
- `deriveRecommendations` produces guidance from **failing observed checks only**, each labeled `basis: "observed_failures"` — deterministic rule output, explicitly not an AI estimate.

## 3. Security posture actually applied

- **SSRF/abuse closed by design.** The POST body schema is `z.object({}).strip()` — it accepts NO fields. The crawled URL is read from the project record (`project.deployment.status === "success" ? productionUrl : undefined`), never from client input. Independently, `crawl.ts` re-runs the existing `assertPublicHttpUrl` SSRF guard before any network call.
- **Ownership is fail-closed on every path.** Page: unchanged `requireOwnedProject`. API: `checkProjectOwnership` → uniform 404 (`UNAUTHORIZED_PROJECT_ACCESS` message) so a non-owner learns nothing about existence. Tool: `ownedProject(ctx, projectId)` with the session-built `ToolContext.user.id`. **No client-supplied `userId` is ever trusted** (asserted in tool tests: cross-tenant and forged-id cases).
- **Confirmation is real.** `run_seo_audit` is `CONFIRM` risk: `prepare()` mutates NOTHING (no crawl, no charge) — it only prices a pending action; the crawl/charge happen in `executeApproved()` after the framework's atomic claim (double-click/retry cannot double-execute).
- **Charges are honest and reversible.** Credits are consumed only for a real crawl attempt; any failure in the tool or route path refunds through the project-attributable reversal, and a zero-cost config skips the ledger entirely.
- **Rate limited** at 10 audit runs / hour / user.
- **Flag is server-side only** — no `NEXT_PUBLIC_*` exposure. Default OFF means the capability is unreachable until an operator opts in.
- **Registry invariant preserved.** The tool set stays a closed allow-list; the exact-set test was updated to include `run_seo_audit` (intentional, documented CONFIRM addition) and `get_growth_overview`; forbidden-capability and "every CONFIRM tool has prepare+executeApproved" tests still pass.

## 4. A4 — background-work decision (still honored)

Phase 2 recommended a durable job substrate BEFORE crawl/campaign features. This phase does not build one and does not pretend to: an SEO audit is **synchronous, user-initiated, bounded, and "happens only while you wait"** behind the Firecrawl cache. There is no fire-and-forget detached promise and no durability claim. If future phases add scheduled/recurring crawls, that requires the persisted-job-collection-with-atomic-claim substrate first — not an extension of any existing fire-and-forget path.

## 5. Verification outcomes (actual, this machine)

| Check | Command | Result |
|---|---|---|
| Phase 3 SEO unit suites | `npx vitest run lib/marketing/seo/auditor.test.ts lib/cofounder/tools/seo.test.ts lib/cofounder/tool-registry.test.ts` | PASS — auditor 8/8, `run_seo_audit` tool 9/9, registry 10/10 |
| SEO flag semantics | `npx vitest run lib/marketing/feature-flags.test.ts` (extended with an SEO default-OFF block) | PASS (growth + SEO flag blocks) |
| Full test suite | `npx vitest run` | **1078 passed / 1 failed** across 83 files. The single failure is `lib/runtime/router/router.test.ts` ("RuntimeRequestSchema exported from the shared contract barrel") — a 5000ms **import timeout under load**, in a file outside this phase's scope. Re-run in isolation it **passes (1898ms; 29/29)**. It is a concurrency flake while `tsc` hammered the machine, not a logic failure and not related to any Phase 3 file. |
| Full-tree type check | `npx tsc --noEmit` | **12 errors, ALL in files that are NOT part of this phase.** (1) `.next/types/.../assets/route.ts` — a committed route (HEAD `bf8d4a7`, "visuals") exports `GET_visuals_by_section`, an invalid Next route-handler name → generated-type `TS2344`; the source file is unmodified in the working tree. (2) `lib/billing/credit-valuation.ts` / `.test.ts` — `BigInt` literals vs a sub-ES2020 `target` → `TS2737`; both files are **untracked** (other in-progress work), not created or edited here. **Zero errors in any Phase 3 file** (`lib/marketing/seo/*`, `lib/cofounder/tools/seo.ts`, `app/api/projects/[id]/seo-audit/*`, `components/marketing/seo-audit-panel.tsx`, feature-flags, collections, types/db, schemas, tool-registry). Two independent full-tree runs produced the identical 12-error set, none in scope. A final scoped `tsc -p` over the SEO source + both edited test files (auditor/feature-flags) returned **0 errors**, closing the loop on the last test edits made after the full-tree runs. (Note: full-tree `tsc` is pathologically slow/hanging on this host — a symptom of the same resource exhaustion behind the Phase 2 build spawn failures — hence the scoped confirmation.) |
| Production build | `pnpm build` | **NOT re-run to completion this session.** Phase 2 recorded a reproducible environmental `TurbopackInternalError` on `app/globals.css` (`0xc0000142` Windows DLL-init failure during process spawn) unrelated to any changed file; the bundler could not be driven to completion on this Windows host, and re-attempting it was not authorized in this session. **No successful production build is claimed for Phase 3.** CI (`.github/workflows/ci.yml`) will run `pnpm build` on a clean Linux runner — that is the first real build verification and has NOT yet occurred. |

New tests cover: auditor pass/fail/`not_observed` boundaries (title length, absent fields → `not_observed` for headings/links vs `fail` for content), no-ranking/traffic serialization guarantee, determinism (identical evidence → identical findings), `deriveRecommendations` observed-failures-only; flag default-OFF / hard-on / kill-switch / rollout boundaries / fail-safe percent; tool prepare CONFIRM shape priced WITHOUT crawling or charging; flag-off / undeployed / insufficient-credits / cross-tenant refusals; `executeApproved` charges + audits the OWN recorded URL + returns `market` navigation with a session-derived userId; refund-on-failure; and no charge for a non-owner.

## 6. Out-of-scope discipline

Not built, not touched: SEO **publishing/scheduling**, content generation, keyword research, backlink/competitor tooling, campaign execution, analytics/visitor ingestion, a tasks system, or any change to billing internals, the shared billing-settings schema, auth, or core build logic. SEO cost is a local env knob (`SEO_AUDIT_CREDIT_COST`) rather than a change to the shared billing schema, deliberately, to avoid touching unrelated billing code.

Unrelated pre-existing working-tree changes were **preserved untouched** — including the `M` files in `lib/billing/*`, `lib/analysis/pipeline.ts`, several `app/api/projects/[id]/*` routes, `lib/planning/orchestrator.ts`, `lib/projects/project-actions.ts`, `lib/runtime/metering/charge.ts`, `lib/store/mongo-store.ts`, and untracked scratch artifacts (`credit-valuation.*`, `.or-routing-probe.mjs`, `.tmp-*.py`, `.baseline-test.log`). No destructive Git command was used; no commit, push, deploy, or production-config change was made.

## 7. Known limitations / what is NOT claimed

- The SEO surface compiles and its pure auditor + tool contract are unit-tested with mocked stores; it has **not** been smoke-tested against a live MongoDB or a live Firecrawl crawl in this session.
- The auditor reads the normalized evidence the existing crawler already returns; alt text, canonical, robots.txt/sitemap, HTTP status, and hreflang are genuinely out of that evidence's reach and remain `not_observed` — this is an honest coverage limit, not a bug.
- Type-check "clean" is asserted only for Phase 3's own files; the repo currently carries two **unrelated, pre-existing** tsc error clusters (see §5) that belong to other work and were deliberately not fixed to respect scope.
- A green production build has not been demonstrated on this host this session; treat "production-ready" as unverified until CI completes it.

## 8. Phase 4 handoff

In dependency order, consistent with the Phase 1 roadmap:
1. **Job substrate decision** (Phase 2 §5, reaffirmed §4) before any *scheduled* SEO, campaign, or recurring-crawl feature.
2. **Visitor analytics ingestion** (opt-in, privacy posture) so `siteVisitors` moves from `not_instrumented` to measured and SEO can correlate findings to real traffic.
3. **Payments result webhooks** for generated apps, so checkout-created gains completed-payment counterparts.
4. Optional SEO **v1.1** that stays within observed evidence: cache-busting guidance, per-page rollups once breadth > 1 is common, and a read-only "audit history" list — no publish/scheduling until (1) exists.
5. Roll the SEO flag out gradually (`SEO_AUDIT_ROLLOUT_PERCENT`) once real-crawl smoke evidence exists; it is intentionally default-OFF today.
