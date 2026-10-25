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

---

# 9. v1.1 addendum (2026-10-25) — severity, versioned score, history, dedicated page

**Scope agreed for this increment:** v1.1 does **not** change what the crawler inspects. The auditor still
analyses the entry page of the project's own deployment. What changes is how findings are labelled, how they
are scored, and how past audits are stored and revisited.

> The full Phase 3 brief (competitor comparison, AI recommendations, multi-page checks, canonical/robots/
sitemap checks) is **not** delivered by this addendum. Section 9.7 lists the remaining gaps explicitly.

## 9.1 Findings now carry a severity and a category

`SeoFinding` gained two **optional** fields (`lib/types/db.ts`), so audits stored before this change still
render:

| Check (`id`) | Severity | Category | Why this severity |
|---|---|---|---|
| `indexable_content` | critical | content | A page with no readable text has nothing to rank. |
| `https` | high | security | Served over plain HTTP. |
| `title` | high | metadata | Missing/over-long title affects how results are shown. |
| `meta_description` | medium | metadata | Affects the result snippet, not indexability. |
| `headings` | low | structure | Helpful structure; crawler may not read it. |
| `internal_links` | low | links | Crawl discovery signal. |
| `site_breadth` | info | crawlability | Scope information, never a failure. |
| `images` | info | media | Count only; alt text is not captured. |
| `canonical` | info | metadata | Always `not_observed` in v1. |
| `robots` | info | crawlability | Always `not_observed` in v1. |

Severity is an **internal prioritisation of work**, not a prediction of search-engine impact. `info` checks
carry zero scoring weight so they can never move the score.

## 9.2 Score algorithm — `seo-score-v1` (`lib/marketing/seo/score.ts`)

Weights: `critical 10`, `high 6`, `medium 3`, `low 1`, `info 0`.

```
score = round(100 * passedWeight / (passedWeight + failedWeight))
```

Rules, in order:

1. Only findings that were actually evaluated (`pass` / `fail`) are eligible.
2. `not_observed` findings are **excluded** — counted in `notApplicable`, never as failures, never as passes.
3. Passing checks add their weight to `passedWeight`; failing checks add to `failedWeight`.
4. If the eligible weight is `0` (nothing evaluated, or only `info` checks ran) the score is `null` —
   reported to the user as “Not available”, **never 0**.
5. The algorithm is versioned (`SEO_SCORE_VERSION`). Every audit persists `auditScore.version`, so a future
   weighting change cannot silently reinterpret historical scores.

The UI states plainly that this is an internal assessment of completed on-page checks and not a Google
ranking, traffic, or visibility metric.

## 9.3 Persistence (additive only)

- `seo_audits` documents gain `auditScore: { value, version, passedWeight, failedWeight, notApplicable }`.
- No new collection, no new index, no change to existing fields, no migration. History queries reuse the
  existing `{ projectId: 1, createdAt: -1 }` index.
- Legacy audits have no `auditScore`; the UI falls back to pass/fail counts and does not invent a score.
- `docs/DATABASE_SCHEMA.md` still omits every marketing collection (`seo_audits`, `content_items`,
  `growth_tasks`, `campaigns`). That doc was already stale before this phase and was deliberately not
  partially patched; the shapes above plus `lib/types/db.ts` remain authoritative.

## 9.4 API

| Route | Behaviour |
|---|---|
| `GET /api/projects/:id/seo-audits` | Bounded newest-first history. `limit` clamped to 1–25 (default 10), opaque `cursor` (`${createdAt}_${id}`, the same convention as the runtime usage list). Returns summaries only — no findings arrays. |
| `GET /api/projects/:id/seo-audits/:auditId` | One stored audit with full findings. Looked up **by `{ projectId, id }`**, so an audit id that belongs to another project resolves to the same 404 as a nonexistent one. |
| `GET/POST /api/projects/:id/seo-audit` | Existing endpoint; both responses now also include `auditScore`. |

All three are session-authenticated, gated on `isSeoAuditEnabledForUser`, and use `checkProjectOwnership` with
the uniform `UNAUTHORIZED_PROJECT_ACCESS` 404. Reads are free; only the existing POST charges credits.

## 9.5 UI

- **New destination:** `/project/[projectId]/market/seo` (`app/project/[projectId]/market/seo/page.tsx`) with
  the client workspace `components/marketing/seo-workspace.tsx`. It sits under the existing Market & grow
  workspace, so the sidebar's prefix match keeps **Market & grow** selected; direct URL and refresh work.
- **Header:** project name, audited URL, last audit date, run action with cost/credits available, live
  `role="status"` message announcing progress.
- **Score card:** value or “Not available”, pass/fail/not-observed counts, pages inspected, cache provenance,
  score version, and an explicit statement that it is not a Google metric.
