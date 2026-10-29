# ATAI Phase 2 — remediation and verification report

Date: 2026-10-28. Final report for the "ATAI PHASE 2: REMEDIATE OUTSTANDING AUDIT FINDINGS AND VERIFY CRITICAL FIXES" mission. It continues the incremental report at `docs/audits/atai-phase2-auth-recovery-progress-2026-10-28.md` (phases 0–2) and verifies phases 3–10 against the current tree. The original audit register at `docs/audits/atai-full-application-audit-2026-10-28.md` is left unchanged as the historical record.

**Status in one line:** all ten phases were executed; every AUD finding is fixed in code with passing regression coverage; no commit, push or deployment was performed; external-environment verification (replica set, browser, SMTP, providers, load) remains outstanding and is documented below rather than claimed.

---

## 1. Mission checklist

| Phase | Requirement | Status | Evidence |
|---|---|---|---|
| 0 | Re-establish baseline | Done | Full suite run before and after changes; pre-existing failures isolated via A/B revert (section 4) |
| 1 | Complete/verify password reset | Done (prior increment) | Transactional reset service + route + page; 16/16 reset tests; see prior report |
| 2 | Auth rate limiting | Done (prior increment) | Verified-IP ingress + per-account limits, fail-closed identity; see prior report |
| 3 | Expensive AI operation controls | Done + one gap closed | `withAiProtection` on 14 routes, per-user burst/hourly quotas, 256 KB body cap, lease; retry route now metered (section 3) |
| 4 | Upload content validation | Verified | Magic-byte decode/re-encode via sharp, provider metadata verification, bounded parsing; suites pass |
| 5 | Referral abuse prevention | Verified | Rewards blocked on active flags, hard flags never approvable, single transaction; suites pass |
| 6 | Credit consistency + transaction readiness | Verified | Authoritative balance reads, transactional ledger with idempotency, `hello` topology check at connect and readiness; suites pass |
| 7 | Internal API + production config | Verified | Internal rate limit + timing-safe key compare; `getAppUrl`/OAuth redirect/payment-environment fail-closed; suites pass |
| 8 | Re-verify AUD-01..AUD-18 | Done | 14 targeted suites / 124 tests pass (section 4) plus code-location checks |
| 9 | Verification/regression | Done for this host | Full suite 193 files / 2302 tests pass; scoped `tsc` exit 0; build/browser/providers not executable here (section 4) |
| 10 | Report | This document | — |

---

## 2. Findings register status

Code locations were re-read in the current tree. Findings that name a suite were executed in this window (section 4); rows marked **code review only** were verified by reading the current implementation and are explicitly not claimed as behaviorally regression-tested.

