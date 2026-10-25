# ATAI Project Finance & Economics — Phase 3 Completion Report

**Financial Reconciliation, Dodo Payment Integrity, Refund Accounting & Idempotency Hardening**

Date: 2026-10-25 · Branch: `main` · Repo: `C:\Users\USER\Desktop\mirrorsiteai` (package `atai`)
Brief: Phase 3 workstream spec (Workstreams A–G, §10 non-goals, §11 testing, §12 report, §13 acceptance)

---

## 1. Executive summary and completion status

Phase 3 is **implemented and verified**. All seven workstreams are delivered; no Phase 4 work was started, and **nothing was committed** (the brief's closing instruction).

What changed in substance:

- **One business-logic path for money.** The Dodo webhook route's inline processing (638 lines, now 185) was extracted into `lib/billing/dodo-event-processing.ts` (new). Live delivery and the recovery worker both call the same `processDodoEvent`, so a replayed event runs the *same* financial invariants as a live one — there is no second, weaker replay path. The route is now signature verification, persistence, and outcome mapping.
- **Durable, discoverable, retry-safe webhook recovery.** `lib/billing/webhook-recovery.ts` (new) adds an atomic-claim batch worker with an attempt budget, exponential backoff, a processing lease, and a terminal `manual_review` state. Eligibility is a *conjunction* (reprocessable type + unexhausted budget + a recoverable state + elapsed backoff), which is what makes "never blindly replay because status is `failed`" true in code, not just in prose.
- **Idempotency hardened where it was actually exploitable.** `credit_ledger.idempotencyKey` has a **global unique index**. Before this phase, several billable operations fed a **client-supplied string** straight into that namespace. New `lib/billing/operation-identity.ts` validates the client intent and re-derives it as `intent_<operation>[_<project>]_<user>~<intent>`, so a retry is stable, a different user cannot collide, and a different operation cannot alias. Nine charge sites and their refund legs now thread it.
- **Refund accounting corrected.** Refunds are separate, traceable `payment_records` rows with a negative amount and a back-pointer to the original payment; the original accumulates `refundedAmountMinor` and advances `succeeded → partially_refunded → refunded`. Credit reversal is proportional **only when both amounts and the currency are authoritative**, otherwise full-and-labelled. Reversal *failure throws* so the event becomes a recoverable discrepancy instead of a silently "processed" refund.
- **Revenue reporting made honest.** `lib/finances/revenue-accounting.ts` (new) is the single definition of gross / refunds / net, minor→major conversion, and the "currencies are never added together" rule; the admin overview and the reconciliation service consume the same vocabulary. The pre-existing `revenue.total` was neither gross nor net — it summed minor-unit amounts across all currencies and ignored refunds entirely.
- **A genuinely read-only reconciliation service.** `lib/finances/reconciliation.ts` (new) evaluates 17 discrepancy types against authoritative records, bounded by a window, and performs **no writes at all**. Underivable relationships become `incomplete_record` / `needs_business_decision`, never a guessed error and never a silent pass.
- **Operator interface, no autopilot.** `GET/POST /api/admin/billing/webhooks` (queue health + one bounded batch) and `GET /api/admin/billing/reconciliation` (+ admin page) are `requireAdmin`-gated. Because this repository still has **no job/cron substrate**, nothing self-fires; that limitation is documented rather than papered over.

Defects found *by* the new tests and fixed (not merely documented): (a) `getRecoveryQueueStats().nextScheduledAttemptAt` could only ever return `null`; (b) four client-facing charge sites plus two cofounder tools passed raw client/approval strings into the global idempotency namespace; (c) the cofounder studio failure path refunded under a *different* key than it charged, i.e. a double-refund vector; (d) `refundSeoAuditCredits` had no identity parameter at all.

Verification: scoped `tsc` **exit 0**; four targeted groups **23 files / 293 tests, all exit 0**; full suite **1584 tests passed (1584)**, 126 of 127 test files passing, exit 1 — the single failing file is a pre-existing `server-only` collection error in unrelated user WIP (§11.4). No commits, no pushes, no real payments.

---

## 2. Initial Git and repository state

Captured at the start of this verification leg (and re-confirmed at the end):

| Fact | Value |
| --- | --- |
| Branch | `main` (unchanged; never switched) |
| HEAD | `91beb13 feat: redesign /new idea & website composers, rebuild voice dictation` at the start of this leg. **During** verification the user committed `aeed79d fix: repair finances roll-up crash and Mongo pool exhaustion` (07:46, 5 files: `lib/api/upstream-error.ts`, `lib/db/collections.ts`, `lib/db/mongodb.ts`, `lib/db/runtime-collections.ts`, `lib/finances/platform-finances.ts`). No Phase 3 file is in that commit: `git ls-files` shows `webhook-recovery.ts`, `operation-identity.ts`, `dodo-event-processing.ts`, `reconciliation.ts`, `revenue-accounting.ts` all still untracked, and `git show aeed79d:lib/db/collections.ts` does **not** contain `webhook_events_recovery_claim`. Nothing was committed or pushed by this workstream. |
| Working tree | Heavily dirty with **user work-in-progress**: 135 `git status --porcelain` entries at the start of this leg — 89 modified, 42 untracked paths, 3 staged deletions (`lib/billing/payment-ref.ts`, `lib/billing/types.ts`, `lib/billing/verify-payment.ts` — the Phase 1 legacy-gateway removal), 1 unstaged deletion (`components/marketing/studio-view.tsx`). Re-measured after the user's `aeed79d` commit: 137 entries (90 modified, 42 untracked, 4 deletion-coded) — `lib/db/mongodb.ts` and `lib/finances/platform-finances.ts` still carry further uncommitted edits, i.e. **the tree was being edited concurrently while this verification ran**. |
| Stash | `stash@{0}: WIP on main: 2d4ae0e feat: pin Collaborate panels…` — pre-existing, untouched |
| Prior phases | Phase 1 and Phase 2 reported in `docs/implementation/atai-finance-phase-1-report.md`, `…-phase-2-report.md`; their code lives in this same dirty tree (uncommitted) |

Handling discipline actually applied: no `reset`, no `stash`, no `checkout --`, no `clean`, no commit, no push. Every edit was a surgical insertion into existing files or a new file. The dirty tree grew during the work because of my own edits, which is expected and itemized in §4.

Note on files that appear in `git diff` but are **not** Phase 3 work: `lib/db/collections.ts` also carries the `ensureIndexes()` readiness/cooldown gating and the top-up TTL-index removal (part of that landed in the user's `aeed79d`; the `webhook_events_recovery_claim` line is still uncommitted), and `lib/auth/session.ts` carries the cookie `Secure`/domain fix from the login-timeout debugging session. Those are listed in §4 for transparency and were left as found.

---

## 3. Payment lifecycle and accounting invariants

Documented once, in `lib/billing/dodo-event-processing.ts`, and enforced by that module:

```
payment.succeeded (credit pack)   → ledger grant  payment_${paymentId}   (permanent credits)
                                    + payment_records row, status "succeeded"
                                    unattributable (no trusted userId / no positive credit count)
                                    → "unresolved": NO grant, NO guess
payment.succeeded (subscription)  → payment record only; credits belong to subscription events
payment.failed / cancelled        → payment record with provider status; never revenue, never a purchase;
                                    renewal failure → subscription past_due (credits kept, Dodo retries)
subscription.active / renewed     → activate / expire-then-grant keyed
                                    sub_grant_${subscriptionId}_period_${dayEpoch(periodEnd)}
                                    (the SAME key for one cycle across active & renewed)
subscription.cancelled / …        → status transitions only; no credit change
refund.succeeded                  → NEW payment_records row (paymentType "refund", negative amount,
                                    originalPaymentId + refundId) ; credit reversal keyed refund_${refundId} ;
                                    original row's refundedAmountMinor/status advanced ;
                                    unassociable or currency-mismatched → "unresolved"
refund.failed / dispute.* / credit.* → logged, no financial effect
```

Invariants:

1. One successful payment grants its credits **at most once** (unique `idempotencyKey`; a duplicate returns `success = true, alreadyApplied = true`).
2. One subscription billing period grants **at most once** (period key).
3. A failed payment is never recorded as succeeded and grants nothing.
4. A refund is a new traceable row; the original payment is never overwritten as if it never happened.
5. Duplicate deliveries are blocked upstream by the unique `webhookId` index **and** remain harmless because every effect is idempotency-keyed — a crash between the ledger write and the status update replays as a no-op.
6. A persistence failure **throws**, so the caller marks the event `failed`; a successful HTTP ack never implies the financial effects completed.
7. Missing authoritative data (user, payment link, amount, currency) produces explicit `unresolved`; nothing is guessed, and nothing absent is fabricated as `0`.

Cross-cutting accounting rules (Phase 3 additions to the same contract):

8. Gross keeps the cash that really was collected; refunds are subtracted **exactly once**, through their own rows — so a report can net a refund but can never double-net it.
9. Currencies are never summed together. Every monetary figure is keyed by an upper-cased currency code; there is no approved FX source in this repository, so no conversion is performed anywhere.
10. `net` means *cash kept*. It is **not** recognized revenue: there is no revenue-recognition policy, deferred-revenue model, or provider-fee ledger here, and nothing in Phase 3 output is labelled as such.
11. Project economics stay separate from account-level payment reporting (a payment row is account-level; only consumption-side entries carry first-class `projectId`).

---

## 4. Files created and modified, with reasons

### 4.1 Created (Phase 3)

| File | Lines | Reason |
| --- | --- | --- |
| `lib/billing/dodo-event-processing.ts` | 681 | Workstream A/B: single authoritative handler extracted from the webhook route so live delivery and recovery share one code path; documents the lifecycle and the 7 invariants. |
| `lib/billing/webhook-recovery.ts` | 290 | Workstream B: atomic-claim batch recovery with eligibility conjunction, attempt budget, backoff, lease reclaim, terminal `manual_review`, queue stats. |
| `lib/billing/operation-identity.ts` | 90 | Workstream C: `scopedIntentKey()` + `dayEpoch()` — validates a client intent and re-derives it inside a server-owned namespace. |
| `lib/billing/reversal-types.ts` | 61 | Workstream D: one vocabulary for which ledger transaction types are reversals and their expected sign. |
| `lib/billing/credit-valuation.ts` | 180 | Workstream D: the 3,750-credits = US$1.00 reference valuation kept in one place and explicitly *not* used to invent profit. |
| `lib/finances/revenue-accounting.ts` | 263 | Workstream D: gross/refunds/net, minor→major, currency purity, unknown-amount reporting, `moneyMatch`/`moneyPipeline` for aggregation reuse. |
| `lib/finances/reconciliation.ts` | 790 | Workstream E: read-only, bounded, 17-type discrepancy engine with cursor paging and a collection seam for deterministic tests. |
| `app/api/admin/billing/reconciliation/route.ts` | 61 | Workstream G: admin-only GET over the reconciliation service; no POST/PUT/DELETE by design. |
| `app/admin/billing/reconciliation/page.tsx` | 429 | Workstream G: operator view for findings, severity/type filters, paging, and the "scan was not exhaustive" flag. |
| `app/api/admin/billing/webhooks/route.ts` | 81 | Workstream G: GET queue health + POST one bounded recovery batch (`requireAdmin`, limit clamped to `MAX_BATCH_LIMIT`). |
| `lib/billing/operation-identity.test.ts` | 229 | §11 credit-idempotency evidence: 19 tests incl. two fast-check properties. |
| `lib/billing/webhook-recovery.test.ts` | 814 | §11 webhook-recovery evidence: 29 tests against a deterministic in-memory Mongo/ledger model. |
| `lib/finances/revenue-accounting.test.ts` | 245 | §11 refunds-and-revenue evidence: 18 tests. |
| `lib/finances/reconciliation.test.ts` | 600 | §11 reconciliation evidence: 33 tests incl. false-positive policy. |
| `lib/billing/reversal-types.test.ts` | 50 | Reversal vocabulary/sign contract: 4 tests. |
| `app/api/projects/[id]/studio/refine-intent.test.ts` | 182 | Workstream C boundary evidence: 8 tests (cross-user, cross-operation, forged-key, strict-schema). |

### 4.2 Modified (Phase 3 edits)

| File | Change | Reason |
| --- | --- | --- |
| `app/api/billing/webhook/route.ts` | 638 lines → 185: verification + persistence + delegation only | Live route and recovery must not diverge (Workstream A/B). |
| `lib/types/db.ts` | `WebhookEventStatus` gains `processing` and `manual_review`; `WebhookEventDoc` gains optional `attempts`, `lastAttemptAt`, `nextAttemptAt`, `reviewReason` | Recovery bookkeeping; all optional so historical docs read as `attempts: 0` — no migration, no rewrite. |
| `lib/billing/billing-types.ts` | `PaymentRecord` gains `originalPaymentId`, `refundId`, `refundedAmountMinor`; `ReconciliationIssueType` extended with the Phase 3 types; `ReconciliationIssue` shape documented | Refund traceability + one vocabulary shared by report and reconciliation. |
| `lib/db/collections.ts` | Adds `webhook_events_recovery_claim` `{status, nextAttemptAt, receivedAt}` (named) | The claim query needs one indexed path; (same file also carries non-Phase-3 index/gating edits, §2). |
| `lib/marketing/seo/credits.ts` | `chargeSeoAuditCredits(userId, projectId, intentKey?)`, `refundSeoAuditCredits(..., amountMinor, intentKey?)` → `seo_${intentKey}` / `seo_${intentKey}_refund` | A retried audit cannot double-charge; a retried refund cannot double-refund. |
| `lib/marketing/studio/credits.ts` | Same contract + docblock stating the caller MUST pass `scopedIntentKey()` output | Documents who owns scoping (this module cannot know the operation). |
| `lib/resources/resources-credits.ts` | `resources_${intentKey}` / `resources_${intentKey}_refund` | Same, for the four Resources AI operations. |
| `lib/infrastructure/service.ts` | Accepts an intent key → `infra_${intentKey}`, otherwise the pre-existing `infra_${projectId}_${plan.id}_${minute}` fallback | Retry-safe without making distinct upgrades collide. |
| `app/api/projects/[id]/seo-audit/route.ts` | `scopedIntentKey(body.requestId, { operation: "seo_audit", … })` threaded into charge and refund | Workstream C. |
| `app/api/projects/[id]/resources/{action-plan,competitors,market-research,marketing-playbook}/route.ts` | Intent key derived per operation and reused on the refund leg | Workstream C. |
| `app/api/projects/[id]/generate-visual/route.ts` | `scopedIntentKey(..., { operation: "visual_generation" })` → `visual_${intentKey}` | Workstream C (charge-after-provider-success, so no refund leg exists). |
| `app/api/projects/[id]/infrastructure/route.ts` | `scopedIntentKey(..., { operation: "infrastructure_plan" })` | Workstream C. |
| `app/api/projects/[id]/studio/refine/route.ts` | Raw `parsed.data.requestId` → `scopedIntentKey(..., { operation: "studio_refine" })` | Was a direct client-string injection into the global namespace. |
| `app/api/projects/[id]/studio/variations/route.ts` | Same, `studio_variations` | Same defect; distinct operation so one requestId cannot alias the other. |
| `lib/cofounder/tools/studio.ts` | Both tools derive the key from `ctx.pendingActionId` (`studio_generate`, `studio_refine_tool`) and **reuse the identical key on the refund leg** | Closed the double-refund vector where the failure path refunded under no identity. |
| `lib/cofounder/tools/seo.ts` | Same treatment, `seo_audit`, with the key passed to both charge and refund | Last remaining raw-`pendingActionId` site. |
| `app/api/admin/billing/overview/route.ts` | Revenue figures now come from `revenue-accounting` (gross/refunds/net, per currency, major units, explicit `basis`) | Removes the cross-currency minor-unit sum. |
| `app/api/admin/billing/user-billing/route.ts`, `app/api/admin/stats/route.ts`, `app/admin/billing/page.tsx`, `app/admin/billing/webhooks/page.tsx` | Read the shared vocabulary / surface queue health | Reports and diagnostics cannot disagree. |
| `lib/cofounder/tools/seo.test.ts`, `lib/cofounder/tools/studio.test.ts` | Stale expectations updated to the new (correct) contract + retried-approval tests | §11 compatibility; see §11.4 for why the SEO mismatch was Phase-3-caused and how it was resolved. |
| `components/marketing/seo-audit-panel.tsx` | Refund-status surfacing for the 4-arg refund contract | UI must not claim a refund that failed. |

---

## 5. Webhook recovery architecture and safety guarantees

**States** (`lib/types/db.ts`): `received → processed | unresolved | failed`, plus Phase 3's `processing` (claimed by a recovery worker) and `manual_review` (terminal for operators: budget exhausted or not safely re-processable — **never** auto-replayed).

**Eligibility** (`eligibleFilter` + `claimableFilter`) is a conjunction, evaluated by one indexed query:

1. `eventType ∈ REPROCESSABLE_EVENT_TYPES` (12 types — payments, refunds, subscription lifecycle). Unknown, informational, and dispute types are structurally excluded: there is nothing to recompute.
2. Attempt budget unexhausted: `attempts: { $not: { $gte: MAX_ATTEMPTS } }` — which also matches historical documents with **no** `attempts` field (treated as 0), so no backfill is required.
3. A state from which recovery is meaningful: `failed`/`unresolved`, **or** `received` older than `STALE_RECEIVED_GRACE_MS` (5 min — a live delivery that crashed between insert and outcome update), **or** `processing` whose `lastAttemptAt` is older than `PROCESSING_LEASE_MS` (15 min — a recovery worker that died mid-attempt).
4. Backoff elapsed: `nextAttemptAt` absent (pre-Phase-3 docs ⇒ due) or `≤ now`.

Because (1)–(4) all have to hold, a `failed` event of a non-reprocessable type, an event past its budget, or an event still in backoff is **never** replayed. That is the code-level answer to "never blindly replay just because its status is `failed`".

**Claiming** uses a single `findOneAndUpdate(claimableFilter, { $inc: { attempts: 1 }, $set: { status: "processing", lastAttemptAt: now } }, { returnDocument: "after", sort: { receivedAt: 1 } })` — atomic, oldest-first, exactly one winner per event. This is the same discipline as `claimPendingAction`, the repo's existing double-approval guard.

**Execution** calls `processDodoEvent` — the identical function the live route calls. Outcomes settle as:

- `processed` → `processedAt` set, `nextAttemptAt: null`, `reviewReason: null`.
- `unresolved` / `failed` → `nextAttemptAt = now + backoffMs(attempts)`, `error` = secret-free reason.
- Budget exhausted → `manual_review` with `reviewReason`, `nextAttemptAt: null` (so it can never be claimed again by the worker).

**Backoff**: `min(5 min · 4^(attempts−1), 24 h)` → 5 min, 20 min, 80 min, 320 min, 1280 min, capped 24 h thereafter; strictly monotonic and tested up to attempt 60.

**Batch bounds**: `limit` defaults to 10, clamped to `[1, MAX_BATCH_LIMIT = 50]`; the result carries `hasMore` so an operator knows the queue is deeper than the batch.

**Provenance**: queued events were persisted only *after* signature verification, with the payload and `payloadHash` stored. Recovery therefore re-trusts nothing external and never re-verifies (tests assert `verifySignature` is not called and the stored hash is untouched).

**Honest scheduling boundary**: this repository has **no job/cron/worker substrate** (documented since Phase 0). `runRecoveryBatch` is invoked only by an authorized operator through `POST /api/admin/billing/webhooks` (`requireAdmin`). Nothing self-fires; tests assert `vi.getTimerCount() === 0` after a batch and a stats read.

---

## 6. Idempotency coverage matrix for retryable financial operations

| Operation | Charge key | Reversal key | Identity source (server-derived) | Retry behaviour |
| --- | --- | --- | --- | --- |
| Dodo payment grant (pack) | `payment_${paymentId}` | — | Provider `payment_id` from the verified payload | Duplicate delivery → ledger no-op (`alreadyApplied`) |
| Dodo refund reversal | — | `refund_${refundId}` | Provider `refund_id` | Repeated refund event reverses once |
| Subscription period grant | `sub_grant_${subId}_period_${dayEpoch(periodEnd)}` | (expiry: `expireSubscriptionCredits` no-op row) | Provider `subscription_id` + period end | Same key across `active` & `renewed` for one cycle → cannot grant twice |
| Welcome / signup grants | `welcome_${userId}`, `signup_${userId}_google` | — | Session/user id | Stable per user |
| SEO audit (REST) | `seo_${intentKey}` | `seo_${intentKey}_refund` | `scopedIntentKey(body.requestId, {operation:"seo_audit", projectId, userId})` | Same logical retry → same key; absent/invalid requestId → `cryptoId()` (distinct attempts stay distinct) |
| SEO audit (cofounder tool) | `seo_${intentKey}` | `seo_${intentKey}_refund` | `scopedIntentKey(ctx.pendingActionId, …)` (server-side approval id) | Retried approval of the same action charges once |
| Resources AI × 4 | `resources_${intentKey}` | `resources_${intentKey}_refund` | `operation ∈ {resources_action_plan, resources_competitors, resources_market_research, resources_playbook}` | Per-operation namespace: one requestId cannot alias another action |
| Visual generation | `visual_${intentKey}` | *(no refund leg by design)* | `operation: "visual_generation"` | Charge happens **after** the provider returns an image; provider failure returns "you were not charged" and never touches the ledger |
| Infrastructure upgrade | `infra_${intentKey}` | (bucket-safe reversal in `consumeCredits`) | `operation: "infrastructure_plan"` | Fallback preserved: `infra_${projectId}_${plan.id}_${minute}` when no intent |
| Studio refine / variations (REST) | `studio_${intentKey}` | `studio_${intentKey}_refund` | `operation ∈ {studio_refine, studio_variations}` | Was a raw client string; now scoped + validated |
| Studio generate / refine (cofounder tools) | `studio_${intentKey}` | `studio_${intentKey}_refund` | `operation ∈ {studio_generate, studio_refine_tool}`, intent = `ctx.pendingActionId` | Refund reuses the **identical** identity the charge used |
| Project creation | existing create-idempotency record | — | `findCreateIdempotency(userId, key)` — already user-scoped | Verified, unchanged |
| Admin credit adjustment | `admin_${adminId}_…` | — | Session admin id | Unchanged; the sanctioned manual correction path |

Guarantees that make the matrix hold:

- **Validation before use.** `scopedIntentKey` accepts only `^[A-Za-z0-9:._-]{6,128}$` after trimming; anything else returns `undefined`, and the caller falls back to a fresh random key — never to the raw client value. Length/charset limits on `operation`, `userId`, `projectId` are enforced server-side; over-long components are **rejected, not truncated** (truncation at 64 chars would alias two accounts sharing a prefix).
- **Provably unique split.** `~` separates the scope from the intent because it is absent from every component charset; without it, `_` being both separator and legal intent character let `user="u_x", intent="k"` fold onto `user="u", intent="x_k"`.
- **Authorization is never derived from the key.** The userId and projectId inside the key come from the session and the ownership check; the key is bookkeeping only, and the routes still verify ownership before charging (404-uniform for foreign projects).
- **Distinct operations do not collide** — asserted directly in tests (refine vs variations for one requestId; cross-user with the same requestId; per-operation namespaces).

---

## 7. Refund accounting rules and supported partial-refund behaviour

Confirmed refunds are accounted as **their own rows**, never as edits to history:

1. `refund.succeeded` writes a new `payment_records` row with `paymentType: "refund"`, `status: "refunded"`, `dodoPaymentId = refundId`, `refundId`, `originalPaymentId`, and `amount = −refundAmountMinor` (negative by construction, so "sum of rows" and "cash kept" agree).
2. Credits are reversed once, keyed `refund_${refundId}`, `transactionType: "refund_reversal"`, referencing the refund.
3. The **original** payment row advances: `$inc: { refundedAmountMinor }` and `status = next ≥ total ? "refunded" : "partially_refunded"`. When the event carries no authoritative amount, only the lifecycle status advances — **no monetary progress figure is invented**.
4. Reversal sizing:
   - **Full refund** → reverse the whole grant.
   - **Partial refund** → proportional share `max(1, floor(creditsGranted · refundAmount / originalAmount))`, applied **only** when both amounts are positive and the currencies match.
   - Partial refund **without** an authoritative original amount → full reversal (previously agreed policy) and the ledger metadata records `partialRefund: false`-style truth plus the amounts actually seen, so the choice is auditable rather than silent.
   - **Currency mismatch** → not converted, not netted: the refund is `unresolved` for reconciliation. Amounts are never moved across currencies anywhere in this codebase.
5. Failure semantics: `reverseCredits` returning `success: false` **throws**, so the event lands `failed` and stays discoverable. A refund whose reversal did not happen is never reported as processed. Reversal against an empty/partial balance is a real ledger event, not a silently absorbed loss.
6. Revenue impact (`lib/finances/revenue-accounting.ts`): `gross` = collection rows in a collected state (`succeeded`, `partially_refunded`, `refunded` — the cash really was collected and stays); `refunds` = magnitude of refund rows; `net = gross + refunds` (rows carry the negative sign) — subtracted **exactly once**, because refund rows are excluded from `gross` by predicate, not by convention. `unknownAmountRows` counts rows with no amount instead of summing them as zero.
7. Historical safety: refund rows that predate `originalPaymentId` are evaluated with that absence as *unknown*, producing `incomplete_record`, not `refund_without_payment`. No historical amount, currency, or attribution was edited to make the new model tidy.

**Not supported and explicitly not faked**: partial *credit* clawback below one credit (a reversal of at least 1 credit is taken — `max(1, …)`), fee/refund-cost accounting, disputes-as-revenue, and any FX normalization.

---

## 8. Reconciliation discrepancy types and resolution paths

`lib/finances/reconciliation.ts` — read-only by construction (no `insertOne`, `updateOne`, `deleteOne`, or bulk operation exists in the module; a run reports `readOnly: true`, and the route fails the request if it ever is not).

| Type | Severity | What is compared | Resolution path |
| --- | --- | --- | --- |
| `payment_without_grant` | critical | succeeded payment row ↔ `payment_${id}` / period grant | Recovery batch (re-runs `processDodoEvent`) |
| `grant_without_payment` | critical | ledger grant ↔ payment row | `under_review` (investigate the grant source; never auto-delete) |
| `duplicate_payment_records` | warning | non-unique `dodoPaymentId` safety net | `under_review` |
| `refund_without_payment` | critical | refund row's `originalPaymentId` ↔ payment | Recovery batch once the payment lands |
| `refund_without_reversal` | critical | refund row ↔ `refund_${refundId}` reversal | Recovery batch (idempotent reversal) |
| `reversal_without_refund` | critical | reversal row ↔ refund row | `under_review` (manual-adjust audit) |
| `duplicate_refund_records` | warning | non-unique `refundId` | `under_review` |
| `webhook_unresolved` | warning | events in `unresolved` beyond the grace window | Recovery batch, or `needs_business_decision` when attribution is impossible |
| `webhook_failed_recovery` | warning | `failed` events with budget/backoff still available | Recovery batch |
| `webhook_manual_review` | critical | terminal `manual_review` events | `needs_business_decision` — a human decides; the worker will not retry |
| `payment_attribution_missing` | warning | payment with no trusted `userId` | `needs_business_decision` |
| `subscription_period_mismatch` | warning | active subscription ↔ this period's `sub_grant_…` | Recovery batch |
| `subscription_mismatch` | warning | subscription status ↔ record status | `under_review` |
| `unexpected_ledger_entry` | warning | ledger row whose type/direction contradicts `reversal-types` vocabulary | `under_review` |
| `duplicate_credit_grant` | warning | same business id granted twice with different keys | `under_review` |
| `ledger_balance_mismatch` | critical | Σ ledger (buckets) ↔ stored balance | `under_review`, then `adminAdjustCredits` (ledger-keyed) |
| `incomplete_record` | info | a relationship that **cannot** be evaluated from authoritative fields | `needs_business_decision` (explicitly distinct from a confirmed error) |

Deliberate non-findings (false-positive policy, each covered by a test): an active subscription whose user has spent its period grant down to 0; a dual-field balance of 0 against a positive legacy `credits` total (that is what an unpopulated split means); a `subscription_expiration` row with amount 0 (the documented idempotent no-op written by `expireSubscriptionCredits`).

Boundedness and honesty: one window per source (`DEFAULT_WINDOW_SIZE = 250`, hard max `1000`), findings capped at `MAX_FINDINGS_PER_PAGE = 200`, duplicate scans capped at 50 groups, joins via `$in` on indexed keys, `window.more` / `truncated` surfaced so "no findings" is never readable as "the books are clean", and `deferredRecent` counted for records inside `ATTRIBUTION_GRACE_MS` (10 min) that may still be in flight. Cursor paging is offset-encoded and length-capped; filters (`userId`, `types ≤ 20`, `severity`) are validated at the route before reaching the service. Findings carry identifiers, amounts, and bookkeeping only — **no webhook payload body**, no customer emails, no credentials.

---

## 9. Changes to revenue and project economics aggregation

**Admin revenue (`app/api/admin/billing/overview/route.ts`)** now consumes `lib/finances/revenue-accounting.ts`:

- `revenue.total` keeps its *measure* (gross cash collections, USD, converted from minor to major units at the boundary) but gains `basis: "gross_usd_collections_minor_units_converted"`, explicit `gross` / `refunds` / `net` figures, per-currency rows, and `unknownAmountRows`. It is documented as gross, not net, and never as recognized revenue.
- Payment-by-product-type and revenue-by-day groupings key on `{paymentType, $toUpper(currency)}` so a non-USD amount can no longer inflate a "USD" figure; the day-series filters `currency ∈ {USD, usd}`.
- Refund rows are excluded from collection predicates by the shared `isCollectionRow`/`moneyMatch` logic rather than by a hand-written status list, so the report and the reconciliation service cannot drift apart.

**User-billing / admin stats** read the same vocabulary; the credit overview keeps `netCredits = grants − charges` with bucket-aware (`_sub` / `_perm`) reversal handling and never nets funding credits against consumption.

**Project economics (Phase 2 surface) — compatibility preserved.** `lib/finances/project-economics.ts` and `GET /api/projects/:id/economics` were not redesigned in Phase 3; the only Phase 3 influence is upstream and additive: consumption entries now carry more stable idempotency keys, and the same ledger remains the single source of credit consumption. Verified by re-running the Phase 2 economics suites: `project-economics`, `cost-status`, `platform-finances`, `project-finances`, `provider-cost-currency` → **5 files / 84 tests passed, exit 0**. Account-level payment reporting stays out of project economics: payments are account-level; only consumption entries carry `projectId`.

**No backfill, no rewrite.** Historical account-level transactions were *not* retroactively attributed to projects, and no historical amount was adjusted. §14 records the evidence.

---

## 10. Database schema and index changes

Schema (all **additive and optional** — no migration script, no backfill, no field removed or retyped):

| Collection | Field(s) added | Notes |
| --- | --- | --- |
| `webhook_events` | `attempts?: number`, `lastAttemptAt?: number`, `nextAttemptAt?: number`, `reviewReason?: string`; status enum extended with `processing`, `manual_review` | Historical docs lack these → read as `attempts: 0`, `nextAttemptAt` absent = due. Old documents can therefore be claimed safely without a data migration. |
| `payment_records` | `originalPaymentId?`, `refundId?`, `refundedAmountMinor?: number` (minor units, original currency) | Absent `refundedAmountMinor` = no refund recorded — never materialized as a fabricated `0`. Legacy refund rows without `originalPaymentId` evaluate as *unknown*, not as discrepancies. |
| `credit_ledger` | none new | Reversal vocabulary and expected signs live in `lib/billing/reversal-types.ts`; `transactionType: "refund_reversal"` was already in the type union. |

Indexes:

- **Added:** `webhook_events_recovery_claim` on `{ status: 1, nextAttemptAt: 1, receivedAt: 1 }` — exactly the claim pattern (`status ∈ … AND nextAttemptAt ≤ now`, oldest-first by `receivedAt`) and the stats aggregation.
- **Relied upon (pre-existing, now load-bearing):** `credit_ledger_idempotency_unique` on `idempotencyKey` (global uniqueness — the reason client strings were an exploitable shared namespace, and the reason replays are no-ops); `webhook_events_webhook_id_unique`; `webhook_events_id_unique`; `payment_records_dodo_id_unique`; `credit_ledger_project_created` (Phase 2).
- **Present in the same diff but *not* Phase 3:** `contentItems` `{projectId,status,updatedAt}` / `{projectId,plannedAt}`, `brandProfiles` unique `{projectId}`, and the removal of the top-ups TTL `expiresAt_1` index (retention of historical Mobile-Money top-up records) — user/earlier-phase work, left untouched.
- `ensureIndexes()` remains best-effort and idempotent (`createIndex` is a no-op when an equivalent index exists); it no longer blocks requests, which is why login worked during testing.

Key-format change risk: Phase 3 changed the *shape* of intent-derived ledger keys (`seo_…`, `studio_…`, `resources_…`, `visual_…`, `infra_…`). Because all Phase 3 code is still **uncommitted and undeployed**, no production rows exist under the new shape, so there is nothing to migrate — a bare client string deployed under the old shape would have been the hazard. If any pre-Phase-3 rows were written from the studio routes with a bare `requestId`, the retry behaviour is safe-by-design: a new attempt simply gets a new, correctly-scoped key, and no existing row is edited.

---

## 11. Test commands, exit codes, and results

All commands run from the repository root with the installed toolchain (`vitest 5.0.1`, `node` environment, `npx --no-install` so nothing was fetched or installed). Deterministic fixtures; no live provider, no real DB, no real money (§14).

### 11.1 Type-check

| Command | Exit | Result |
| --- | --- | --- |
| `npx --no-install tsc -p tsconfig.phase3-check.json` | **0** | No output. Transient `include`-scoped tsconfig covering the whole Phase 3 file set (sources, routes, admin pages, and every new/updated test file) plus `next-env.d.ts`. A tree-wide `tsc`/`pnpm build` is known to hang in this Windows environment, hence the scoped config. **The temp config was deleted after the final run** (§13.5). |

### 11.2 Targeted Phase 3 groups

| # | Command | Exit | Test Files | Tests |
| --- | --- | --- | --- | --- |
| 1 | `npx --no-install vitest run lib/cofounder/tools/seo.test.ts lib/cofounder/tools/studio.test.ts lib/billing/operation-identity.test.ts lib/billing/webhook-recovery.test.ts "app/api/projects/[id]/studio/refine-intent.test.ts"` | **0** | 5 passed (5) | **81 passed (81)** — seo 11, studio 14, operation-identity 19, webhook-recovery 29, refine-intent 8 |
| 2 | `npx --no-install vitest run app/api/billing/webhook-refunds.test.ts app/api/billing/webhook-integrity.test.ts lib/billing/credit-valuation.test.ts lib/billing/visual-pricing.test.ts lib/billing/topup-service.test.ts lib/db/collections-topups-retention.test.ts app/api/billing/legacy-gateway.test.ts` | **0** | 7 passed (7) | **56 passed (56)** |
| 3 | `npx --no-install vitest run lib/finances/revenue-accounting.test.ts lib/finances/reconciliation.test.ts lib/billing/reversal-types.test.ts lib/marketing/seo/credits.test.ts lib/marketing/studio/credits.test.ts lib/resources/resources-credits.test.ts` | **0** | 6 passed (6) | **72 passed (72)** — reconciliation 33, revenue-accounting 18, reversal-types 4, seo/credits 4, studio/credits 7, resources/credits 6 |
| 4 | `npx --no-install vitest run lib/finances/project-economics.test.ts lib/finances/cost-status.test.ts lib/finances/platform-finances.test.ts lib/finances/project-finances.test.ts lib/finances/provider-cost-currency.test.ts` | **0** | 5 passed (5) | **84 passed (84)** — Phase 2 compatibility |
| — | **Targeted total** | **0** | **23 files** | **293 tests, 0 failures** |
| 5 | The same 23 files re-run as ONE command after the user's `aeed79d` commit (final confirmation): `npx --no-install vitest run <groups 1–4>` | **0** | **23 passed (23)** | **293 passed (293)** — 54.82 s |

### 11.3 Full suite

| Command | Exit | Test Files | Tests | Duration |
| --- | --- | --- | --- | --- |
| `npx --no-install vitest run` | **1** | 1 failed / 126 passed (127) | **1584 passed (1584)** — **0 failed assertions** | 211.78 s |

The exit code is `1` solely because one test *file* failed to load; not a single test assertion failed anywhere in the repository. An earlier full run (before the final `seo.ts` threading) reported `2 failed / 124 passed (126)` with `1 failed test` — that failure was the stale SEO refund assertion described in §11.4; it is fixed and re-verified in the run above.

### 11.4 The two issues named in previous reports, re-checked against this checkout

**a) "Missing `server-only` dependency" — real, pre-existing, unrelated to Phase 3.**
Evidence: `lib/intelligence/overview.ts:1` is `import "server-only"`; `node -e "require.resolve('server-only')"` → `MODULE_NOT_FOUND`; no `node_modules/server-only`, nothing in the pnpm virtual store, no entry in `package.json` dependencies or `pnpm-lock.yaml`, and no `.d.ts` stub. 156 files across `lib/app/components` import it, and the repository's convention is that each *test* that reaches that graph adds `vi.mock("server-only", () => ({}))` — 64 test files do exactly that. `lib/intelligence/overview.test.ts` (an untracked, whole-directory user WIP feature: `lib/intelligence/`, `components/intelligence/`, `app/project/[projectId]/intelligence/`) omits the stub, so it fails at import time:

```
$ npx --no-install vitest run lib/intelligence/overview.test.ts   → exit 1
Error: Cannot find package 'server-only' imported from
C:/Users/USER/Desktop/mirrorsiteai/lib/intelligence/overview.ts
 ❯ lib/intelligence/overview.ts:1:1
```

No test assertion in that file is reachable, and no Phase 3 file is involved. It is **not** a Phase 3 regression, and it is **not** a Phase 3 fix: the correct repair is either the one-line repo-standard mock in that test, or declaring `server-only` as a real dependency — both belong to the intelligence-feature owner's work, outside Phase 3's scope and outside the brief's §10 non-goals. Deliberately left unmodified, and the run above is the evidence.

**b) "SEO test expectation mismatch" — was a stale expectation created by Phase 3's own signature change; now fixed.**
`refundSeoAuditCredits` gained a fourth parameter (the intent key) earlier in Phase 3, while `lib/cofounder/tools/seo.test.ts` still asserted the old 2-arg call (`("user_1","proj_1")` vs the actual `("user_1","proj_1",15,undefined)`). That mismatch was first visible in a full-suite run and was **not** misattributed: I re-checked it against the checkout, confirmed the signature change was mine, and then closed the real gap it revealed — `lib/cofounder/tools/seo.ts` was still passing a bare `ctx.pendingActionId` into the global ledger namespace. The tool now derives `intentKey = scopedIntentKey(ctx.pendingActionId, { userId, operation: "seo_audit", projectId })` and reuses that same identity for charge and refund; the test asserts the scoped shape, retried-approval single-charge, and refund-identity equality. Result: **11 tests passed, exit 0**.

