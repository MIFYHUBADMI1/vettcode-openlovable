# ATAI — Project Finance & Economics System: Phase 0 Architecture, Runtime, Credit, Payments & Financial Data Audit

- **Audit date:** 2026-10-09
- **Repository:** `mirrorsiteai` (package `atai` v5.0.0, Next.js 16.3.3, branch `main`)
- **Method:** Read-only static inspection of source, tests, docs, dependency manifests, and env var *names*. No application code, schema, migration, configuration, dependency, or financial setting was modified. No payment, refund, credit deduction, or external provider call was triggered. No live database or provider account was exercised — "VERIFIED" means *wired in code, consistent across layers, and (for metering/keys) covered by passing unit tests*, not a live end-to-end smoke test.
- **Test evidence:** Full suite executed safely: **77 test files, 1016 tests, all passing** (`npx vitest run`). Runtime metering (54 tests), keys (36), usage (11), billing (12) verified passing.
- **Status vocabulary:** VERIFIED / PARTIALLY VERIFIED / NOT FOUND / UNKNOWN / BROKEN (used strictly per audit brief §2.2).

---

## Deliverable A — Executive Summary

**What ATAI already supports (stronger than expected).** ATAI is a mature AI app-builder SaaS with two genuinely working money-adjacent subsystems:

1. **A provider-neutral Runtime API gateway** (`POST /api/runtime/v1`) with hash-stored, project-scoped API keys, Bearer authentication, scopes, rate limits, per-project caps, and — critically — a **single centralized metering pipeline** (`lib/runtime/metering/meter.ts` + `charge.ts`) that resolves admin-configurable pricing, charges an **idempotent double-entry credit ledger**, records a per-request `runtime_usage` event carrying full attribution (`userId`, `projectId`, `apiKeyId`, environment, capability, provider, model, tokens, credits charged, immutable pricing snapshot, and provider-reported monetary cost where available), and fails closed on unknown financial states.
2. **A platform billing system** (Dodo Payments + a legacy mobile-money top-up channel) with Standard-Webhooks HMAC signature verification, replay-window enforcement, webhook-id idempotency, a double-entry `credit_ledger` with unique idempotency keys, subscription credit buckets, and admin reconciliation tooling.

**What is missing or incomplete.**
- **Payments have zero project attribution.** `PaymentRecord` (`lib/billing/billing-types.ts:78-104`) has `userId` but no `projectId`. Checkout metadata (`app/api/billing/checkout/route.ts:155-160,213-218`) captures only `userId/type/planId/packageId/credits`. Project-level revenue is **NOT implementable from current payment data** without new attribution or an explicit allocation policy.
- **Refunds are never netted from revenue.** `handleRefundSucceeded` (`app/api/billing/webhook/route.ts:505-541`) inserts a *separate* record (`status: "refunded"`, negative amount) and never updates the original payment (stays `"succeeded"`). The admin revenue aggregation sums `status:"succeeded"` only (`app/api/admin/billing/overview/route.ts:45-67`) → **revenue is overstated by refunded amounts**.
- **Webhook processing failures are terminal.** The handler returns HTTP 200 even when `processEvent` throws (`app/api/billing/webhook/route.ts:119-127`); the event is marked `"failed"` in `webhook_events` and **no retry/replay path exists** (no queue, worker, or cron anywhere in the repo). Recovery depends on the manual admin reconciliation page.
- **Platform-side credit charges are inconsistently project-attributed.** Runtime charges carry `projectId` in ledger metadata (`lib/runtime/metering/charge.ts:93-101`); build/deploy reservations reference only `buildId` (`lib/billing/credit-service.ts:617-634`); scrape/plan/deep-crawl charges carry **no metadata at all** — `projectId` goes only to the console logger (`lib/credits/credits.ts:135-148`).
- **No credit↔currency conversion exists.** Credits are a proprietary unit; the only dollar anchor is `VISUAL_CREDITS_PER_USD = 4000` (`lib/billing/visual-pricing.ts:23`), scoped to visual generation. Monetary *cost of credits sold* and *profit* are **blocked**, consistent with the admin financials route's explicit refusal to compute profit (`app/api/admin/runtime/financials/route.ts:20-24`).

**Is project-level financial attribution reliable?** For **runtime consumption: YES (VERIFIED)** — the best-in-repo data path. For **payments/revenue: NO (NOT FOUND)** — user-level only. For **platform build/pipeline charges: PARTIAL** — derivable via `build_runs` join for builds, lost for scrape/plan.

**Is credit consumption traceable?** YES for runtime (`runtime_usage` ↔ `credit_ledger` joined by `runtime_<requestId>`); MOSTLY for builds (tier pricing, reservations, releases); PARTIAL for legacy pipeline charges (no ledger metadata).

