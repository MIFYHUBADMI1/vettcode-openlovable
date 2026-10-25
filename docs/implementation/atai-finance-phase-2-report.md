# ATAI Project Finance & Economics — Phase 2 Completion Report

**Project Usage Accounting, Provider Cost Attribution, and Economic Data Integrity**

Date: 2026-10-25 · Branch: `main` · Repo: `C:\Users\USER\Desktop\mirrorsiteai` (package `atai`)
Brief: Phase 2 workstream spec (Workstreams A–G, §4 non-goals, §5 tests, §6 verification, §7 discipline, §8 report, §9 acceptance)

---

## 1. Executive summary

Phase 2 makes project-level usage and cost data **trustworthy and discoverable** without inventing anything:

- **Explicit provider-cost status.** `runtime_usage.costMetadata.costStatus` is now persisted at write time (`confirmed` / `unavailable`; `estimated` reserved vocabulary — no adapter emits estimates because no documented price source exists) and derived read-time for historical rows. "Missing cost" is a status, never a silent 0.
- **Currency-purity fix.** Four existing rollups summed ANY numeric provider cost into a field called `providerCostUsd` — a Twilio UGX price inflated "USD" totals. All four now sum **USD only** and separately **count** (never sum) non-USD numeric-cost events. No FX conversion was applied: the repository has no approved exchange-rate source, so converting would have meant inventing one.
- **First-class project attribution completed** on the remaining ledger writers (SEO audit, Marketing Studio, Resources AI) — they previously carried only the legacy `referenceType/referenceId` pair. The runtime gateway, builds/reservations, deploy, agent, fork, infrastructure, collaborate, visual generation already stamp server-derived `projectId` (verified, matrix in §5).
- **Deterministic Studio refunds.** `refundStudioCredits(userId, projectId, intentKey?)` produces `studio_${intentKey}_refund` when the caller charged with the same intent key (the `charge.ts` discipline); the refine/variations routes thread the client `requestId` through. A retried failure path can no longer double-refund.
- **The project economics service.** New `lib/finances/project-economics.ts`: ledger is the ONLY source of credit consumption (gross / verified reversals / net, bucket-split `_sub`+`_perm` safe by amount-summing; funding credits never net); runtime_usage is the ONLY source of provider cost (per currency, per status, coverage ratio). Recognized revenue is an explicit `not_supported` — no profit/margin figure exists anywhere in Phase 2 output.
- **One new bounded, owner-gated endpoint** (`GET /api/projects/:id/economics`). No dashboards, no UI (§3F / §4).
- **Reconciliation readiness without touching history:** diagnostics (billable-usage-without-ledger-key count + sample requestIds, negative-net flag, non-USD event counts) surface gaps; zero backfills, zero rewrites. The deferred Dodo webhook replay worker and refund-netting were NOT implemented, per the brief.

Verification: scoped `tsc` exit 0; targeted suites 149/149; full suite **1428/1429 tests passing (1429 counted)**, the two failing files re-run and re-inspected (§10) — both pre-existing, unrelated to Phase 2. No commits made; the user's extensive WIP working tree is untouched except for the surgical Phase 2 lines listed in §3.

---

## 2. Initial state

- Branch `main`, HEAD `932293f`. Working tree heavily dirty with **user work-in-progress** (billing admin, SEO workspace, studio features, cofounder tools, docs, plus ~24 untracked feature files). All of it preserved; nothing reset, stashed, or reverted (§7 discipline).
- Phase 1 (universal 3,750-credits = US$1.00 valuation, project attribution core, Dodo sole-gateway, webhook integrity) already delivered and reported (`docs/implementation/atai-finance-phase-1-report.md`).
- Two known failing test files at start: `lib/auth/__tests__/session.test.ts` (collection error: phantom `server-only` package) and `lib/cofounder/tools/seo.test.ts` (user-WIP `refundSeoAuditCredits` 3-arg refactor vs 2-arg expectation). Both re-verified at the end (§10) — unchanged signatures.
- Verified codebase facts the design builds on: single `runtime_usage` writer (`recordUsage` via `meter.ts`); `consumeCredits` may emit two debit rows (`…_sub`, `…_perm`) per event; refunds are new opposing ledger rows; `build_finalization` exists only from the legacy `mongo-store.addTransaction` path while `finalizeBuildAuthorization` writes no row (a build writes one or the other, never both).