### 11.5 §11 requirement → test mapping

| Brief requirement | Test |
| --- | --- |
| Eligible failed and unresolved events are discovered | webhook-recovery › *failed payment re-runs*; *unresolved refund resolves once its payment lands* |
| Already processed events are not replayed | › *never claims processed / ignored / manual_review* |
| Retry limits and backoff are respected | › *exact backoff schedule, capped and monotonic to attempt 60*; *still-failing event schedules `now + backoffMs(attempts)`*; *budget exhaustion → `manual_review` and is never re-claimed* |
| Concurrent workers cannot apply duplicate effects | › *two `Promise.all` batches handle 4 events exactly once* (atomic `findOneAndUpdate` claim; balance 20 000, one row each) |
| Crash after a successful ledger write does not produce a second grant | › *crash-after-ledger-write replay grants once and writes one payment row*; *subscription-period replay grants once* |
| Missing metadata results in safe unresolved handling | › *legacy docs with no `attempts`*; *non-reprocessable types skipped*; *throwing handler ⇒ `failed` with reason and NO refund row*; revenue/reconciliation `incomplete_record` suites |
| Invalid webhook signatures are rejected | `app/api/billing/webhook-integrity.test.ts` (route-level verification, 4/7 of group 2) + recovery › *provenance: `verifySignature` never called, stored `payloadHash` untouched* |
| Recovery uses the same financial invariants as normal processing | Both suites call the same `processDodoEvent`; › *three batches leave balance and ledger rows unchanged when nothing is missing* |
| Duplicate payment / subscription-period events do not duplicate grants | webhook-recovery + `webhook-refunds.test.ts` |
| Repeated refund events do not duplicate reversals | `webhook-refunds.test.ts`; revenue-accounting netting suite |
| Distinct legitimate partial refunds remain distinguishable | `webhook-refunds.test.ts` (per-`refundId` keys) + refund tests in reconciliation |
| Retried SEO / Resources AI / visual / infrastructure operations cannot double-charge | seo/credits, resources/credits, studio/credits, operation-identity, refine-intent, cofounder seo + studio suites |
| Distinct operations do not collide | operation-identity › *cross-operation / cross-project isolation*; refine-intent › *refine vs variations differ for one requestId* |
| Successful payment + no refund / + full refund / + partial refund | revenue-accounting suites (gross/refunds/net per currency) |
| Duplicate refund event · refund succeeds but reversal fails · reversal succeeds but confirmation unavailable | `webhook-refunds.test.ts` › *repeated refund events do not duplicate the reversal or the progress*; *refund succeeds but the credit reversal fails → event is failed, not processed*; *amount absent → nothing is recorded as a confirmed monetary refund* (the closest analogue for "confirmation unavailable": the reversal follows the confirmed grant while **no** monetary progress is written). The exact "provider withdrew confirmation after our reversal" scenario has **no distinct test** — the behaviour is the same fail-loud/discoverable path, and the gap is recorded in §13. |
| Missing or mismatched currency | revenue-accounting › currency purity + `unknownAmountRows`; refund → `unresolved` |
| Failed/cancelled payments not treated as revenue | revenue-accounting › `COLLECTED_STATUSES` exclusion |
| Revenue aggregation does not double-net a refund | revenue-accounting › netting tests (refund rows excluded from gross by predicate) |
| Mixed currencies remain separated | revenue-accounting + admin overview grouping (`$toUpper(currency)`) |
| Each supported discrepancy type is detected | reconciliation (33 tests over the 17 types) |
| Healthy records produce no false discrepancies | reconciliation › deliberate non-findings suite |
| Incomplete records stay distinct from confirmed errors | reconciliation › `incomplete_record` severity `info`, `needs_business_decision` |
| Diagnostics are bounded and do not expose payloads | reconciliation › window/truncation + payload-absence assertions |
| Reconciliation does not rewrite historical records | › the service exposes no write method; `readOnly` flag asserted; route rejects a non-read-only run |
| Existing Dodo checkout/subscription behaviour | top-up, checkout-return, consume-plan, legacy-gateway suites (group 2/4) |
| Credit balance semantics remain correct | credit-valuation, consume-plan, studio/seo/resources credit suites |
| Ownership and admin access controls remain enforced | refine-intent › strict-schema 422; route guards (`requireUser`/`requireAdmin`) covered in webhook-integrity; 404-uniform foreign-project cases in the cofounder suites |
| Historical records remain accessible | optional-field design (§10) + reconciliation legacy-doc cases |
| Phase 2 economics endpoint remains compatible | group 4 (84 tests, exit 0) |
| Existing tests for unrelated user work remain intact | full suite: 1584/1584 assertions pass; only the pre-existing `server-only` load error remains (§11.4a) |