**Are payment records authoritative?** PARTIALLY — they are webhook-derived and idempotent, but failed/cancelled events are stored with `amount: 0` and no `userId` (`route.ts:309-337`), unattributable `payment.succeeded` events are dropped with only a log warning (`route.ts:270-273`), and `recordPayment` swallows its own errors (`route.ts:573-605`).

**Can actual monetary costs be calculated?** PARTIALLY — provider-reported USD cost is persisted for OpenRouter and Twilio only (`adapters/openrouter/adapter.ts:175-177`, `adapters/twilio/mapper.ts:129-131`); all other adapters record cost as explicitly `unavailable`, correctly never treated as $0.

**Recommended strategy:** Build the Finance system as a **read/report layer on top of the existing runtime_usage + credit_ledger + payment_records/topups sources**, extend attribution at the edges (ledger projectId, payment allocation policy, webhook retry), and ship project-scoped finance APIs that reuse the proven `requireOwnedProject` gate. Do not create a second ledger. Full roadmap in Deliverable J.

---

## Deliverable B — Evidence-Based Architecture Map

```
SESSION DOMAIN (dashboard)                          BEARER DOMAIN (generated apps)
─────────────────────────────                       ──────────────────────────────
proxy.ts (edge cookie gate,                         /api/runtime/v1 excluded from cookie gate
  PUBLIC_API_PREFIXES incl.                         → authenticateRuntimeRequest()
  /api/billing/webhook, /api/runtime/v1/)             (lib/runtime/auth/authenticate.ts)
    ↓                                                 ↓
requireUser()/requireAdmin()                        RuntimeAuthContext {requestId, apiKeyId,
  (lib/auth/session.ts, DB-backed                     userId, projectId, environment, scopes}
   opaque cookie, SHA-256 in `sessions`)              — identity ONLY from api_keys record
    ↓                                                 ↓
checkProjectOwnership() /                           routeRuntimeRequest() (router.ts)
requireOwnedProject()                                 → preflightMeteredRequest()  [pricing gate,
  (lib/runtime/ownership.ts, fail-closed)               fixed-price pre-charge or estimate check]
    ↓                                                 → provider adapter (11 registered:
PROJECTS & KEYS                                        openrouter, elevenlabs, firecrawl, resend,
projects collection (userId ownership)                 twilio, firebase, mapbox, calcom, cloudflare,
api_keys: SHA-256 hash-only (key-crypto.ts),           totalum, dodo)
  per-project+environment, scopes, rotation          → meterRuntimeResult() → chargeRuntimeUsage()
  (lib/runtime/keys/service.ts;                        → consumeCredits()  [credit_ledger, unique
  app/api/runtime/keys/*, session-gated]                 idempotencyKey `runtime_<requestId>`]
                                                        → recordUsage()      [runtime_usage doc]

CREDIT CORE                                            PAYMENTS CORE
─────────────                                          ──────────────
users.{subscriptionCredits, permanentCredits,          POST /api/billing/checkout (session)
  credits(legacy), creditBuckets[]}                     → Dodo checkout session, metadata userId/plan/pack
  = balance source of truth                            POST /api/billing/webhook (HMAC, Standard Webhooks)
credit_ledger (double-entry, unique idempotencyKey,      → webhook_events (webhookId-unique idempotency)
  balanceBefore/After, pricing versions)                 → payment_records / subscription_records
lib/billing/credit-service.ts                             → grantCredits()/grantSubscriptionCredits()
  grantCredits / consumeCredits / reverseCredits           (idempotent, `payment_<id>`, `sub_grant_<sub>_<period>`)
  (Mongo transactions, subscription-first)              LEGACY CHANNEL: /api/billing/top-up → screenshot →
BUILD FLOW                                               OpenRouter vision verify → admin approve →
build/deploy/agent/fork routes                            awardCredits() → credit_ledger (`topup_grant_<id>`)
  → reserveCredits({userId,amount,buildId})             ADMIN: /api/admin/billing/{overview,reconciliation},
    [ledger `build_reservation`, NO projectId]            /admin/ledger, /admin/transactions,
  → releaseReservation() on failure                        /admin/runtime/financials (all requireAdmin)

REPORTING SURFACES TODAY
user:   GET /api/billing/overview (balance + history + sub), GET /api/credits (legacy tx view)
project:GET /api/projects/[id]/runtime/usage (+ /export CSV) — full breakdowns incl. providerCostUsd
admin:  /api/admin/runtime/financials, /admin/billing/*, /admin/{ledger,transactions,stats}
UI:     app/finances/* and app/project/[id]/finances/* = ComingSoon placeholders (nav slots reserved,
        components/workspace/atai-nav.ts:58-67 `kind: "soon"`)
```