## 3. Files changed

**Created (source):**
| File | Purpose |
|---|---|
| `lib/finances/cost-status.ts` | Pure cost-status vocabulary: `costStatusFromProviderCost` (write-time), `deriveCostStatus` / `deriveCostCurrency` (read-time for historical rows) |
| `lib/finances/project-economics.ts` | Project economics accounting service (Workstreams D+E) + reconciliation diagnostics (G) |
| `app/api/projects/[id]/economics/route.ts` | Owner-gated, bounded GET endpoint (Workstream F) |

**Modified (source):**
| File | Change |
|---|---|
| `lib/runtime/metering/meter.ts` | Persist `costStatus` in `costMetadata` (additive; existing fields untouched) |
| `lib/runtime/control/breakdown.ts` | USD-only `providerCostUsd` sums + `providerCostNonUsdCount`; null-gate now on the USD sum |
| `lib/runtime/control/analytics.ts` | Same currency guard + non-USD count in `summarizeProjectUsage` |
| `lib/runtime/control/types.ts` | `UsageSummary.providerCostNonUsdCount?` |
| `lib/finances/project-finances.ts` | `USD_COST_COND` / `providerNonUsdExpr` in daily + totals pipelines; `providerCostNonUsdCount` through `DailyFinancePoint`/`FinanceTotals`/`mergeDailySeries`/`buildTotals` |
| `lib/finances/platform-finances.ts` | Same USD guard in the portfolio aggregation; `collapseExpenseRows` folds the non-USD counts |
| `lib/marketing/seo/credits.ts` | `projectId` line added to the charge and refund `consumeCredits`/`grantCredits` calls (user-WIP refund-outcome logic preserved verbatim) |
| `lib/marketing/studio/credits.ts` | `projectId` on charge + refund; `refundStudioCredits` accepts `intentKey` → deterministic `studio_${intentKey}_refund` key |
| `lib/resources/resources-credits.ts` | `projectId` on charge + refund |
| `app/api/projects/[id]/studio/refine/route.ts`, `…/variations/route.ts` | Thread `requestId` as `chargeIntentKey` into the failure refund |

**Test files** (repo convention: `**/*.test.ts` is gitignored, kept local): created `lib/finances/cost-status.test.ts`, `lib/finances/project-economics.test.ts`, `lib/finances/provider-cost-currency.test.ts`, `lib/marketing/studio/credits.test.ts`, `lib/resources/resources-credits.test.ts`; extended `lib/runtime/metering/metering.test.ts` (2 costStatus assertions) and `lib/marketing/seo/credits.test.ts` (projectId assertions + one charge-attribution test).

All other diff noise in the tree is the user's WIP and was not touched.

## 4. Data-model decisions (Workstream A)

Smallest schema changes, zero new collections:

1. **Reuse `runtime_usage` + `credit_ledger`** exactly as they are. The only persisted addition is one optional field: `costMetadata.costStatus ∈ {confirmed, estimated, unavailable}` written by `meter.ts` at insert time (records are immutable; no updates, no backfills).
2. **Read-time derivation for history.** `deriveCostStatus` gives every historical row an honest status without rewriting: explicit persisted field → else numeric+source derivation → else `unavailable`. Non-monetary units (Firecrawl `creditsUsed`, ElevenLabs characters, Cloudflare tokens) never pass the numeric-providerCost test and stay `unavailable`, never 0.
3. **`not_applicable` is a vocabulary member** for accounting consumers (account-level ledger movements have no provider call), but nothing in `runtime_usage` writes it — every usage event potentially incurs provider cost. It exists so the four documented statuses are complete and future-correct.
4. **No idempotency field added to usage rows.** The ledger's unique `idempotencyKey` remains the financial source of truth; usage rows correlate via `costMetadata.ledgerIdempotencyKey`, and rows missing it are a *diagnostic*, not a schema problem (G).
5. **Cost status never touches the customer side:** the universal credit valuation (3,750 = US$1.00) is explicitly NOT a provider cost, and `VISUAL_CREDITS_PER_USD = 4000` remains a charging rule only. Neither number appears in any provider-cost sum (test-enforced, §10).