### 11.6 Verification not completed (stated plainly)

- **Concurrent edits.** The user committed `aeed79d` and continued editing `lib/db/mongodb.ts` / `lib/finances/platform-finances.ts` while this verification ran (§2). Every command above was executed against the tree as it stood at that moment; the full-suite result was captured after the commit, and no Phase 3 file was touched by the user's edits.
- **Production `pnpm build` was not run and did not pass or fail — it did not complete in this environment.** Tree-wide `tsc -p tsconfig.json` and `pnpm build` hang on this Windows checkout (documented in project memory before Phase 3 began), which is why the scoped tsconfig was used. No build success is claimed.
- No test ran against a real MongoDB instance or the real Dodo API. The recovery and reconciliation suites use deterministic in-memory fakes that implement the subset of the driver they exercise (`findOneAndUpdate`, `$match/$group` aggregation, the Mongo operator subset) and the real ledger invariants (duplicate-key ⇒ `alreadyApplied`; debit fails when the balance is insufficient). Real-driver behaviour — in particular index-backed claim atomicity under true concurrency — is **reasoned from the documented atomicity of `findOneAndUpdate`**, not empirically observed against Atlas.
- `app/admin/billing/reconciliation/page.tsx` and the webhooks page were type-checked but not rendered in a browser during this session.