Key structural fact: the "Project → API credential → SDK/runtime → usage metering → credit ledger" chain is **real and verified**. The "Project → Payments" chain **does not exist** — payments attach to `userId` only.

---

## Deliverable C — Endpoint Inventory (finance-relevant, discovered in repo)

| Endpoint | Purpose | AuthN | AuthZ | Data source | Finance relevance | Gaps |
|---|---|---|---|---|---|---|
| `POST /api/runtime/v1` | Route+meter one runtime op | Bearer ATAI key | scopes (`requireRuntimeScope`) | api_keys → router → credit_ledger + runtime_usage | **Core metering**; charges credits, full attribution | none material |
| `GET /api/runtime/v1` | Capability discovery | Bearer | — | capability registry | none (metadata) | — |
| `GET /api/runtime/v1/health` | Key/identity check | Bearer | key status | api_keys | returns trusted `projectId`/`apiKeyId` | — |
| `GET/POST /api/runtime/keys?projectId=` | List/create keys | Session | `checkProjectOwnership` | api_keys | project↔key binding for attribution | body ownership fields rejected (strict schema) |
| `POST /api/runtime/keys/[keyId]/rotate`, `DELETE …/[keyId]` | Rotate/revoke | Session | ownership | api_keys | key lineage for usage attribution | — |
| `GET /api/projects/[id]/runtime/usage` | Usage list + server-side breakdowns | Session | `requireOwnedProject` (404 no-leak) | runtime_usage | **ready-made project usage analytics** incl. `providerCostUsd` | credits only; no currency |
| `GET /api/projects/[id]/runtime/usage/export` | Bounded CSV export | Session + ownership + rate-limit | same gate | runtime_usage | audit-grade export | capped rows, truncation marker (honest) |
| `GET /api/projects/[id]/runtime/requests/[requestId]` | Per-request detail | Session + ownership | — | runtime_usage | traceability request→charge | — |
| `GET /api/projects/[id]/runtime` | Key provisioning status | Session + ownership | — | api_keys (`runtimeProvisioning`) | metadata only | — |
| `POST /api/billing/checkout` | Create Dodo checkout | Session | own user | Dodo API, `app_settings` | payment creation; metadata carries userId | **no projectId in metadata** |
| `POST /api/billing/webhook` | Dodo events | HMAC signature + 5-min replay window | provider | webhook_events, payment_records, credit_ledger | **authoritative payment state** | returns 200 on processing failure (no Dodo retry); GET discloses webhook-key prefix + environment publicly |
| `POST /api/billing/sync` | Post-checkout subscription sync | Session + rate limit | own user | Dodo API, subscription_records | delayed-confirmation path | — |
| `GET /api/billing/overview` | Settings→Billing page | Session | own user | credit_ledger, subscription_records | user balance + history | no payments list; no project split |
| `GET /api/credits` | Legacy balance+transactions | Session | own user | store→credit_ledger | legacy view | duplicate surface with /billing/overview |
| `POST /api/billing/top-up` (+ `/evidence`, `/verify`) | Mobile-money top-up | Session | own user | topups, OpenRouter vision | **second revenue channel** (UGX) | manual/AI approval; not in payment_records |
| `GET /api/admin/billing/overview` | Admin revenue/usage KPIs | requireAdmin | admin | payment_records, ledger, build_runs | revenue math | sums `succeeded` only (refunds not netted); **mixed currencies summed raw** |
| `GET /api/admin/billing/reconciliation` | Cross-check payments↔grants↔ledger↔balances | requireAdmin | admin | all billing cols | **reconciliation foundation** | bounded to 500 rows per check, no auto-repair, manual only |
| `GET /api/admin/runtime/financials` | Runtime credits + provider cost summary | requireAdmin | admin | runtime_usage aggregation | cost-visibility pattern to reuse (currency-honest, "unavailable" ≠ $0) | admin-only |
| `GET /api/admin/ledger`, `/api/admin/transactions` | Ledger viewers | requireAdmin | admin | credit_ledger | audit trail | — |
| `GET /api/internal/credits?email=` | Balance lookup for ATAI web | `x-internal-key` (env) | shared secret | users, credit-service | cross-system balance | non-constant-time comparison; email-keyed lookup |

---

## Deliverable D — Database & Data Lineage Inventory

MongoDB via raw driver (no ORM); schema is code-first with idempotent index creation at first access; **no migrations tool**.