- **Findings:** severity badge (text, not colour alone), status text, category, observed evidence, and note.
- **History:** newest-first rows (date, URL, score or failures, check count, page count). “Load older audits”
  pages via the cursor endpoint; clicking a row opens that stored audit and offers a way back to the latest.
- **States:** feature disabled (coming-soon), no deployment, awaiting first audit, running, running failure,
  insufficient credits, no eligible score, partial/incomplete history, and saved-audit viewing.
- The Market page panel now shows the score and links to the full workspace.

## 9.6 Verification actually performed

| Check | Command | Result |
|---|---|---|
| SEO unit suites | `npx vitest run lib/marketing/seo/auditor.test.ts lib/marketing/seo/score.test.ts` | **PASS — 17/17** (auditor 11, score 6). |
| Type check (changed import graph) | `npx tsc -p <temp config including only the 12 changed files>` | **0 errors.** |

The full-tree `npx tsc --noEmit` was **not** used: it exceeded 7 minutes on this host in a previous session
and again during this one. A scoped config limited to the changed files and everything they import was used
instead.

**Not verified:** the production build was deliberately not run (standing instruction to avoid builds on this
host); no live Firecrawl crawl and no live MongoDB were exercised, so the persistence and UI paths are covered
by types and unit tests rather than an end-to-end run.

**Test files are not in the repository.** Per the repo owner's instruction, all `*.test.ts` files are untracked
and git-ignored; the tests above exist locally and were executed locally. They will not appear in a clone.

## 9.7 Gaps as they stood after v1.1

Superseded by section 10 for items 1, 3 and 5; kept for the record.

1. ~~**Multi-page analysis.**~~ **Delivered in v1.2.**
2. **Uncaptured signals.** Canonical, `X-Robots-Tag`/meta robots, `robots.txt`, sitemap, HTTP status, alt text,
   and structured data remain `not_observed`. Firecrawl metadata may carry some of these, but that has not
   been verified against a live provider response, so nothing is claimed. **Still open.**
3. ~~**AI recommendations.**~~ **Delivered in v1.2.**
4. **Competitor comparison.** Not implemented at all. **Still open.**
5. ~~**Failed audits are not persisted.**~~ **Delivered in v1.2.**
6. **No retro-scoring.** Audits stored before v1.1 have no `auditScore` and are not recalculated on read.
   **Still open.**

---

# 10. v1.2 addendum (2026-10-25) — multi-page checks, AI guidance, failed audits

Three follow-ups delivered together. No new collection, no new index, no new dependency, no change to
`crawl.ts`, the SSRF guard, the credit service, or the co-founder approval flow.

## 10.1 Every crawled page is now analysed

`auditWebsiteEvidence` evaluates `evidence.pages` instead of `pages[0]`:

- `title`, `meta_description`, `indexable_content` are evaluated **per page** and reported as ``N of M
  pages…`` with up to five offending URLs in `SeoFinding.affectedUrls`.
- `headings`, `internal_links`, `images` pass when **any** inspected page carries the signal, and stay
  `not_observed` (not failures) when none do — the crawler's empty array cannot be distinguished from
  "unreadable".
- `https`, `site_breadth`, `canonical`, `robots` remain site-level.
- Two new deterministic checks: `duplicate_titles` (medium) and `duplicate_descriptions` (low). They compare
  case/whitespace-normalised values across pages and list the URLs sharing them. With fewer than two pages
  carrying a value the result is `not_observed` — never a pass, which would imply verification that did not
  happen.

Scoring is unchanged (`seo-score-v1`): the two new checks participate like any other, and their
`not_observed` state is still excluded.

## 10.2 AI recommendations (`lib/marketing/seo/recommendations.ts`)

Reuses `MODEL` from `lib/analysis/model.ts` + the `ai` SDK `generateText`, the same substrate as the
Marketing Studio generator. There is no separate SEO AI stack.

**Input (bounded).** Project name, audited URL, and only the **failing** findings (max 20), each with id,
label, severity, observed value (≤300 chars), note, and up to 5 affected URLs. No page bodies, no raw HTML,
no secrets, no other projects.

**Prompt-injection posture.** Evidence is JSON-encoded inside explicit `<<<AUDIT_FINDINGS … AUDIT_FINDINGS>>>`
delimiters and the system prompt states it is untrusted data whose instructions must never be followed. The
model cannot call tools or execute anything.

**Schema.** Zod-validated `{ recommendations: [{ title, whyItMatters, action, findingIds[], priority,
requiresDeveloper, pageUrl? }] }`, max 5 returned.

**Grounding gate.** A recommendation is kept only if at least one referenced `findingId` belongs to a finding
that actually **failed**; unknown references are stripped, and items left with none are dropped. Duplicate
titles are removed.