---

## 12. Security and operational considerations

- **Authorization boundaries unchanged and enforced.** Every new surface is `requireAdmin()` (`/api/admin/billing/webhooks`, `/api/admin/billing/reconciliation`, and the admin pages); project-scoped charge routes keep `requireUser()` plus an ownership check that answers 404-uniformly for foreign projects. There is no user-facing endpoint that can trigger recovery or reconciliation.
- **Client input is never trusted as authorization or as an identity.** Intent strings are validated (charset, length, no delimiter injection), then re-derived inside a server-owned namespace; invalid values degrade to a fresh random key rather than passing through. Request schemas stay `.strict()`, so injected `userId`/`projectId` fields are rejected (tested: 422, no charge). A forged `intent_…_victim~hijacked` value is rejected on charset/shape and can never impersonate another scope.
- **No write surface for reconciliation.** The route exposes GET only; the service has no write call. Repairs go through the two sanctioned, idempotent, state-validated paths: the bounded recovery batch, and `adminAdjustCredits` (ledger-keyed, admin-attributed).
- **Secret and payload hygiene.** Webhook payloads stay in the events collection with their hash; findings and batch results carry identifiers, amounts, and secret-free reasons only. Logs go through the structured logger with stage names and no payment credentials, no customer emails, and no raw payloads. Recovery never re-verifies or re-serializes signatures.
- **Operational blast radius is bounded by design.** Batch size ≤ 50 events, reconciliation window ≤ 1000 records per source and ≤ 200 findings per page; both surface `hasMore` / `truncated` so operators cannot mistake a partial scan for a clean book. Attempt budget plus terminal `manual_review` stop a poison event from cycling forever.
- **Observability.** `getRecoveryQueueStats` gives per-status counts, `eligibleNow`, `oldestEligibleReceivedAt`, and (after the fix) `nextScheduledAttemptAt` — when the queue next wakes up. The admin webhooks page renders it.
- **Runbook reality.** With no job substrate, recovery is a human action. Until a scheduler exists, an operator should: read the queue stats; run a batch (default 10) when `eligibleNow > 0`; re-read; and treat `manual_review` as a ticket, not a retry target.