| Collection | Key fields | Indexes (financial) | Role |
|---|---|---|---|
| `users` | `subscriptionCredits`, `permanentCredits`, legacy `credits`, `creditBuckets[{subscriptionId,amount,expiresAt}]` | `creditBuckets.subscriptionId`, `expiresAt`, `deletedAt+credits` | **Balance source of truth** (mutable fields, not derived from ledger) |
| `credit_ledger` | `userId, creditType, amount, direction, transactionType, referenceType/Id, balanceBefore/After, idempotencyKey, pricingModelVersion, costModelVersion, metadata, createdAt` | **unique `idempotencyKey`**, `userId+createdAt`, `transactionType+createdAt`, `referenceType+referenceId` | Double-entry audit trail; immutable inserts (no update path found) |
| `api_keys` | `id(rkey_), userId, projectId, environment, keyHash(sha256), keyPrefix, scopes, status, expiresAt` | **unique `keyHash`**, `userId+createdAt`, `projectId+environment+status` | Credential→project attribution; secrets never stored/returned post-creation |
| `runtime_usage` | `id(rusage_), requestId, userId, projectId, apiKeyId, environment, capability, operation, provider, model, status, latencyMs, usage{}, costMetadata{pricingVersion, pricingRuleId, ledgerIdempotencyKey, providerCost, providerCostCurrency, providerCostSource…}, creditsCharged, createdAt` | `requestId`, `userId+createdAt`, `projectId+createdAt`, `projectId+environment+createdAt`, `createdAt` (admin financials), **no TTL (retention pending approval)** | **Authoritative per-request usage/cost record** |
| `payment_records` | `id(pay_), userId, dodoPaymentId, dodoCustomerId?, amount, currency, status, paymentType, creditsGranted?, creditType?, subscriptionId?, packageId?, productId?` | **unique `dodoPaymentId`**, `userId+createdAt`, `status+createdAt` | Platform payment history — **no projectId**, no fee/settlement/refund-of fields |
| `subscription_records` | `dodoSubscriptionId, userId, planId, priceUSD, mirrorCredits, status, periods, cancelAtPeriodEnd` | unique dodo id, `userId+createdAt` | Plan/renewal state |
| `webhook_events` | `webhookId, eventType, payload, payloadHash, status(received/processed/failed), receivedAt, processedAt` | **unique `webhookId`**, `eventType+receivedAt`, `status+receivedAt` | Idempotency + forensic replay data (payloads retained) |
| `topups` | `userId, packageId, credits, expectedAmount, paymentReference, payerPhone, paymentNetwork(mtn/airtel), status(12-state), aiAnalysis{}, evidenceHashes[]` | unique `paymentReference`, `userId+createdAt`, TTL `expiresAt` | Mobile-money revenue channel (UGX), separate from Dodo |
| `build_authorizations` | `userId, projectId, buildId, complexity, creditCost, status, subscription/permanent used, expiresAt` | `projectId+createdAt`, `status+createdAt` | Build reservation lifecycle |
| `build_runs` | `id, mirrorProjectId, status, creditsReserved…` | `mirrorProjectId+startedAt` | **Join path** from build ledger entries (referenceId=buildId) → project |
| `provider_usage` | `provider(firecrawl/totalum/imagekit/email), operation, userId?, projectId?, costEstimate?` | `provider+createdAt` | Legacy provider cost estimates (pre-runtime) |
| `project_runtime_config` | per-project caps/pricing overrides | unique `projectId` | Per-project limits |

**Lineage — runtime usage:** request → `RuntimeAuthContext` (from key) → pricing snapshot → `credit_ledger` debits (`runtime_<requestId>`, `_sub`/`_perm` suffixes) + `runtime_usage` (carries same key in `costMetadata.ledgerIdempotencyKey`). **Fully reconcilable.** VERIFIED.

**Lineage — platform builds:** route → `reserveCredits` → ledger (`build_reservation`, referenceId=buildId) → `build_runs` → project via `mirrorProjectId`. Derivable, not direct. PARTIAL.

**Lineage — pipeline charges (scrape/plan/deep crawl):** `store.addTransaction` → ledger with `reason` text only; `projectId` console-logged, not persisted. BROKEN attribution.

**Lineage — payments:** Dodo webhook (signed) → `webhook_events` → `payment_records` + ledger grant (`payment_<dodoPaymentId>`). User-level only. PARTIAL.

**Authoritative sources:** balances = `users` fields; consumption audit = `credit_ledger`; per-request usage/cost = `runtime_usage`; payment state = `webhook_events`-driven `payment_records`. Redundancies: legacy `credits` field vs typed fields (divergence logged, not auto-repaired — `credit-service.ts:74-83`); `GET /api/credits` duplicates `/api/billing/overview`.

---

## Deliverable E — Capability Matrix