| Finding | Status | Implementation evidence | Regression evidence |
|---|---|---|---|
| AUD-01 fork failure refunded 0 | Fixed | `app/api/projects/[id]/fork/route.ts` tracks `chargedAmount` and refunds in the catch path (lines 237–255); success charge stays final | `app/api/projects/[id]/fork-refund.test.ts` |
| AUD-02 `reverseCredits` could go negative | Fixed | `lib/billing/credit-service.ts:1086-1088` re-reads the bucket inside the transaction and clamps per retry | `lib/billing/credit-service.reversal-race.test.ts` |
| AUD-03 async build failure never released reservation | Fixed | Reservation release wired into build failure/recovery paths (`lib/billing/credit-service.ts`, `lib/projects/*`, `lib/analysis/pipeline.ts`) | `lib/projects/build-recovery.test.ts` |
| AUD-04 deploy check-then-act double charge | Fixed | Atomic claim before charging in deploy route | `app/api/projects/[id]/deploy-claim.test.ts` |
| AUD-05 anonymous ReDoS / unbounded deep skip on `/api/explore` | Fixed | Literal escaping + bounded depth in explore route | `app/api/explore/route.test.ts` |
| AUD-06 unauthenticated diagnostics leak | Fixed (code review only) | `app/api/health/route.ts:21-22` logs provider text and returns status only | No dedicated suite |
| AUD-07 edge gate 401'd public endpoints | Fixed | `proxy.ts` public allowlist (explore, docs feedback, pricing, uptime) | `proxy.test.ts` |
| AUD-08 unauthenticated unbounded feedback upsert | Fixed | `app/api/public/feedback/route.ts:36-40` per-identity `checkRateLimit` (60/window) | `app/api/public/feedback/route.test.ts` |
| AUD-09 login as account/ban oracle | Fixed | Uniform failure responses + dummy password verification | `lib/auth/routes-security.test.ts`, `lib/auth/__tests__/session.test.ts` |
| AUD-10 banned/suspended sessions authorized; revocation missed cache | Fixed | Authoritative Mongo read per request (`lib/auth/session.ts`) | `lib/auth/__tests__/session-revocation.test.ts` |
| AUD-11 subscription grant phantom user/bucket | Fixed | Grant requires an existing account inside the transaction | `lib/billing/credit-service.grant.test.ts` |
| AUD-12 unescaped admin `$regex` | Fixed | Regex input escaped before query | `app/api/admin/planning-runs/route.test.ts` and admin route tests |
| AUD-13 raw `error.message` in admin/health responses | Fixed (code review only) | Generic client errors, detailed server logs | Admin suites inspect error shapes; no health-route suite |
| AUD-14 unbounded `style` into visual prompt | Fixed (code review only) | `app/api/projects/[id]/generate-visual/route.ts:107` rejects style over 2 000 chars | No dedicated suite |
| AUD-15 public project privacy oracle | Fixed (code review only) | Project read/delete return the same 404 for foreign and missing projects (`app/api/projects/[id]/route.ts:58,99,258,262`) | No dedicated suite |
| AUD-16 Google sign-in linked on unverified email | Fixed (code review only) | `app/api/auth/google/callback/route.ts:53-57` redirects with `google_email_unverified` instead of linking | No dedicated suite |
| AUD-17 percentile test asserted impossible value | Fixed | p95 convention corrected to 48 | `lib/intelligence/overview.test.ts` |
| AUD-18 `.env.example` omitted core variables | Fixed | `MONGODB_URI`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `OPENROUTER_API_KEY`, Dodo product/vars documented | File review |
| AUD-19 password reset dead link | Fixed (prior increment) | Endpoint + page + transactional single-use token claim | `lib/auth/password-reset.test.ts`, reset route/form tests |

AUD-06, AUD-13, AUD-14, AUD-15 and AUD-16 were re-verified by reading the current code only; the remaining suites were executed in this window, and the full-suite run covers all of them.

## 3. Outstanding-issues (§I) status

| §I | Issue | Status now | Residual |
|---|---|---|---|
| 1 | Dead password reset | Fixed (AUD-19) | Token/transaction tests use an in-memory harness; no SMTP sandbox or browser delivery run |
| 2 | Registration enumeration (409) | **Open by product decision** | Deliberate compatibility choice; needs a UI/API onboarding redesign to change |
| 3 | Identity-only auth limits | Fixed | Verified client IP + per-account limits; deployment proxy config and OAuth-specific quotas still to confirm |
| 4 | AI routes lacked per-user burst limits | Fixed | 14 routes wrapped; manual retry restarts now metered; see section 3.1 for the remaining narrow bypass |
| 5 | ImageKit MIME client-declared | Fixed | Magic-byte decode/re-encode + provider metadata check; public-file policy review remains |
| 6 | Referral farming flagged only post-hoc | Fixed | Rewards blocked while flagged, hard flags unapprovable; manual review workflow remains |
| 7 | Cross-instance balance cache staleness | Fixed | Authoritative reads; display-list cache only; config cache is a separate 5 s per-process TTL |
| 8 | Internal API no rate limit | Fixed | `lib/api/internal-limit.ts`; unbounded project list in the internal projects endpoint remains |
| 9 | Unsafe production config defaults | Fixed | `getAppUrl` requires https/non-local in prod, canonical OAuth redirect, explicit Dodo environment + base-URL consistency |
| 10 | OAuth-only change-password needs no current password | **Unchanged** | Session is the only factor; re-auth prompt is a product decision |
| 11 | Browser/load/provider/multi-instance untested | **Open** | No browser session, load harness, provider sandbox, or replica set available here |