---

## 13. Known limitations and items requiring business decisions

1. **No scheduler.** Recovery batches are operator-triggered. Wiring a cron/queue worker is a Phase-4-sized decision; the brief's §10 non-goals forbid inventing one here.
2. **`server-only` is undeclared** while 156 files import it (§11.4a). The fix is a dependency declaration (or the repo-standard test stub); it belongs to whoever owns that import convention, not to Phase 3.
3. **No FX source, therefore no consolidated monetary total.** Mixed-currency shops see per-currency figures only. Business decision: adopt a signed, dated rate source if a single-currency headline is wanted.
4. **`net` ≠ recognized revenue.** There is no revenue-recognition policy, deferred-revenue model, or provider-fee ledger. Deciding to state profit/margin requires those first; `credit-valuation.ts` intentionally refuses to derive profit from the 3,750-credits/USD reference.
5. **Partial-refund credit policy.** Proportional reversal needs both amounts and matching currencies; otherwise the full grant is reversed. Whether "reverse the full grant when the ratio is unknowable" is the commercially correct default is a business decision (the current behaviour is conservative for the platform and is explicitly labelled in metadata).
6. **Refunds of *consumed* credits.** A reversal can only claw back credits the user still holds; a user who spent them cannot go negative under current `reverseCredits` semantics. Business decision: allow negative balances / dunning, or accept the loss and record it as a distinct, reconcilable write-off type (today it surfaces as a reversal failure and stays discoverable).
7. **Unattributable payments** stay `unresolved` forever unless a human maps them (`payment_attribution_missing`, `needs_business_decision`). No customer identity is inferred.
8. **Historical rows predate `originalPaymentId`/`refundedAmountMinor`**, so older refunds are reported as `incomplete_record` rather than fully analyzed. Backfilling them would require provider-side truth (a Dodo export), which this repository does not have.
9. **Reconciliation is a sample, not an exhaustive audit** — window-bounded by design. A paged full scan is available but is an operator loop, not a job.
10. **Concurrency claims were verified against a deterministic fake**, not a live Atlas cluster (§11.6).
11. **`tsconfig.phase3-check.json` was temporary** and has been deleted; a permanent scoped-check task is a small infra decision left to the user.
12. **One §11 scenario lacks a dedicated test**: "credit reversal succeeds but refund confirmation is unavailable" is exercised only through the adjacent amount-absent case (reversal follows the confirmed grant, no monetary progress written). Adding a provider-retracts-confirmation fixture is a small, well-scoped follow-up; nothing in the accounting depends on guessing in that state.
13. **Deliberately not committed.** All Phase 3 work sits in the working tree, mixed with the user's own WIP. Committing requires a decision about what belongs in which commit; the brief forbids committing without authorization.

