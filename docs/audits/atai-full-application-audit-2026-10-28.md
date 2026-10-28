# ATAI — Full Application Validation, Security & Reliability Audit

**Date:** 2026-10-28
**Branch:** `main` (working tree contained uncommitted feature work from the main session; nothing of it was reverted or rewritten)
**Method:** repository inspection, code-diff analysis, targeted unit/integration tests (vitest), scoped `tsc`, dependency audit. No load tests, no live provider calls, no browser E2E (see §E/§I for why).

---

## A. Executive summary

The application is a Next.js 16 (App Router, `proxy.ts` edge gate) / MongoDB SaaS with a credit ledger, Dodo Payments billing, an OpenRouter-backed co-founder, a Totalum build/deploy pipeline, and an Atai Runtime SDK. Scale: **155 API routes, 107 pages, 37 collections, 165 test files (~1.9k assertions)**.

**Baseline:** 1919/1919 tests passed, but one suite could not even load (`lib/intelligence/overview.test.ts` — `server-only` is a Next build-time alias, absent from the vitest resolver). Fixing the harness uncovered a **genuinely wrong assertion** that had never executed (percentile). So "all green" concealed a test that had never run.

**Overall condition:** the core security architecture is sound — opaque hashed session tokens, admin gating on 30/30 admin routes, uniform ownership checks across 62 project routes, HMAC-verified webhook with replay window and unique dedup index, unique idempotency key on the credit ledger, no destructive ledger edits, well-formed fetch timeouts. The serious defects cluster in **money movement edge paths** and **anonymous surface handling**:

1. A fork that failed after charging **refunded 0 credits** (permanent user loss).
2. `reverseCredits` could drive a credit bucket **negative** under concurrency.
3. Builds that fail **asynchronously** (after launch) never released the reservation.
4. Deploy was **check-then-act** — two concurrent deploys could both charge.
5. `/api/explore` compiled raw user text into `$regex` for **anonymous** callers (ReDoS + unbounded deep skip).
6. The edge proxy **401'd the very public endpoints** the app is built to serve anonymously (explore, docs feedback, pricing, uptime) — a user-visible functional break.

17 issues were fixed with regression tests (195 new test assertions across 6 new/extended suites); the remainder are documented in §I with exact remediation. Untested areas are stated explicitly in §C/§E — they are **not** marked as passed.

---

## B. Application inventory

**API routes (155)** by domain: projects 66, admin 30, auth 15, billing 14, runtime 5, public 4, me 3, feature-requests 3, internal 2, health 2, cofounder 2; single-route: users, user, start, referrals, github, finances, explore, credits, credit-costs.