## 5. Attribution coverage matrix (Workstream B)

| Billable operation | Source record | projectId attribution | Idempotency / retry safety |
|---|---|---|---|
| Runtime gateway (`meter.ts` → `charge.ts`) | `runtime_usage` + `credit_ledger` `runtime_usage` | first-class, **server-derived** (API-key record / session-validated auth) | `runtime_${requestId}` charge key; `_refund`-suffixed refund key |
| Build deploy / agent / build routes | ledger `build_reservation` | first-class — routes pass `projectId: id` (verified `build`, `deploy`, `agent`, `fork` call sites) | `reserve_${buildId}` / `release_${buildId}` |
| `finalizeBuildAuthorization` | ledger (build-auth) | first-class (`auth.projectId`) | keyed per authorization |
| Legacy store path (`mongo-store.addTransaction`) | ledger `build_finalization` + legacy `referenceType/Id` | projectId only when metadata carries it | legacy; rows matched by the service's $or, never rewritten |
| Analyze pipeline (`lib/analysis/pipeline.ts`) | legacy `lib/credits.reserveCredits` (positional) | projectId passed as final param | reservation-keyed |
| Collaborate workspace | ledger `ai_collaboration` | first-class (Phase 1) | intent key stable per approval |
| Expected-visual generation (`generate-visual`) | ledger `ai_collaboration` | first-class (server-validated; verified this pass) | `visual_${cryptoId()}` — fresh key per attempt (limitation L3) |
| Infrastructure purchase | ledger `infrastructure_purchase` | first-class (verified) | `infra_${projectId}_${plan}_${now}` |
| SEO audit | ledger `ai_collaboration` | **first-class (added this phase)** | random keys (limitation L3 — callers are user WIP) |
| Marketing Studio (charge / refine / variations / market) | ledger `ai_collaboration` | **first-class (added this phase)** | **deterministic** `studio_${intentKey}` / `studio_${intentKey}_refund` when caller supplies requestId/action-id |
| Resources AI (4 ops) | ledger `ai_collaboration` | **first-class (added this phase)** | random keys (limitation L3) |
| Fork royalty | ledger credit to the *original author* | carries projectId but is funding-income, never netted | unique per fork |
| Account-level (signup bonus, top-up, renewal, expiration, clawback) | ledger | **no projectId — correctly account-level**; excluded from every project figure by design | — |

Rules enforced: retries cannot double-bill (unique `idempotencyKey` index + deterministic keys where the intent is retryable); no projectId is ever invented or client-supplied (every value is route-/auth-derived); legacy rows are matched via `referenceType:"project" + referenceId` in a $or and counted separately (`legacyAttributedEntries`) — never rewritten.

## 6. Provider-cost coverage matrix (Workstream C)

| Provider / adapter | Reported | Persisted status | Currency handling |
|---|---|---|---|
| OpenRouter (chat, multimodal) | USD amount | `confirmed` | summed into USD buckets |
| Twilio | price + price_unit | `confirmed` | price_unit currency can be **non-USD** → counted in `providerCostNonUsdCount` / `confirmedByCurrency[currency]`, never merged into USD |
| Firecrawl | `creditsUsed` (non-monetary) | `unavailable` | counted, not summed |
| ElevenLabs | character counts | `unavailable` | counted, not summed |
| Cloudflare | token counts | `unavailable` | counted, not summed |
| Resend / Firebase / Cal.com / Mapbox | no cost data | `unavailable` | counted, not summed |
| Dodo (payments) | fee fields not captured as usage | `unavailable` | earnings are a separate pipeline (`dodo-earnings`), not provider cost |
| Totalum (`lib/infrastructure/costs.ts`, UGX 500/credit) | **unreferenced dead code** | not emitted | deliberately NOT used as a price source (would be inventing) |
| `provider_estimated` | no emitter today | vocabulary reserved | any future source stays distinguishable |