---

## 14. Evidence that no historical attribution or monetary amounts were fabricated

- **No writes to any real store.** No test file references `MongoClient`, `createConnection`, or a `MONGODB_*` environment variable (verified by grep across `webhook-recovery.test.ts`, `reconciliation.test.ts`, `revenue-accounting.test.ts`, `operation-identity.test.ts`, `refine-intent.test.ts`, `cofounder/tools/seo.test.ts`), and the recovery and reconciliation suites contain **zero** `fetch` call sites. Provider SDK calls are mocked; no Dodo credential is read during tests.
- **No real money movement.** No checkout, refund, or grant was executed against any provider. Payment fixtures are synthetic ids and amounts; `MAX_ATTEMPTS`, backoff and paging are exercised against in-memory rows.
- **Missing ≠ zero, enforced in code.** `recordPayment` never writes `0` for an absent amount; unknown amounts are counted in `unknownAmountRows`; refunds without an authoritative amount advance status only, never `refundedAmountMinor`.
- **Attribution is server-derived or explicitly absent.** `projectId` on ledger rows continues to come from trusted route context; account-level payment rows stay account-level. No historical row was re-tagged with a project, user, currency, or amount — and none could have been silently, because Phase 3 contains no backfill or rewrite path (reconciliation is read-only; recovery only *creates* the effects the live handler would have created, idempotently).
- **No invented project ids.** Every test project id (`proj_1`, `prj_1`) is a fixture local to that test; production data was not read, sampled, or edited.
- **Full-suite evidence.** 1584/1584 assertions pass, including the suites that guard historical-record compatibility (top-up retention, legacy gateway, checkout-return, consume-plan, project-economics).