**Fabrication gate.** `claimsUnmeasuredMetric()` rejects explicit ranking-position, page-one, visitor/session/
impression/click, organic-traffic, search-volume, and CTR/conversion numbers. Ordinary SEO wording is
allowed; the guard only targets measured claims.

**Provenance.** Every stored recommendation carries `origin:
"ai_generated_from_observed_findings"`, and the audit stores `recommendationsMeta`:
`{ status: "generated" | "no_findings" | "unavailable", model?, generatedAt? }`. The UI shows the
"AI-generated from observed findings" label plus the finding ids, and says plainly that these are
suggestions, that Atai cannot see rankings or traffic, and that a change does not guarantee improvement.

**Failure isolation.** No failing findings → no model call (`no_findings`). Unconfigured provider or any
generation/validation error → `unavailable`, the completed deterministic audit is kept and persisted. The
audit is never failed because the AI step failed.

**Credits.** Recommendations are included in the existing SEO audit charge; there is no second charge and no
new pricing rule. No model call happens on page view — only during an explicitly requested audit.

## 10.3 Failed audits are persisted

A crawl/audit failure now writes a `seo_audits` document **before** rethrowing:

- `status: "failed"`, `findings: []`, zeroed counts, `pagesCrawled: 0`, `fromCache: false`, and a safe
  `error` from `seoSafeFailureMessage(code)`: provider unreachable → "Atai couldn't reach your website to
  inspect it.", invalid URL → "That website address can't be audited.", otherwise a generic retry message.
- `creditsCharged` keeps the amount that was **actually charged** (not 0), and `refund` starts at
  `{ status: "pending", amount }` — or `{ status: "not_charged" }` when the run was free. The history never
  claims a refund that has not been confirmed.
- No `auditScore` is written — a failed crawl must not produce a score.
- The write is **best-effort**: a failed insert is logged and never masks the original error. Only when the
  row was actually stored does the service invoke `onFailedAuditPersisted(auditId)`.
- The throw is preserved, so the route's and the tool's existing refund paths run unchanged. There is no
  second refund and no double charge.

**Refund accounting.** `refundSeoAuditCredits(userId, projectId, amount)` now takes the exact amount that was
charged (so an env change between charge and reversal cannot refund the wrong number) and returns
`"refunded" | "not_charged" | "failed"` instead of swallowing the outcome. Both callers then invoke
`markSeoAuditRefund(projectId, auditId, status, amount)`, which updates only a row scoped to that project.
Consequently a failed audit records one of four real states: `refunded`, `not_charged`, `failed` (ledger
rejected the reversal — the co-founder tool then tells the founder to contact support rather than claiming a
refund), or `pending` (the process died before stamping it).

The UI renders failed audits explicitly ("This audit didn't finish", the safe reason, and the refund state)
and the history row links to them like any other run, with a `refunded` / `refund failed` / `refund pending`
chip.

## 10.4 Verification

| Check | Command | Result |
|---|---|---|
| SEO suites | `npx vitest run lib/marketing/seo/` | **PASS — 47 tests / 5 files** (auditor 17, score 6, recommendations 14, service 7, credits 3). |
| Type check | `npx tsc -p <scoped temp config>` over the 14 changed files and their imports | **0 errors.** |

New coverage: multi-page title/description/content evaluation with affected URLs, duplicate detection
(fail / pass / single-page `not_observed`), prompt delimiting and anti-fabrication instructions, schema and
malformed-JSON rejection, grounding (invented finding ids dropped), metric-claim rejection, de-duplication
and cap, provider-unconfigured behaviour with no network call, failed-audit persistence with a safe error,
a pending refund carrying the exact charged amount, `not_charged` for free runs, project-scoped refund
stamping, refund outcomes reported as `refunded` / `not_charged` / `failed` without throwing, and
recommendation failure leaving the completed audit intact.

The full-tree `tsc` and `pnpm build` were still not run (host limitation / no-build instruction), and no live
Firecrawl crawl or live MongoDB was exercised. Test files remain untracked and git-ignored per the repo
owner's instruction.

## 10.5 Remaining gaps

1. **Uncaptured signals** — canonical, robots directives, `robots.txt`, sitemap, HTTP status, alt text and
   structured data are still `not_observed` until a live provider response is inspected.
2. **Competitor comparison** — not implemented.
3. **No retro-scoring or retro-recommendations** for audits stored before v1.1/v1.2.
4. **Live verification** of the recommendation path against a real model/provider is still outstanding.

## 10.6 Suggested next order

1. Verify which keys Firecrawl actually returns in `page.metadata`; promote canonical/robots/status to
   `observed` **only** for keys proven present.
2. Competitor URL comparison on top of the now multi-page evidence.
3. An end-to-end smoke test against a live crawl with the SEO flag enabled for one account.