Classification is explicit at write time (`costStatusFromProviderCost`) and derived at read time for old rows. Aggregates preserve the original amount + currency verbatim. The 3,750/4,000 credit constants are valuation/charging rules and appear in zero provider-cost code paths (test-enforced).

## 7. Calculation definitions and examples (Workstreams D+E)

Documented in the module header of `lib/finances/project-economics.ts`; consumed verbatim by the endpoint:

- **grossConsumedCredits** — Σ `amount` over ledger DEBIT rows, type ∈ consumption set (`runtime_usage`, `runtime_reservation`, `build_reservation`, `build_finalization`, `ai_collaboration`, `infrastructure_purchase`), project-attributed. Bucket-split rows (`…_sub` + `…_perm`) sum once: a 600+400 split of a 1,000 charge contributes exactly 1,000.
- **reversalCredits** — Σ `amount` over CREDIT rows, type ∈ reversal set (`runtime_refund`, `build_release`, `other_reversal`, `refund_reversal`).
- **funding** — any other credit-direction row (purchases, grants, `fork_royalty`, future types) → `funding_ignored`, never netted (catch-all by design).
- **netConsumedCredits** = gross − reversals; negatives reported honestly + `negativeNetConsumption` flag.
- **referenceValueUsd** = `consumedCreditsValueUsd(net)` — BigInt micro-USD, aggregate-first-convert-once, stamped with `ATAI_CREDIT_VALUATION_V1`. *Example: net 700 → 700/3750 = US$0.186667.* A reference value, not revenue.
- **confirmedByCurrency / estimatedByCurrency** — per-ISO-currency sums (`"unknown"` bucket for unlabeled numerics; never relabeled USD). *Example: USD 0.02 + UGX 7,500 → `{USD: 0.02, UGX: 7500}`, `nonUsdProviderCostEvents: 1`.*
- **costCoverageRatio** = succeeded events with numeric cost ÷ succeeded events; `null` (not 0 or 100%) when there are no succeeded events.
- **Double-counting contract** — credits come ONLY from the ledger; provider cost ONLY from `runtime_usage`; `creditsCharged` telemetry is reported as `creditsChargedTelemetry` beside ledger figures, never added. Reservation + finalization cannot both count: a build writes one or the other (verified).
- **No aggregation sums the two sources together, and nothing computes profit or margin.**

## 8. API contracts (Workstream F)

Preference for extending existing endpoints was honored: the four existing analytics/finance rollups carry the corrected fields additively (`providerCostNonUsdCount`) — response-shape compatible (new optional field only). The genuinely-new need (a single project-economics read model) got one new endpoint:

`GET /api/projects/:id/economics?from=&to=` (ms epochs; window clamped to ≤90 days server-side)
- **Auth:** session user; **ownership:** `requireOwnedProject` — non-owner gets `404 UNAUTHORIZED_PROJECT_ACCESS` (existence not leaked), same gate as `/runtime/usage`.
- **Validation:** non-finite `from`/`to` → `422 VALIDATION`.
- **Bounded:** ledger grouping `$limit 100`, cost grouping `$limit 200`, breakdowns 20–50 rows, daily `$limit 92`, orphan samples 5; all queries indexed paths (`projectId+createdAt`).
- **Response:** `{ credits, providerCost, diagnostics, recognizedRevenue: {status:"not_supported"}, window, valuationVersion }` — data only; no dashboard built (per §4 non-goals).
- Ledger queries additionally filter by the owner-checked `userId` (defense-in-depth).

## 9. Schema / index changes

