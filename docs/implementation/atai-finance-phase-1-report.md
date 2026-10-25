# ATAI Project Finance & Economics — Phase 1 Implementation Report

Date: 2026-10-25
Scope: Phase 1 of the Finance & Economics brief (universal credit valuation, trustworthy project attribution, collaboration idempotency, Dodo as sole payment gateway, payment-event integrity hardening).
Status: implementation complete and locally verified; changes are **uncommitted** in the working tree, awaiting review. Phase 2 was not started.

---

## A. Executive summary

The repository was substantially further along than the Phase 0 audit assumed. Sections §3 (valuation), §5 (project attribution), and §6 (collaboration idempotency) were already implemented and committed before this session — each was re-verified against the acceptance criteria rather than rebuilt. This session closed the remaining gaps:

1. **§4 legacy gateway removal** — every Mobile Money / UGX top-up *write* path is now disabled end-to-end (API routes return `410 DEPRECATED`, service layer is read-only, dead modules deleted via `git rm`, admin UI converted to read-only history, all user-facing links and legal/docs copy switched to Dodo-only wording). Historical `topups` records are untouched and still viewable.
2. **A latent data-loss bug not in the brief** — the `topups` collection carried a TTL index (`expireAfterSeconds: 0` on `expiresAt`) that silently auto-deleted top-up history ~24h after expiry. Index creation was removed and a runtime `dropIndex("expiresAt_1")` added to `dropLegacyIndexes()`.
3. **§7 payment-event integrity** — the Dodo webhook now distinguishes "unresolved" events (genuinely received, but not attributable — kept discoverable for reconciliation), never fabricates zero amounts, and no longer swallows `recordPayment` or credit-grant failures.
4. **§10 tests** — four new suites (18 tests) covering gateway retirement, webhook integrity, read-only top-up service, and TTL-index retention, plus a transient scoped type-check. All pass.

One personal-data item was removed along the way: the hardcoded MTN recipient name/phone (`PAYMENT_RECIPIENT`) is gone from source.

## B. Universal credit valuation (§3)

**Already committed before this session; verified, not rewritten.**

- `lib/billing/credit-valuation.ts` is the single authoritative reference: `ATAI_CREDITS_PER_USD = 3750` (line 52), `CREDIT_VALUATION_VERSION = "ATAI_CREDIT_VALUATION_V1"` (line 59), with an explicit notice that this is a *valuation reference only* — never provider cost, revenue, or profit (line 63).
- Arithmetic is exact: `BigInt` micro-USD (1e6 scale) with half-away-from-zero rounding; helpers `creditsToUsdMicros`, `creditsToUsd`, `creditsToUsdCents`, `sumCreditsToUsd` (aggregate-then-convert-once), `consumedCreditsValueUsd`, `ledgerMovementValueUsd`.
- Version stamping: conversions carry `CREDIT_VALUATION_VERSION`; ledger entries stamp `pricingModelVersion` / `costModelVersion`.
- **§3.3 / §8 consumer check:** a tree-wide grep found **no code currently converting credits→USD through any competing constant**, so there was no duplicate converter to migrate. Remaining "4000" and "UGX" occurrences are legitimately distinct semantics and were retained with clarifying comments where needed:
  - `VISUAL_CREDITS_PER_USD = 4000` in `lib/billing/visual-pricing.ts` — a *charging rule* for visual generation (how many credits a dollar of visual work costs), not a valuation of a credit.
  - UGX figures in `lib/infrastructure/costs.ts` (TOTALUM) — internal provider cost accounting, explicitly documented as neither a payment currency nor the credit valuation.
  - Credit-pack `pricePerCredit` in `lib/billing/packages.ts` — derived from each pack's actual cash price ÷ credits, a per-pack sale price, not a universal rate.

No second universal conversion constant exists.

## C. Legacy payment removal (§4)

Dodo Payments is now the sole gateway. Everything below is this session's work (unstaged edits + three `git rm` staged deletions).