| Capability | Status | Evidence | Gap | Recommendation |
|---|---|---|---|---|
| API-key project attribution | **VERIFIED** | `api_keys.projectId` (service.ts:62-79); identity from key only, `z.never()` on request identity (`runtime/contracts/router.ts:137`); tests `keys.test.ts`, `auth.test.ts`, `router.test.ts` (tamper cases) | none | Reuse as-is |
| Runtime usage metering | **VERIFIED** | `meter.ts` single pipeline; `runtime_usage` full attribution; 54 metering tests passing | retention policy undecided (no TTL) | Reuse; approve retention explicitly |
| Credit ledger | **VERIFIED (runtime/build); BROKEN (pipeline attribution)** | `credit_ledger` unique idempotencyKey + Mongo transactions (`credit-service.ts:380-500`); scrape/plan charges carry no metadata (`credits.ts:135-176`) | projectId missing on build reservations and pipeline charges | Add `metadata.projectId` at charge sites (Deliverable I) |
| Provider monetary costs | **PARTIAL** | OpenRouter + Twilio report USD verbatim (`adapter.ts:175`, `mapper.ts:129`); admin financials counts "unavailable" ≠ $0 | Most adapters record `unavailable`; no conversion credits↔USD | Extend cost normalization per adapter; never invent rates |
| Payment-to-project attribution | **NOT FOUND** | `PaymentRecord` has no projectId; checkout metadata lacks it | Project revenue impossible | See Deliverable I — allocation policy decision required |
| Payment confirmation | **VERIFIED (webhook), PARTIAL (failure path)** | HMAC + timestamp window + webhook-id dedupe (`dodo-webhook.ts`, `route.ts:53-113`); `payment.succeeded` → ledger grant idempotent | 200-on-failure swallows retries; `payment.succeeded` without metadata dropped (`route.ts:270-273`); failed/cancelled recorded amount=0, userId absent | Add replay for `status:"failed"` events; record all events with full data |
| Refund tracking | **PARTIAL** | `refund.succeeded` reverses credits, inserts negative record (`route.ts:505-541`) | original payment never marked refunded; `partially_refunded`/`disputed` states defined but never written; refunds not netted in revenue | Update original record; net refunds in reporting |
| Financial reporting APIs | **PARTIAL (admin + user level; none per-project)** | `/api/admin/runtime/financials`, `/api/billing/overview`, project runtime usage | No project finance API; no portfolio API | Deliverable J phase 4 |
| Project Finance UI | **NOT FOUND (placeholders)** | `app/project/[id]/finances/page.tsx` + `app/finances/page.tsx` = ComingSoon; nav slot `kind:"soon"` (atai-nav.ts:62) | entire surface | Build into reserved slot; reuse runtime-control UI patterns |
| Portfolio reporting | **NOT FOUND** | no endpoint aggregates across a user's projects for finance | — | Derive from same scoped queries (never global scan) |
| Reconciliation | **VERIFIED (admin, manual)** | `/api/admin/billing/reconciliation` detects grant↔payment↔ledger↔balance mismatches | bounded 500-row batches; no scheduled run; no user-facing freshness signal | Automate (phase 6); surface data-freshness in UI |
| Financial authorization | **VERIFIED** | `requireOwnedProject` (404 no-leak) on all project routes; `requireAdmin` on all admin routes (spot-verified across 15+ routes); key routes session-gated separately from Bearer domain | `/api/internal/credits` uses non-constant-time key compare | Constant-time compare; keep admin/user split for finance APIs |

---

## Deliverable F — Financial Data Readiness Assessment

| Metric | Required data | Availability | Readiness | Limitations |
|---|---|---|---|---|
| Credits consumed (total & by project/capability/model/day) | runtime_usage | ✅ complete | **Ready** | Platform (build/pipeline) charges live in ledger only; join via build_runs for builds; pipeline charges unattributed |
| Credits refunded/adjusted | ledger `runtime_refund`, `build_release`, `refund_reversal` | ✅ | **Ready** | — |
| Monetary operating costs (provider) | costMetadata.providerCost | ⚠️ OpenRouter+Twilio only | **Ready with limitations** | Other providers = "unavailable"; must display honestly, never as $0 |
| Gross payment volume | payment_records `status:"succeeded"` | ⚠️ | **Ready with limitations** | mixed currencies summed without conversion; failed events stored as amount 0 |
| Net collections | succeeded − refunded | ⚠️ derivable | **Ready with limitations** | must sum the negative refund records explicitly; original records stay "succeeded" |
| Recognized revenue | settlement/period data | ❌ absent | **Blocked** | no revenue-recognition model; subscription vs one-time distinction exists but no deferred-revenue concept |
| Refunds & fees | refund records; provider fees | ⚠️/❌ | **Blocked (fees)** | Dodo settlement/fee fields not captured anywhere in repo; mobile-money channel has no fee data |
| Profitability | revenue − costs | ❌ | **Blocked** | credits ≠ USD; no authoritative conversion; admin route deliberately refuses profit metric |
| Historical trends | timestamps on all sources | ✅ epoch-ms `createdAt` everywhere | **Ready with limitations** | oldest reliable record per source UNKNOWN (no live DB queried); no TTL on runtime_usage/credit_ledger so likely full history exists |