**None.** No new collections, no new indexes, no migrations, no TTL changes, no rewrites of historical rows. `costStatus` is a plain field inside the existing `costMetadata` object; readers derive it for old rows. `ensureRuntimeIndexes()` was already the startup hook and is unchanged.

## 10. Tests, commands, and results (Workstream + §5/§6)

All test inputs are deterministic fixtures / mocked providers; no real payments, no real billable provider operations, no production data touched.

| # | Command | Exit code | Result |
|---|---|---|---|
| 1 | `npx --no-install tsc -p tsconfig.phase2-check.json` (transient scoped config, deleted after) | **0** | All 14 Phase 2 source files type-clean |
| 2 | `npx --no-install vitest run` × 9 targeted Phase 2/affected files | 1 | **148/149 passed**; 1 failure in my own new fixture (`orphanSamples` docs vs strings) — fixed, re-run: **18/18** (exit 0) |
| 3 | `npx --no-install vitest run` (full suite) | 1 | **116/118 test files passed · 1428/1429 counted tests passed · 1429 total + 1 file with collection error** (179s) |

§6 re-verification of the two failing files (explicitly re-run and inspected in this final pass, not auto-classified):

- `lib/auth/__tests__/session.test.ts` — **collection error**: `Cannot find package 'server-only' imported from lib/billing/credit-service.ts`. The `server-only` phantom-dependency environment issue predates Phase 2; Phase 2's own files mock it correctly and pass. Same failure signature as at start.
- `lib/cofounder/tools/seo.test.ts` — `run_seo_audit executeApproved > refunds credits when the audit fails`: expects `refundSeoAuditCredits('user_1','proj_1')`, actual call has third arg `15`. This is the **user's WIP** refund-amount refactor (`amount` parameter added to `refundSeoAuditCredits`) — the stale expectation lives in user-owned WIP files (`lib/cofounder/*` is modified in the tree). Phase 2's only edit to `seo/credits.ts` was the `projectId,` line; the signature mismatch is identical to the start state.

New test coverage (brief §5 categories): attribution (studio/resources/seo writers assert first-class `projectId`; ledger `$or` match asserted in the service test), credit accounting (`_sub`/`_perm` single-sum, reversal netting, funding exclusion incl. `fork_royalty`, negative-net honesty, legacy-entry counting), provider cost (status write-time + read-time derivation incl. non-monetary units, currency separation incl. `"unknown"` never → USD, meter persistence assertions), aggregation (service wiring: coverage ratio, grouped rows, empty-project typed zero), security/compat (route gate source-scan: `requireOwnedProject` before any compute, 422 validation; `provider-cost-currency.test.ts` structural guard on all four rollups, precedent style of `collections-topups-retention.test.ts`).

## 11. Security, compatibility, performance