**API surface (all former write endpoints now bare `410` responses, code `DEPRECATED`, pointing users to `/settings/billing`; messages deliberately avoid re-surfacing operator/UGX details):**
- `app/api/billing/top-up` (POST create) — already disabled in a prior commit; re-verified.
- `app/api/billing/top-up/[id]/verify` — rewritten to 410.
- `app/api/billing/top-up/[id]/evidence` — rewritten to 410.
- `app/api/billing/admin/top-ups/[id]` — POST (approve/reject) replaced with 410; the read-only GET (historical listing with user join) is retained for audit/support.
- `app/api/billing/admin/top-ups` GET — retained, comment updated to "read-only listing of historical Mobile Money top-ups".

**Service layer:**
- `lib/billing/topup-service.ts` rewritten to read-only: `getTopUp`, `getTopUpByRef`, `listUserTopUps`, `listPendingTopUps` only. `createTopUp`, `uploadEvidence`, `awardCredits`, `rejectTopUp` removed (a test asserts these exports are `undefined` and that read paths never call `insertOne`/`updateOne`).
- Deleted via `git rm` (no remaining callers, grep-verified): `lib/billing/verify-payment.ts` (369 lines), `lib/billing/payment-ref.ts` (52 lines), `lib/billing/types.ts` (144 lines; `lib/types/db.ts` already carries its own `TopUpDoc`/`PaymentNetwork`/`AIAnalysisResult`).
- `lib/billing/packages.ts` — removed deprecated `PAYMENT_RECIPIENT` (contained a real person's name and phone number — PII removed from source) and legacy `REFERENCE_EXPIRY_MS`.

**UI / copy:**
- `app/admin/payments/page.tsx` — converted to "Legacy Top-Up History": approve/reject actions, reject dialog, and related state/imports removed; a discontinuation notice card added; detail dialog and evidence viewing kept read-only.
- `app/admin/page.tsx` — the "Review mobile money top-ups" pending-attention card removed.
- `components/admin/admin-nav-config.ts` — nav entry relabeled "Legacy top-ups — Historical Mobile Money records (read-only)".
- `app/settings/page.tsx` and `components/credit-meter.tsx` — "+ Top Up" / low-credit links now go to `/settings/billing` (Dodo) instead of the retired `/billing/top-up`.
- `app/admin/billing/credit-packs/page.tsx` — copy updated to "purchased via Dodo Payments".
- `app/privacy`, `app/terms`, `app/refund-policy`, `components/docs-content.tsx` — MTN/Airtel/mobile-money references replaced with provider-neutral Dodo wording (refund-policy: 8 spots, including removal of "your mobile money operator").

**Historical data:** no `topups` documents were modified or deleted by this work. The only schema-level change is the TTL removal below.

**TTL retention fix (§4.4 "records must not be damaged"):** `lib/db/collections.ts` no longer creates `topups.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })`, and `dropLegacyIndexes()` now drops the legacy `expiresAt_1` index if present. Caveat in section I.

## D. Project attribution (§5)

**Already committed before this session; verified.**

- `CreditLedgerEntry.projectId?: string` is a first-class field in `lib/billing/billing-types.ts` with an explicit contract: populated whenever trusted server-side project context exists; absent for account-level transactions (grants, purchases, expirations); **historical entries are never backfilled/fabricated**.
- `grantCredits` / `consumeCredits` in `lib/billing/credit-service.ts` accept and persist `projectId`; charge paths in metering, build-auth, resources, studio, SEO, and collaboration pass it through (e.g. `lib/analysis/collaborate-credits.ts` line 142).
- Index present as required: `creditLedger.createIndex({ projectId: 1, createdAt: -1 }, { name: "credit_ledger_project_created" })` in `lib/db/collections.ts`.
- Per §11, no historical replay or backfill was attempted.

## E. Collaboration idempotency (§6)

**Already committed before this session; verified.**

- `lib/analysis/collaborate-credits.ts`: the debit key is `collaborationIdempotencyKey(userId, projectId, "collaborate", reason, amount)` — derived from the durable identity of the billable event, with an in-code comment naming the fixed Phase 0 defect ("never from a new `cryptoId()` that changes on every call"). `cryptoId()` is used only for the transient `routeId`, never for the ledger key.
- Failure refunds are likewise deterministic: `collab_refund_${collaborationIdempotencyKey(...)}` (line 82), so a retry of charge or refund hits the ledger's unique `idempotencyKey` and is a no-op rather than a double-charge.
- The ledger's unique index on `idempotencyKey` plus `grantCredits`' duplicate-tolerant return give the actual enforcement.

## F. Payment integrity (§7)

This session's changes to `app/api/billing/webhook/route.ts` (plus type updates):

- **New `unresolved` event status** (`lib/types/db.ts`: `"received" | "processed" | "failed" | "ignored" | "unresolved"`). When `payment.succeeded`, `subscription.active`, or `subscription.renewed` is genuinely received but cannot be attributed (missing trusted `userId`/`credits` in metadata, unknown plan, user mismatch), the handler returns a safe reason token and the `webhook_events` record is stored as `status: "unresolved"` with that reason and `processedAt` — discoverable for reconciliation instead of silently "processed".
- **No fabricated amounts:** `payment.failed` / `payment.cancelled` now record `amount?: number` / `currency?: string` only when the payload actually carries them. `PaymentRecord` in `lib/billing/billing-types.ts` marks these optional with "unknown … never fabricated as a confirmed zero".
- **Silent failures are now observable:** `recordPayment` logs *and rethrows* on insert failure (previously swallowed); the event then lands as `failed`. `handlePaymentSucceeded` throws if `grantCredits` reports `success: false`; `handleRefundSucceeded` throws if credit reversal fails — in both cases the payment is never recorded as done while credits are missing. The outer POST still returns 200 ack after logging, so Dodo does not hammer retries of a persisted-failure event.
- Idempotency preserved: duplicate `webhook_id` acked without reprocessing; `recordPayment` skips on existing `dodoPaymentId`; credit grants keyed by `payment_${dodoPaymentId}` / `sub_grant_..._period_...`.
- Dodo checkout, subscription, and refund flows were otherwise left exactly as committed; no provider call semantics changed.

## G. Test results (§10)

Commands actually run on this host (tree-wide `tsc`/`pnpm build` hang here — see the project memory note; CI remains the real build gate):

1. Transient scoped type-check — `tsconfig.phase1-check.json` (23 touched/transitive files) `npx --no-install tsc -p tsconfig.phase1-check.json` → **exit 0**. Temp tsconfig deleted afterward.
2. New Phase 1 suites — `npx --no-install vitest run app/api/billing/legacy-gateway.test.ts app/api/billing/webhook-integrity.test.ts lib/billing/topup-service.test.ts lib/db/collections-topups-retention.test.ts` → **exit 0, Test Files 4 passed (4), Tests 18 passed (18)**:
   - `legacy-gateway.test.ts` (4): create/verify/evidence/admin-approve POSTs all return 410 `DEPRECATED` with no `MTN|Airtel|UGX` leakage in the body.
   - `webhook-integrity.test.ts` (10): invalid signature → 401 with no event insert; duplicate webhook id acked; legitimate `payment.succeeded` grants with `idempotencyKey: "payment_pay_100"`, records payment, marks processed; unattributed `payment.succeeded` → `unresolved`, no grant; `subscription.active` failure → `unresolved`; `payment.failed` without amount → record stored with `amount`/`currency` `undefined` (no fabricated 0); with amount 1500/EUR → preserved verbatim; ledger insert rejection → event `failed` but 200 ack; grant `success:false` → `failed`; refund reversal failure → `failed`.
   - `topup-service.test.ts`: write exports are `undefined`; read-only queries never touch `insertOne`/`updateOne`.
   - `collections-topups-retention.test.ts`: topups index block contains no `expireAfterSeconds`; `dropLegacyIndexes` drops `expiresAt_1`.
3. Full suite — `npx --no-install vitest run` → **Test Files 2 failed | 108 passed (110); Tests 1 failed | 1346 passed (1347)**. Both failures were triaged and are **pre-existing, not Phase 1 regressions**:
   - `lib/auth/__tests__/session.test.ts` (suite-level load error): `Cannot find package 'server-only'` — the package is absent from `package.json`/`node_modules`; every other node-env test mocks it. The import chain that triggers it predates this session's diff.
   - `lib/cofounder/tools/seo.test.ts` "refunds credits when the audit fails": expects `refund(user, project)` but the *uncommitted SEO work-in-progress in the tree* now calls `refund(..., 15)`. Belongs to the user's separate SEO changes, which were preserved untouched.

No real payments, refunds, or credit operations were performed; all webhook/gateway testing used mocked Dodo payloads.

## H. Security and compatibility

- **PII removed from source:** `PAYMENT_RECIPIENT` (personal name + phone) deleted from `lib/billing/packages.ts`.
- **No new secrets or logging exposure:** webhook unresolved reasons are fixed safe tokens (e.g. `missing_user`, `user_mismatch`), not payload dumps; full provider bodies are not logged.
- **Compat for legitimate clients:** retired endpoints return `410` with an actionable Dodo redirect rather than 404/500; admin read-only GET endpoints and the history UI keep working; Dodo checkout/webhook/subscription/refund paths unchanged in behavior aside from integrity hardening; generic currency handling (`PaymentRecord.currency` now correctly optional) accepts any provider currency.
- Pre-existing user work in the tree (SEO/marketing WIP, `.tmp-build-verify.log`, market pages, phase-3 doc) was left intact; nothing was reset, stashed, or force-overwritten.

## I. Remaining blockers / caveats

1. **TTL drop is lazy:** the legacy `expiresAt_1` TTL index is dropped only when `ensureIndexes()` next runs (call sites: `lib/auth/users.ts` ×4, `lib/auth/verification.ts`, `lib/auth/rate-limit.ts`, `app/api/auth/change-email`, `app/api/auth/forgot-password`, `app/api/me/avatar`, `app/api/projects/[id]/assets`). Until then, a live production index could still delete expired-but-undeleted top-ups. Recommend confirming the index is gone in the target cluster post-deploy.
2. **Any history already TTL-deleted in production is unrecoverable** from this change alone — that is a data-recovery question for the owner, not something Phase 1 code can retrofix (§11 forbids backfills).
3. **Environment gap:** `server-only` is not installed, breaking `session.test.ts` at load. Trivial fix (add the package or mock it there), but it's outside Phase 1 scope and touches the user's area — left alone.
4. **The SEO WIP test mismatch** (section G) is the user's unfinished work, not a Phase 1 blocker, but the full suite will stay red until they resolve it.
5. **Explicitly deferred per §11 (out of Phase 1 scope):** refund *netting* against revenue reporting, a webhook replay/recovery worker for `unresolved`/`failed` events, dashboards (the earlier finance-dashboard commit already exists separately), historical attribution replay/backfill, and any new payment provider.
6. CI full build (`pnpm build`) has not been run locally (hangs on this host); the scoped typecheck is the strongest local signal available.

## J. Phase completion decision

**Recommendation: Phase 1 is functionally complete and can be accepted**, conditional on:

- reviewer approval of the uncommitted diff (this session staged 3 deletions, left the rest unstaged; **no commit was made**);
- a CI `pnpm build` + full-suite pass once the two pre-existing failures above are addressed by their owners;
- post-deploy verification that the `topups` `expiresAt_1` TTL index no longer exists in production and that the `credit_ledger_project_created` index is present.

Acceptance criteria mapping: §3 ✅ (committed, verified); §4 ✅ (this session; history preserved); §5 ✅ (committed, verified); §6 ✅ (committed, verified); §7 ✅ (this session); §8 ✅ (no competing universal conversion; remaining 4000/UGX occurrences justified in B); §10 ✅ (18 new tests + scoped typecheck green, full suite triaged); §11 respected — nothing out of scope was built, and Phase 2 was not started.