---

## 15. Acceptance checklist (§13 of the brief)

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Dodo webhook failures and unresolved events are durably discoverable | **Met** | Persisted events with status/`attempts`/`nextAttemptAt`/`reviewReason`; `webhook_events_recovery_claim` index; `getRecoveryQueueStats`; reconciliation `webhook_unresolved` / `webhook_failed_recovery` / `webhook_manual_review` |
| Eligible events can be recovered safely and repeatedly | **Met** | Atomic `findOneAndUpdate` claim, conjunction eligibility, lease reclaim, attempt budget; exactly-once concurrency test; three-batch idempotence test |
| Payment and subscription credit grants are idempotent | **Met** | `payment_${id}`, `sub_grant_${id}_period_${day}` under the unique index; crash-after-write and period-replay tests |
| Refund processing is traceable and retry-safe | **Met** | Dedicated refund rows (`refundId`, `originalPaymentId`, negative amount) + `refund_${refundId}` reversal; duplicate-refund and reversal-failure tests |
| Confirmed refunds are represented correctly in financial reporting | **Met** | gross / refunds / net with exactly-once netting; `succeeded → partially_refunded → refunded`; admin overview reads the shared module |
| Mixed currencies cannot create misleading monetary totals | **Met** | Currency-keyed figures everywhere; `$toUpper($ifNull(currency,"UNKNOWN"))` grouping; cross-currency sums have no code path |
| Project economics remain separate from account-level payment reporting | **Met** | Payments stay account-level; consumption carries `projectId`; economics suites re-run green (84 tests) |
| Reconciliation identifies supported discrepancies without inventing missing facts | **Met** | 17 evaluated types + `incomplete_record`/`needs_business_decision` for the underivable; false-positive policy tests; read-only guarantee |
| Sensitive data remains protected | **Met** | Payloads never surfaced in findings or batch results; secret-free reasons; admin-gated routes; structured logging without credentials |
| Existing project work and historical records are preserved | **Met** | No reset/stash/commit; all schema changes optional/additive; user WIP edits untouched (§2, §4) |
| Relevant tests pass and unrelated failures are documented with evidence | **Met** | 23 files / 293 tests exit 0; full suite 1584/1584 assertions, exit 1 from one pre-existing load error, documented in §11.4a |
| Completion report demonstrates the actual implementation | **Met** | This document cites modules, line-level changes, commands, exit codes, and test names |