**Currency note:** payment amounts are decimal major units with ISO currency strings (Dodo convention); ledger amounts are integer credits (no currency field — correct for a proprietary unit); top-ups are UGX mobile-money. Any multi-currency display requires a documented FX policy with timestamps — none exists today.

---

## Deliverable G — Security & Integrity Findings

**P0 — Critical:** *None found.* The runtime identity model (server-derived `userId/projectId` from hashed keys, `z.never()` rejection of client identity fields, tamper tests in `router.test.ts:557`) is sound, and no path was found where one user can read another user's financial data (all project routes fail closed with identical 404s).

**P1 — High**
1. **Revenue overstated by unnetted refunds.** Original payment stays `"succeeded"`; admin overview sums only succeeded (`admin/billing/overview/route.ts:45-67`). Impact: materially wrong revenue reporting. Fix: net refund records (or transition status) in every revenue query.
2. **Webhook failures are unretryable.** `POST` returns 200 even when processing throws (`webhook/route.ts:119-127`); failed events marked `"failed"` with no replay mechanism. Impact: a transient DB error during `payment.succeeded` permanently loses a credit grant until manual reconciliation. Fix: return 5xx on processing failure *before* grants are attempted, or add a replay job over `webhook_events{status:"failed"}` (payloads are retained — data exists).
3. **No project attribution on payments.** `PaymentRecord` and checkout metadata lack any project identity. Impact: the Finance system's core promise (project revenue) is unbuildable on current data. Fix: policy decision + attribution at creation (Deliverable I).
4. **Multi-currency revenue summed without conversion.** `payment_records.amount` aggregated raw across `currency` values. Impact: incorrect totals the moment a non-USD checkout occurs (Dodo adaptive currency is enabled — `lib/billing/currency.ts` is invoked in checkout). Fix: group by currency in all reporting.

**P2 — Medium**
5. **Pipeline credit charges lose project attribution** (`lib/credits/credits.ts:135-176`): `projectId` only reaches the logger, not the ledger. Historical entries are permanently unattributable.
6. **Collaboration charge idempotency is defeated:** `idempotencyKey: cryptoId()` (`lib/analysis/collaborate-credits.ts:95-101`) generates a fresh key per call, so a retry double-charges. Contrast with runtime's stable `runtime_<requestId>` key.
7. **Incomplete payment event capture:** `payment.failed`/`payment.cancelled` stored with `amount: 0`, no `userId` (`webhook/route.ts:309-337`); `payment.succeeded` missing metadata is dropped entirely (`:270-273`); `recordPayment` swallows errors (`:573-605`). Failed payment history and unmatched-provider-transaction handling are therefore unreliable.
8. **Balance source of truth is mutable denormalized state.** `users.{subscriptionCredits,permanentCredits,credits}` drive all gates; ledger divergence is logged, never repaired (`credit-service.ts:74-83`). A Finance UI must state which number it shows and label freshness.
9. **Legacy vs typed credit fields fallback:** `getBalance` falls back to legacy `credits` when typed fields are zero — correct for migration, but means historical spend cannot be split by type.

**P3 — Low**
10. **`GET /api/billing/webhook` is public** (excluded in proxy) and discloses webhook-key prefix + environment (`route.ts:19-35`). Reduce to booleans.
11. **`/api/internal/credits`** uses non-constant-time `!==` key comparison and email-keyed lookup (`app/api/internal/credits/route.ts:20-22`).
12. **Dispute events** (`dispute.*`) are logged only — `disputed` status exists in the type but is never written; chargeback financial effects are invisible to records.
13. **No TTL/retention policy** on `runtime_usage`/`credit_ledger` (explicitly deferred — `runtime-collections.ts:22-26`); retention must be decided before any "data freshness/retention" claims in the UI.

---

## Deliverable H — Proposed Target Architecture (no implementation in Phase 0)

**Principle: report from the authoritative sources; add attribution at the edges; never fork the ledger.**