- **Security:** every figure is server-derived; the endpoint never accepts a client projectId for ledger filtering (path param + ownership gate + optional userId filter); diagnostics expose only requestIds (opaque correlation ids), no payloads, keys, or PII; usage-record hygiene unchanged (existing no-secrets test still passes).
- **Compatibility:** all response changes are additive optional fields; existing consumers (`UsageSummary`, finance pages, admin) compile and pass unchanged; the `providerCostUsd` null-semantics shifted to "null unless a USD amount was actually summed" (previously misleading "$0" for all-non-USD groups) — asserted compatible with existing breakdown fixtures.
- **Performance:** one extra `$sum` accumulator per rollup on existing indexed scans; economics endpoint runs 9 bounded queries in parallel; `import` overhead dominated test time, not runtime. No new indexes needed for the added conditions (`projectId+createdAt` prefix already indexes the currency filters' scan).

## 12. Limitations

- **L1 — No FX normalization.** Non-USD costs are counted and kept in their own currency; there is no approved rate source, so no "platform cost in one currency" exists. `providerCostUsd` on rollups is now genuinely USD-only.
- **L2 — `estimated` status has no emitter.** Correct per §3C (never invent prices); `provider_estimated` vocabulary is reserved for a future documented price table.
- **L3 — SEO/Resources/visual refund+charge keys remain random per attempt.** Deterministic keys need caller-side intent ids; those callers are active user WIP (`lib/cofounder/tools/seo.ts`, generate-visual route), so Phase 2 documented rather than refactored them. Studio (the retry-prone approve/execute path) got the deterministic treatment.
- **L4 — checkoutAttempts are not aggregated at the platform rollup** (inherited from Phase-1-era `collapseExpenseRows`, unchanged, documented).
- **L5 — Diagnostics are discoverable, not actionable:** orphan billable-usage (no `ledgerIdempotencyKey`) is counted/sampled only; no alerting, no replay, no repair (deferred items below).
- **L6 — Full-suite typecheck (`pnpm build`) was not run**: tree-wide builds hang on this Windows host (documented in project memory); verification used the scoped-tsc + full-vitest recipe instead. Next's own route-type checks were therefore not exercised on the new route beyond `tsc`.

## 13. Confirmations

- **No invented project attribution:** every `projectId` in this phase is derived server-side from an ownership/session boundary; account-level rows were left account-level; legacy rows were matched and counted, never re-tagged or rewritten.
- **No unverified profit, margin, ROI, or revenue figures:** `recognizedRevenue.status = "not_supported"` with an explanatory note is the only revenue statement; the credit valuation is labeled a reference value everywhere it appears.
- **No fabricated provider costs:** unavailable stays unavailable; non-monetary units were never converted to money; dead-code Totalum pricing was not adopted.
- **No real payments / refunds / billable provider calls** were executed; no production data was modified; nothing was committed; no destructive git operation was run; the user's WIP in the tree was preserved (the only shared-file edits are the surgical lines in §3, made after re-reading current content + diff).

## 14. Acceptance checklist (§9)

| Criterion | Status |
|---|---|
| Explicit cost status on usage records (written + derived for history) | ✅ meter.ts + cost-status.ts |
| Provider cost never 0-coerced; missing ≠ zero everywhere | ✅ all four rollups + economics service; tests |
| No 3,750/4,000 valuation used as provider cost | ✅ + test-enforced separation |
| Currency preserved; never silently mixed | ✅ USD-only sums, per-currency buckets, counted non-USD |
| All billable paths project-attributed first-class or counted as legacy | ✅ matrix §5; writers fixed where missing |
| Retries cannot double-bill / retried refunds cannot double-refund (studio) | ✅ §5, tests |
| Gross/net credit semantics verified, funding never nets | ✅ §7, tests incl. fork_royalty |
| Economics summary service with documented aggregates + examples | ✅ project-economics.ts |
| API boundary: auth + ownership + bounded queries; no dashboard | ✅ one GET endpoint |
| Reconciliation readiness: diagnostics discoverable, zero rewrites | ✅ §7/§12-L5 |
| Deferred items stayed deferred (webhook replay worker, refund netting) | ✅ not implemented |
| Tests per §5 categories, deterministic fixtures, mocked providers | ✅ 5 new files + 2 extensions |
| §6 verification with honest exit codes/counts | ✅ §10 |
| §7 discipline: branch/tree preserved, no commits, no Phase 3 start | ✅ |

## 15. Phase 3 recommendations (not implemented)

1. **Surface the economics endpoint** in the project finance page (data contract already typed; no redesign needed to consume it).
2. **Thread intent ids through SEO/Resources/visual callers** to extend deterministic idempotency beyond studio/runtime (once that user WIP settles).
3. **Dodo webhook replay worker** (deferred from Phase 1): `runtime_usage` orphan diagnostics give the exact reconciliation queue it should consume.
4. **Refund netting on the earnings side** — pairs with (3); keep it out of the credit-valuation path.
5. **A documented provider price table** would unlock honest `estimated` statuses for Firecrawl/ElevenLabs/Cloudflare; until then their costs correctly remain `unavailable`.
6. **FX policy decision from the user/business** (rate source + date convention) before any cross-currency platform cost total is attempted.

---

*Phase 2 complete. Stopping here per the brief — no Phase 3 work started, nothing committed, tree left for user review.*