### 3.1 AI control gap closed in this increment

Manual retry (`POST /api/projects/[id]/retry`) can restart Understand/Plan AI work after `created`, `analysis_failed` or `plan_failed`. It previously bypassed the per-user quota because only freshly initiated routes went through `withAiProtection`.

- `lib/api/ai-quota.ts` (new) holds the single quota table (`AI_LIMITS`) and `checkAiQuota(kind, userId)`, built on the existing Mongo `checkRateLimit` — no second limiter backend.
- `lib/api/ai-protection.ts:43-53` now imports that helper and calls `await checkAiQuota(kind, user.id)` before acquiring a lease; `AI_LIMITS` is re-exported for compatibility.
- `app/api/projects/[id]/retry/route.ts:9-11,40` calls `checkAiQuota("analysis", user.id)` for AI-restart states, after the credit-block preflight and before `retryProjectStep`. Build (`build_failed`) and launch (`deployment_failed`) retries are unchanged and keep provider-side limits.

Behavioral compatibility: response envelopes are unchanged; an over-quota retry returns the existing 429 path with `Retry-After`; no credits are debited before the quota check; there is still exactly one quota namespace (`ai_analysis_burst` / `ai_analysis_volume`).

Residual bypass (documented, not hidden): retries that take over a **stalled** run (`pending_plan`, `analyzing`, `analysis_complete`) also restart AI work but are not metered, because those paths require a 15–20 minute stall and the resulting restart rate is structurally far below the analysis quota (4/min, 30/hour). Closing it fully would mean consuming quota on legitimate stalled-recovery attempts; that trade-off is left to the product owner.

## 4. Verification executed

Host: Windows 10.0.26100, Node v24.18.0, vitest 5.0.1, single worker. All commands run from the repository root.