1. **Authoritative sources (unchanged):** runtime_usage = per-request usage & provider cost; credit_ledger = credit movement audit; payment_records + topups = monetary inflow; users = balance.
2. **Attribution extensions (mandatory, small):** add `metadata.projectId` to every charge site (build/deploy/fork reservations via the existing `metadata?` param; pipeline charges via `store.addTransaction` metadata passthrough). Payments require a policy decision (Deliverable I).
3. **Ingestion:** no new ingestion for runtime (complete). Payments need (a) webhook failure replay, (b) full event capture (real amounts/userIds on failed events, unmatched-event store), (c) refund status transitions.
4. **Ledger consistency:** keep unique `idempotencyKey`; fix collaborate `cryptoId()` keys to stable per-entity keys; add `projectId` as a first-class indexed field on `credit_ledger` (Deliverable I) rather than metadata-scans.
5. **Reporting API design (follows existing conventions — `ok()` envelope, cursor pagination, `from`/`to` epoch-ms, ownership gate):**
   - `GET /api/projects/[id]/finances/summary` — credits consumed (from runtime_usage + ledger), provider cost, payment volume (until attribution lands: **user-level, labeled honestly**)
   - `GET /api/projects/[id]/finances/usage` — breakdowns reusing `lib/runtime/control/breakdown.ts` (already returns `providerCostUsd`, unavailable-counts)
   - `GET /api/projects/[id]/finances/ledger` — project-filtered credit_ledger (post-projectId-index)
   - `GET /api/finances/overview` — portfolio view, **derived by iterating the caller's own projects** (never a global scan), currency-grouped
   - `GET /api/projects/[id]/finances/reconciliation-status` — freshness + unresolved discrepancy counts (from `webhook_events{status:"failed"}` + reconciliation logic)
6. **Authorization:** every route uses `requireOwnedProject` (fail-closed, 404 no-leak); admin parity via `requireAdmin`; never expose key material or raw provider payloads.
7. **Dashboard integration:** replace the existing `ProjectComingSoon` at `app/project/[id]/finances` (nav slot already reserved); reuse `components/runtime-control/*` table/filter/chart patterns, the settings→billing card language, and the honest "unavailable ≠ $0" convention from the admin financials UI.
8. **Historical data:** runtime_usage/credit_ledger history is usable immediately (no TTL). Pipeline charges pre-dating the fix are **permanently unattributed** — label as such; do not reconstruct. Payment history is user-level forever unless an allocation policy is applied.

**Mandatory vs optional:** items 2, 3(a/b/c), 6 are mandatory before project finance ships. Item 5's portfolio view and reconciliation-status are strongly recommended; forecasting/AI insights are explicitly out of scope until the above is stable.

---

## Deliverable I — Proposed Data Model (minimum deltas; no migrations written)

1. **`credit_ledger.projectId` (new optional indexed field)** — purpose: direct project filtering of credit movement. Relationships: soft link to `projects.id`. Index: `{projectId:1, createdAt:-1}`. Idempotency: unchanged (keyed on `idempotencyKey`). Currency: n/a (credits). Status: **proposal** (existing `metadata.projectId` on runtime entries migrates forward by copy — no backfill needed for runtime, backfill *impossible* for pipeline history).
2. **`payment_records.projectId?` + `allocation` (proposal, pending policy)** — purpose: project revenue. **Policy decision required** (see Deliverable K): payments are inherently user-level (subscriptions/credit packs fund the *account*). Recommended minimal approach: do **not** invent per-project revenue; instead report (a) user-level payment volume, and (b) project-level *value consumed* (credits spent per project) — both truthful. If per-project revenue is mandatory, add a `projectId` set at checkout creation for project-scoped purchases only, plus an allocation rule for account-level purchases.
3. **`payment_records.netAmount` / refund linkage (proposal)** — purpose: correct net revenue. Fields: original status transitions (`refunded`/`partially_refunded`), `refundedAmount` accumulator; refunds reference `originalDodoPaymentId`. Unique constraint unchanged (`dodoPaymentId` unique). Status: **proposal** (small extension of existing entity — no parallel table).
4. **`webhook_events.replay` metadata (proposal)** — `attempts[]`, `replayedAt`, `lastError`; enables the P1 retry path using already-retained payloads.
5. **`runtime_usage`** — no changes needed. (Optional future: `providerCostNormalizedUsd` if a documented FX/normalization policy is ever approved.)
6. **Reuse, don't rebuild:** `build_authorizations` (project-attributed build costs), `build_runs` (join key), `topups` (second revenue channel must be included in any "revenue" figure or explicitly excluded with a label), `project_runtime_config`.

---

## Deliverable J — Implementation Roadmap (dependency-aware)

**Phase 1 — Financial data foundation & attribution.** Add `metadata.projectId` to all charge sites (build/deploy/fork/pipeline); fix collaborate idempotency keys; add `credit_ledger.projectId` field + index; capture real amounts/userIds on failed payment events; stop dropping unattributable `payment.succeeded` (store with `unmatched` flag). *Acceptance:* every new ledger entry carries projectId where a project context exists; no revenue-affecting webhook event is dropped. *Tests:* unit tests per charge site; webhook failed-event fixtures; regression on the 1016 existing tests.