**Recommendation: Phase 3 is ready for acceptance**, with §13 items 1–6 flagged as the business decisions that gate anything monetary beyond cash-kept accounting.

---

## 16. Recommended next phase (not implemented)

**Phase 4 — Financial Operations: scheduling, coverage, and repair workflow.**

1. **A real job substrate.** Introduce the repository's first scheduled-execution mechanism (cron route + guarded worker, or a hosted queue) so `runRecoveryBatch` and a paged reconciliation sweep run without a human in the loop, with idempotent, bounded, observable runs and an alert path into `manual_review`.
2. **Operator repair workflow.** Turn findings into tracked tickets (assign, note, resolve, audit trail) with a guided action per resolution path — recovery batch, admin adjustment, or business decision — so `manual_review` and `needs_business_decision` become closed loops rather than states.
3. **Provider truth import.** Ingest a Dodo settlement/refund export so historical unattributable payments and pre-Phase-3 refunds can be resolved with authoritative evidence instead of staying `incomplete_record`.
4. **Uncommitted-attribution and partial-reversal policy decisions** (§13.5–13.7), implemented only once decided.
5. **Reporting depth**: monthly statement generation, per-currency exports, and a fee/cost ledger that would finally make a *margin* figure defensible.
6. **Fix the `server-only` dependency declaration** (or codify the test-mock convention with a lint rule) as infrastructure hygiene, independent of finance.

Suggested sequencing: (1) scheduling first — it is the precondition for everything else to actually run; then (2) repair workflow, then (3–5) as data/decisions allow.

---

*Prepared from the working tree on `main`. This workstream committed nothing; every Phase 3 file listed in §4 is still uncommitted (the user's own `aeed79d` landed during verification and contains none of them — §2). Temporary `tsconfig.phase3-check.json`, used for the scoped type-check, was deleted after the final run.*