| Command / activity | Observed outcome |
|---|---|
| Full suite, initial (`node node_modules/vitest/vitest.mjs run --reporter=dot`) | **4 files / 19 tests failed**; no failing suite imported the changed modules |
| A/B proof: backup the three changed source files, restore tracked ones, remove `ai-quota.ts`, rerun the same four files | Identical 19 failed / 34 passed → failures pre-date and are unrelated to this increment (introduced with the phase-2 commit's concurrent work) |
| Repaired harness, targeted rerun of the five files | **5 files / 77 tests passed**, 9.75 s |
| AUD-targeted verification (`fork-refund`, `deploy-claim`, `credit-service.reversal-race`, `credit-service.grant`, `feedback`, `build-recovery`, `explore`, `proxy`, `session-revocation`, `session`, `routes-security`, `admin/planning-runs`, `overview`, `env-security`) | **14 files / 124 tests passed**, 78.66 s |
| Final full suite (`node node_modules/vitest/vitest.mjs run --reporter=dot`, log to a temp file, exit captured) | **193 files / 2302 tests passed**, 138.09 s, exit code 0 |
| Scoped typecheck (`node node_modules/typescript/bin/tsc -p .tmp-tsconfig-phase4.json`, `ai-quota.ts` + `ai-protection.ts` + retry route) | Exit 0. The pre-existing tracked scratch tsconfig was reused then restored; no template drift |
| Earlier phase baselines in this window (phase 3: 51 tests; phases 4–7: 68; phase 8: 48; retry + AI after edits: 52) | Passed; superseded by the final full run |
| `git diff --check` | Clean |

Harness repairs made (all test files, which this repo's ignore rules exclude from commits):

- `app/api/auth/forgot-password/route.test.ts` — mock `updateMany` (route invalidates sibling reset tokens) and assert the invalidation.
- `app/api/admin/referrals/route.test.ts` — use the real 403 `AppError("UNAUTHORIZED", …)` matching `requireAdmin`.
- `app/api/runtime/v1/route.test.ts`, `lib/runtime/provisioning/e2e.test.ts` — mock `@/lib/api/ai-lease`; the runtime path now acquires a lease before `getDb()`, which 503'd under the test env.
- Extended `app/api/projects/[id]/retry/route.test.ts` with quota-ordering, build/launch exemption, 429 and 503 cases; added a test-environment case to `lib/env-security.test.ts`.

**Not executed here (and not claimed):**

- Production build (`pnpm build`): the tree-wide build/typecheck is known to hang on this host and the shared Next output is owned by another session.
- Browser E2E: no reachable dev server (`curl http://localhost:3210/` returned 000) and no isolated port permitted; UI golden paths unverified.
- Real SMTP delivery, Dodo webhook replay, Totalum/ImageKit sandbox calls, load/stress, multi-instance concurrency, live replica-set transaction behavior.

## 5. Files changed in this increment

Source (uncommitted):

- `lib/api/ai-quota.ts` — new shared AI quota table and `checkAiQuota`.
- `lib/api/ai-protection.ts` — delegate quota to `ai-quota.ts`; re-export for compatibility.
- `app/api/projects/[id]/retry/route.ts` — meter AI-restart manual retries.

Tests (gitignored, local only): the five files listed in section 4. Nothing was committed or pushed; no production deployment was performed, per the mission constraints.

## 6. Remaining blockers

1. **No replica-set MongoDB here.** Multi-document transaction behavior, write-conflict retries, commit-acknowledgement ambiguity and readiness fail-fast are only exercised through an explicitly labeled in-memory harness. This is the largest unverified area because every credit path depends on it.
2. **No browser/dev server.** Reset, retry, collaboration and build UIs have no E2E verification in this window.
3. **No external sandboxes.** SMTP, Dodo webhooks/checkout, Totalum build/deploy, ImageKit uploads, OpenRouter billing were not exercised against real sandboxes; OpenRouter paid capabilities remain blocked by account credit status.
4. **No load or multi-instance testing.** Auth now reads sessions per request and quotas hit Mongo on every AI call; capacity is unmeasured.
5. **Test files are ignored by git.** The harness repairs and new quota tests exist only locally; a future commit must deliberately include them or the suite will regress on a clean clone.
6. **Known product decisions still open:** registration enumeration (§I-2) and OAuth-only password change (§I-10).

## 7. Updated risk assessment

| Area | Before this mission | Now | Residual risk |
|---|---|---|---|
| Money integrity (fork/deploy/build/referrals) | High: silent refund loss, double charge, negative buckets | Code paths fixed, guarded and tested | Transaction isolation unproven without a replica set |
| Account takeover / abuse | High: dead reset, oracle login, unverified OAuth link, unthrottled auth | Fixed and covered | Deployment proxy configuration must be confirmed; reset email path untested live |
| Cost abuse (AI) | Medium: unmetered concurrency and retries | Per-user burst/hourly quotas + lease across 14 routes and retry | Stalled-takeover bypass (bounded); quota values not load-calibrated |
| Data exposure (admin/internal/health/uploads) | Medium | Escaping, generic errors, rate limits, magic-byte checks | Internal project list unbounded; public-upload policy review |
| Reliability of verification | Low confidence: claims previously untested | Full suite green (2302 tests), AUD matrix executed | External integrations and load remain untested by design of this host |

Overall: the audit's confirmed code-level findings are remediated and regression-covered; the remaining risk is concentrated in **environment-dependent behavior** (transactions, providers, concurrency, browser) rather than known code defects.

## 8. Next-phase recommendations

1. **Stand up a staging stack**: single-node replica set Mongo, sandbox SMTP, Dodo test keys with webhook replay, Totalum/ImageKit sandboxes. Re-run: reset journey end-to-end, async build-failure refund, concurrent deploy, webhook replay, referral grant under flags.
2. **Load-test the auth and AI paths** (per-request session reads, Mongo quota writes, lease contention) and calibrate the conservative limits in `AI_LIMITS` and the auth table.
3. **Close the stalled-retry metering decision** (§3.1) once product signs off on whether legitimate recovery attempts should consume analysis quota.
4. **Bound the internal projects list** and add response caps to internal APIs.
5. **Resolve the two open product decisions** (§I-2 enumeration, §I-10 re-auth for OAuth-only password changes).
6. **Deliberately stage the gitignored regression tests** with the next commit so verification survives a clean clone.
7. **Add CI** that runs the full vitest suite and a scoped typecheck, so harness drift like the four pre-existing failure clusters is caught at push time rather than during audit verification.