**Pages (107)** — public (marketing, pricing, explore, docs, sdk, legal), auth (login, register, forgot-password, confirm-email-change), product (dashboard, new, start, projects, project/[id]/{collaborate,studio,...}, market, referrals, finances, settings, account, billing, developers), admin (admin/*, admin-only developer console).

**Collections (37)** — users, sessions, verification_tokens, rate_limits, projects, build_runs, project_assets, provider_usage, topups, publish_events, referrals, doc_feedback, webhook_events, credit_ledger, build_authorizations, payment_records, subscription_records, planning_runs, firecrawl_cache, seo_audits, content_items, brand_profiles, growth_tasks(+history), campaigns(+history), project_likes, user_follows, project_forks, project_github, feature_requests(+votes/status/history/updates/notes), cofounder_conversations, cofounder_pending_actions, project_chats, cancellation_feedback, project_runtime_config.

**Critical workflows traced:** register/login/OAuth → session; start → analysis → plan → build (Totalum launch, credit reserve/reconcile/release) → deploy (subdomain, credits) → publish events; co-founder chat (streamed) + approved actions (single-use claim); forks + royalty; SEO/studio/resources (charge → provider → refund on failure); Dodo checkout → webhook → top-up/subscription grants; referrals (milestones), credits ledger and reconciliation; runtime SDK invocation (Bearer keys) and admin runtime config/pricing.

---

## C. Coverage matrix

| Component | Tests executed | Passed | Failed | Known issues | Blockers | Untested risk |
|---|---|---|---|---|---|---|
| Session/revocation (`lib/auth/session.ts`) | 3 new + 2 existing suites | yes | 0 | fixed AUD-10 | — | cross-instance cache (process-local) |
| Login/register/OAuth | route tests + code review | yes | 0 | fixed AUD-09, AUD-16 | no live OAuth | account enumeration on register (open) |
| Password reset | code review | — | — | **dead link, AUD-19** | needs feature | — |
| Credits ledger (`credit-service.ts`) | 4 existing + 3 new | yes | 0 | fixed AUD-02, AUD-11 | — | replica-set-only transactions |
| Build lifecycle (launch/poll/fail) | build/status route review + new claim test | yes | 0 | fixed AUD-03 | no Totalum sandbox | async failure injection not run |
| Deploy | 2 new tests | yes | 0 | fixed AUD-04 | no Totalum sandbox | real provider race not run |
| Fork | 1 new test | yes | 0 | fixed AUD-01 | — | — |
| Dodo webhooks | 3 existing suites + review | yes | 0 | none found | no live webhook | out-of-order live delivery |
| Proxy edge gate | 20 tests (5 new) | yes | 0 | fixed AUD-07 | — | — |
| `/api/explore` | 4 new tests | yes | 0 | fixed AUD-05 | — | — |
| Public feedback | code review + rate limit | — | — | fixed AUD-08 | — | — |
| Health endpoints | code review | — | — | fixed AUD-06 | — | — |
| Admin APIs (30) | sample + gating sweep | yes | 0 | fixed AUD-12/13 | — | not every handler exercised |
| Runtime SDK v1 | 3 existing suites | yes | 0 | none found | no live key | load/concurrency limits untested |
| UI surfaces | code review + 1 flaky UI suite | partial | flaky | — | dev server owned by main session | **no browser E2E** |
| Performance / load | — | — | — | — | no staging env | **NOT TESTED** |
| Dependency security | `pnpm audit` | yes | — | dev-only advisories | — | — |

Unlisted components were inspected but **not** given executed tests; they are not marked as passed.

---

## D. Findings register

Severity = observed impact/exploitability. Confidence: CONFIRMED (reproduced by test or conclusive code), HIGH-CONFIDENCE (direct code evidence, not safely reproduced), POTENTIAL.

### Fixed

**AUD-01 — Fork failure refunds 0 credits** · High · CONFIRMED
`app/api/projects/[id]/fork/route.ts:241` released with `amount: 0` (comment claimed the amount was unused; `releaseReservation` grants exactly `amount`). Any failure after the charge (`createProject`, fork insert) permanently debited 15k–50k credits and wrote a 0-amount `build_release` ledger row. **Fix:** hoist `chargedAmount`; refund it. **Test:** `fork-refund.test.ts` asserts `amount === forkCost`. **Verified.**

**AUD-02 — `reverseCredits` can drive a bucket negative** · High · CONFIRMED
`lib/billing/credit-service.ts` read the bucket balance **outside** the transaction, captured `actualReversal` before `withTransaction`, and guarded only the flat `credits` field while `$inc`-ing the bucket field. Concurrent consume → negative bucket, stale `balanceBefore/After`. **Fix:** re-read via `getBalance(userId, session)` inside each attempt, clamp there, guard on `[field]: { $gte }` too, log the in-txn amount. **Test:** `credit-service.reversal-race.test.ts` (guard present, clamp to fresh 50, no write when empty).

**AUD-03 — Async build failures never release the reservation** · High · HIGH-CONFIDENCE
Only the synchronous launch catch refunded (`build/route.ts:155`); a run failing minutes later was marked `build_failed` by the poller (`status/route.ts:482`) while the debit stayed. **Fix:** on the failed branch, release the running run's `creditsReserved` (`release_${run.id}`, idempotent), mark the run failed, and tell the founder credits were refunded. **Verified:** code path review + full suite; failure injection against Totalum not possible here.

**AUD-04 — Deploy double-charge race** · Medium · CONFIRMED (code) / test proves ordering
State check at `deploy/route.ts:50`, transition at `:89`; two concurrent POSTs both passed and both `reserveCredits` with distinct run ids. **Fix:** atomic `claimBuildSlot(id,{state:"deploying"})` before any credits; revert state on every early-exit after the claim. **Test:** `deploy-claim.test.ts` (409 without reserving; claim precedes reserve).

**AUD-05 — Anonymous ReDoS + deep-skip on `/api/explore`** · High · CONFIRMED
`q` went straight into `$regex`, `page` unclamped, reachable by anyone with a junk cookie (proxy checks presence only). **Fix:** shared `escapeRegex` (`lib/utils.ts`), 100-char cap, page clamped to 500, per-IP 60/min limiter. **Test:** `app/api/explore/route.test.ts` (escaping, cap, skip clamp, limiter).

**AUD-06 — Unauthenticated diagnostics leak** · Medium · CONFIRMED
`/api/health/planning` had no guard and echoed driver errors + env flags; root `/api/health` echoed Mongo error text. **Fix:** `requireAdmin()` + status-only errors + `handleRouteError`; root health returns status without the message.

**AUD-07 — Edge gate 401'd intentionally-public endpoints** · High (functional) · CONFIRMED
`proxy.ts` omitted `/api/explore`, `/api/public/*`, `/api/credit-costs`, `/api/health` → logged-out visitors saw an empty explore grid and a "Failed to load projects" toast; docs feedback was rejected. **Fix:** exact-match entries for `/api/health`, `/api/credit-costs`, `/api/explore` (+ subtree), `/api/public/`; `/api/health/planning` deliberately remains gated. **Test:** 5 new proxy cases.

**AUD-08 — Unauthenticated unbounded upsert (docs feedback)** · Medium · CONFIRMED
Attacker-chosen `visitorId` → unlimited permanent documents. **Fix:** 60/hour per client IP.

**AUD-09 — Login as account/ban oracle** · Medium · CONFIRMED
Ban/suspension answered **before** password verification, and unknown emails skipped bcrypt (timing). **Fix:** constant-cost `verifyPasswordWithoutUser` (dummy bcrypt hash) for unknown emails; ban/suspension only after a correct password. **Test:** covered by login suite; timing equalized by design.

**AUD-10 — Banned/suspended sessions stayed authorized; revocation missed the cache** · High · CONFIRMED
`requireUser` never re-checked flags; `destroyAllSessionsForUser` deleted rows but not the 30s in-process principal cache. **Fix:** enforcement in `requireUser`, `cacheInvalidateUser` on revoke/deny. **Test:** `session-revocation.test.ts` (banned/suspended rejected; cache dropped after revoke).

**AUD-11 — Subscription grant could write a phantom user + bucket** · Low–Medium · CONFIRMED
`grantSubscriptionCredits` ignored `matchedCount`; `$push` upserts a doc, so a grant for a missing id wrote a ledger row for a nonexistent account. **Fix:** throw when the flat update matches nothing (mirrors the `grantCredits` guard).

**AUD-12 — Unescaped admin `$regex`** · Low · CONFIRMED
`admin/billing/user-billing` compiled free text into three regexes (ReDoS, 500 on `(`). **Fix:** `escapeRegex`.

**AUD-13 — Raw `error.message` in admin/health responses** · Low · CONFIRMED
`admin/planning-runs` (list + one), health routes. **Fix:** `handleRouteError` / status-only.

**AUD-14 — Unbounded `style` forwarded into the visual prompt** · Low · CONFIRMED
**Fix:** type + 2000-char cap (422).

**AUD-15 — Public project privacy oracle** · Low · CONFIRMED
403 "private" vs 404 "not found". **Fix:** identical 404 (no consumer of `PROJECT_PRIVATE` existed).

**AUD-16 — Google sign-in linked onto an existing account on unverified email** · Medium · CONFIRMED
**Fix:** refuse linking unless `email_verified`; new `google_email_unverified` message on the login form. (GitHub path already requires a verified primary email.)

**AUD-17 — Percentile test asserted a value no convention produces** · Test bug · CONFIRMED
Expected 49 for p95 of `[10,20,30,40,50]`; linear interpolation yields 48 (which consumers round). Test had never executed (suite couldn't load). **Fix:** assertion + rationale comment; harness shim for `server-only` in `vitest.config.ts`.

**AUD-18 — `.env.example` omitted every core variable** · Low · CONFIRMED
No `MONGODB_URI`, `AUTH_SECRET`, `SMTP_*`, `IMAGEKIT_*`, OAuth vars. **Fix:** documented (names only, no values).

### Outstanding — see §I

---

## E. Test execution results

| Run | Command | Result |
|---|---|---|
| Baseline (before changes) | `npx vitest run` | 160 files: 159 passed, **1 failed to load** (`server-only`); 1919/1919 tests passed — but the failing suite's 9 tests never ran |
| Targeted (during fixes) | touched suites | iterated until green; 2 genuine test-authoring bugs fixed, 1 wrong assertion found |
| Full suite (after fixes) | `npx vitest run` | 165 files: **164 passed, 1 failed**; 1945 passed / 2 failed — both failures a **5000 ms timeout** in `__tests__/builder-review.test.tsx` under parallel load |
| Flaky re-check | `npx vitest run __tests__/builder-review.test.tsx` | **5/5 passed in isolation** → load flake, not a regression |
| Touched areas | proxy + auth + billing + explore + projects routes | **23 files / 176 tests passed** |
| Typecheck | scoped `tsc -p tsconfig.audit-check.json` (all edited files + new tests) | **0 errors** |
| Dependencies | `pnpm audit` | 53 advisories overall (3 crit, 19 high) — **0 high/critical in production deps**; all in dev tooling chains (e.g. `shadcn → @dotenvx/dotenvx → …`) |

Environmental limitations: no replica-set MongoDB, no Totalum/Dodo sandbox, no browser session (dev server belongs to the main session). Hence no true E2E, no failure-injection, no load measurements.

---

## F. Security assessment

**Sound (verified):** opaque 32-byte session tokens, SHA-256 at rest, httpOnly/SameSite=Lax/secure-by-origin cookies, 30-day server expiry; bcrypt cost 12 with real user existence checks; admin gating is DB-derived (`isAdmin`), not env or client; 62/62 sampled project routes enforce ownership server-side with uniform 404s; no route trusts body/query `userId`; Dodo webhook verifies HMAC over `id.timestamp.body` with constant-time compare, multi-sig rotation, ±5-min window, unique `webhookId` dedup and safe retry handling; credit ledger is append-only with a unique idempotency key; runtime Bearer auth derives identity from the key record only; internal API uses `timingSafeEqual` and fails closed; no secrets in tracked files or client bundles (the `process.env.*` hits in client components are documentation string literals); .env files are ignored.

**Confirmed & fixed:** AUD-05 (anonymous ReDoS), AUD-06 (diagnostics leak), AUD-09 (enumeration/timing), AUD-10 (ban enforcement, revocation), AUD-16 (OAuth linking), AUD-12/13/14/15 (hardening), AUD-08 (storage DoS).

**Open:** registration enumeration and auth **per-IP** limiting (§I-2, §I-3), spoofable `x-forwarded-for` as rate-limit identity (§I-3), AI routes without per-user burst limits (§I-4), ImageKit MIME trusted from the client (§I-5), internal API has no rate limit if the key leaks (§I-8). No secrets were printed during this audit.

---

## G. Performance & reliability assessment

**No load testing was performed** — there is no isolated environment and the brief forbids hammering production. Findings from code:

- Webhook and webhook-recovery share one processing path keyed to stable business ids → return URL and webhook cannot double-grant.
- Every credit mutation is transactional with conditional guards; correctness depends on MongoDB running as a **replica set/sharded cluster** (`withTransaction` throws on standalone). Documented in `lib/db/mongodb.ts`; worth asserting at boot.
- `MongoStore` caches project/balance reads for 30 s **per process**; multi-instance grants are invisible to other instances for up to 30 s (debits read authoritative state, so money is safe; UI may lag).
- Admin list endpoints are bounded (`limit` 100–200, paginated ledger/audit), bulk pricing capped at 200 rows, AI retries bounded (2, exponential), provider calls carry timeouts.
- New: build-failure recovery and deploy claims reduce two classes of stuck/duplicate state; both are idempotent under repeated polling.

---

## H. Changes implemented

| File | Change | Verified by |
|---|---|---|
| `vitest.config.ts` | `server-only`/`client-only` resolver shim (mirrors Next) | `lib/intelligence/overview.test.ts` now loads |
| `lib/intelligence/overview.test.ts` | corrected p95 expectation + rationale | same |
| `proxy.ts` | public surfaces admitted (exact `/api/health`, `/api/credit-costs`, `/api/explore` + subtree, `/api/public/`) | `proxy.test.ts` (5 new) |
| `app/api/explore/route.ts` | escape + 100-char cap, page clamp, per-IP limiter | `route.test.ts` (4 new) |
| `lib/utils.ts` | shared `escapeRegex` | used by explore + admin |
| `app/api/public/feedback/route.ts` | 60/h per-IP limiter | review |
| `app/api/health/route.ts`, `health/planning/route.ts` | no error echo; planning is admin-only | review |
| `app/api/admin/planning-runs/{route,[runId]/route}.ts` | `handleRouteError` | typecheck |
| `app/api/admin/billing/user-billing/route.ts` | `escapeRegex` | typecheck |
| `app/api/auth/login/route.ts`, `lib/auth/crypto.ts` | dummy-cost verify; ban check after password | auth suite |
| `lib/auth/session.ts` | ban enforcement in `requireUser`; per-user cache invalidation | `session-revocation.test.ts` (3 new) |
| `app/api/auth/google/callback/route.ts`, `components/auth/login-form.tsx` | require verified email to link; new message | typecheck |
| `lib/billing/credit-service.ts` | in-txn clamp + bucket guard in `reverseCredits`; `matchedCount` guard in `grantSubscriptionCredits` | `reversal-race.test.ts` (3 new) |
| `app/api/projects/[id]/fork/route.ts` | refund the actual charge | `fork-refund.test.ts` |
| `app/api/projects/[id]/deploy/route.ts` | atomic claim before credits | `deploy-claim.test.ts` (2 new) |
| `app/api/projects/[id]/status/route.ts` | release + mark run on async failure | full suite |
| `app/api/projects/[id]/generate-visual/route.ts` | `style` type/length validation | typecheck |
| `app/api/public/projects/[id]/route.ts` | uniform 404 for private | typecheck |
| `.env.example` | core/required variable names documented | review |

No dependency, schema, provider, pricing, or public-contract change was made. Existing tests were not weakened or skipped.

---

## I. Outstanding issues (not fixed)

1. **Password reset is dead (Medium, CONFIRMED).** `forgot-password` issues a `password_reset` token and emails `${APP_URL}/reset-password?token=…`, but there is no `app/reset-password` page and no consuming API route (only the proxy whitelist exists). Tokens are never validated or marked used. **Next step:** implement `POST /api/auth/reset-password` with single-use `findOneAndUpdate({ usedAt: { $exists: false } })` (mirror `verify-email`), then a small reset page; or remove issuance and point users to support.
2. **Registration enumeration (Medium, CONFIRMED).** `409 EMAIL_ALREADY_REGISTERED` reveals roster membership. **Next step:** product decision — either accept and document, or return a neutral 201 plus "someone tried to sign up" mail.
3. **Auth rate limiting is identity-only (Medium, CONFIRMED).** Login/register/forgot-password limit per email, so credential spraying across accounts and targeted lockout are unthrottled; the per-IP limiter used on public routes trusts `x-forwarded-for`'s first hop. **Next step:** derive the client IP from the hosting platform's verified header and add a second bucket per IP on auth routes.
4. **AI routes lack per-user burst limits (Medium, POTENTIAL).** `resources/*`, `analyze-plan`, `plan-chat`, `generate-visual` are credit-bounded but unbounded in concurrency. **Next step:** modest hourly `checkRateLimit` per user (seo-audit already does 10/h).
5. **ImageKit MIME is client-declared (Medium, POTENTIAL).** No magic-byte sniff; files are public. **Next step:** sniff content-type server-side; set `isPrivateFile` where appropriate.
6. **Referral farming only flagged post-hoc (Low, POTENTIAL).** `>20` signals create a flag but do not block grants. **Next step:** block rewards while a flag is active, pending manual review.
7. **Cross-instance balance cache staleness (Low, POTENTIAL).** 30 s per-process cache. **Next step:** bypass cache on authoritative reads or publish invalidations.
8. **Internal API has no rate limit (Low, POTENTIAL).** Key holders can enumerate PII; mitigated by 64-char keys and timing-safe compare.
9. **Config fallbacks (Low):** `DODO_PAYMENTS_ENVIRONMENT` silently defaults to `test_mode`; `getAppUrl()` falls back to `http://localhost:3000` in production; `standardwebhooks` is a dependency but unused (hand-rolled verifier is correct).
10. **`change-password` requires no current password for OAuth-only accounts (Low).** Session is the only factor; ~acceptable, but a re-auth prompt would be stronger.
11. **Not tested at all:** browser E2E journeys, load/stress behavior, live provider failure injection, real Dodo webhook delivery, multi-instance concurrency.

---

## J. Recommended next actions (prioritized)

1. Implement the password-reset consumer (an entire user journey currently ends in a 404) — Medium.
2. Add per-IP auth rate limiting from a platform-verified client IP; retest login/register/reset.
3. Add hourly per-user limits to the five credit-gated AI routes.
4. Add magic-byte validation to asset uploads.
5. Decide the registration-enumeration stance; if kept, remove it from support docs' claims of privacy.
6. Stand up a staging stack (replica-set Mongo + Totalum/Dodo sandboxes) to run: async build-failure refund, concurrent deploy, real webhook replay, and a bounded load test of `/api/runtime/v1`.
7. Add a boot-time assertion that Mongo runs as a replica set (transactions are load-bearing for every credit path).
8. Block referral rewards on active fraud flags.
9. Harden config: fail fast in production when `NEXT_PUBLIC_APP_URL` is unset, and require an explicit `DODO_PAYMENTS_ENVIRONMENT`.