**Phase 2 — Usage & credit accounting integration.** Project finance summary API over runtime_usage + ledger (reuse `breakdown.ts`); honesty rules for unavailable provider cost. *Acceptance:* credits consumed per project/day/capability matches admin financials totals for the same window. *Tests:* aggregation fixtures incl. zero-cost and unavailable-cost events.

**Phase 3 — Payment lifecycle & ledger integrity.** Refund status transitions + netting; webhook failure replay (5xx or replay job); currency-grouped revenue queries; dispute recording. *Acceptance:* net revenue = succeeded − refunded across mixed currencies; replayed webhook cannot double-grant (idempotency proven). *Tests:* duplicate/partial-refund/replay fixtures.

**Phase 4 — Finance reporting APIs.** Project summary/usage/ledger/reconciliation-status endpoints + portfolio overview, all `requireOwnedProject`-gated, cursor-paginated, epoch-ms windows. *Acceptance:* cross-project access returns 404; portfolio totals equal the sum of scoped project queries. *Tests:* cross-tenant isolation suite; pagination/date-filter matrix.

**Phase 5 — Project Finance interface.** Replace `ProjectComingSoon` at `app/project/[id]/finances`; summary cards, consumption charts, transaction table, cost breakdown, honest empty/error/loading states; user-level payments section labeled as account-level until attribution policy lands. *Acceptance:* matches existing runtime-control UX conventions; no simulated data (repo's anti-mock convention).

**Phase 6 — Reconciliation, historical data & validation.** Automate reconciliation (bounded batches), expose freshness + unresolved discrepancies, decide `runtime_usage` retention policy, validate backfill rules (mark estimates; never invent). *Acceptance:* dashboard never claims "real-time" for delayed data.

**Phase 7 — AI-powered insights (optional).** Anomaly detection on consumption, cost-optimization hints, forecasts — only after phases 1–6 data is trusted. Deterministic metrics computed in code; AI explains, never authors, financial facts; no autonomous refunds/settings changes.

---

## Deliverable K — Blocking Questions (not answerable from the repo)

1. **Does Dodo expose fee/settlement data through the current integration, and should it be stored?** No fee fields exist anywhere in webhook payloads or `PaymentRecord`; net-collections math needs this.
2. **What is the intended project-revenue semantics?** Payments fund user accounts (subscriptions/credit packs), not projects. Should Finance report user-level payment volume + project-level credit *spend* (recommended), or must per-project revenue be manufactured via an allocation rule — and what is that rule?
3. **Credit↔currency policy:** is there an approved conversion for credits (e.g., pack-derived marginal price ~`priceUSD/credits`, or `VISUAL_CREDITS_PER_USD = 4000`), or must monetary cost reporting stay limited to provider-reported spend? (The repo deliberately refuses to define this.)
4. **Historical coverage:** what is the oldest reliable record in `runtime_usage` / `credit_ledger` / `payment_records` / `topups`? (Requires a read-only DB query — not executed to avoid touching production data without authorization.)
5. **Mobile-money top-ups:** should the UGX top-up channel be included in revenue reporting, and at what FX rate/timestamp basis?
6. **Accounting treatment of subscription credits:** expiring credits vs deferred revenue — is there an external accounting policy Finance figures must conform to?

---

## Deliverable L — Go / No-Go Recommendation

### **GO WITH PREREQUISITES**

**Reasoning.** The hardest part of a finance system — trustworthy, idempotent, project-attributed *consumption* accounting — already exists, is centralized, and is heavily tested (1016 passing tests; 54 dedicated metering tests). Payments are webhook-verified and idempotent at the event level. Authorization patterns for multi-tenant financial data are proven. This is genuinely greenfield product work on proven rails, not re-architecture.

**Prerequisites before Phase 1 implementation begins:**
1. Resolve blocking questions K2 (project-revenue semantics) and K3 (credit↔currency policy) — they determine the entire revenue layer's shape.
2. Fix P1-1 (refund netting), P1-2 (webhook failure replay), and P1-4 (currency grouping) — reporting built before these fixes would ship wrong numbers.
3. Land P2-5/P2-6 (ledger projectId + stable collaboration idempotency keys) as part of Phase 1 attribution work.
4. Obtain read-only confirmation of historical coverage (K4) to scope what "trends" can honestly show at launch.

No critical architectural, authorization, or cross-tenant security defect blocks the Finance system. With the prerequisites above resolved, implementation can proceed phase-per Deliverable J.

---

*Prepared as Phase 0 (Discovery) deliverable. No code, schema, configuration, or financial setting was modified; uncommitted repository work was preserved untouched.*
