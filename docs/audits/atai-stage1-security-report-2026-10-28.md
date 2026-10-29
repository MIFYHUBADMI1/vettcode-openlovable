# ATAI Stage 1 — security and account-recovery report

Date: 2026-10-28. Response to "ATAI — STAGE 1: CLOSE SECURITY AND ACCOUNT-RECOVERY GAPS". Companion evidence for the earlier audit register (`docs/audits/atai-full-application-audit-2026-10-28.md`) and the incremental reports (`atai-phase2-auth-recovery-progress-2026-10-28.md`, `atai-phase2-remediation-verification-2026-10-28.md`).

No commit, push, deployment, payment, real email, or production-data mutation was performed.

## A. Executive summary

Implemented and verified across the ten objectives:

1. **Password recovery** — complete request → email → reset page → transactional single-use token claim → password change → session revocation. No dead links remain (AUD-19 closed in the earlier increment).
2. **Authentication limits** — verified-IP ingress limits plus per-account limits on every password/email endpoint; arbitrary forwarding headers are no longer trusted; automated tests cover spoofing, normalization, concurrency and storage failure.
3. **AI cost/abuse controls** — burst + hourly per-user quotas on 14 AI routes, an atomic 2-slot per-user lease with 10-minute TTL, 256 KB streamed body cap, and metered manual retries (gap closed in this increment).
4. **Upload validation** — server-side magic-byte decode/re-encode with sharp (format whitelist, pixel/frame/buffer caps), declared-MIME consistency, provider metadata verification, ownership checks.
5. **Referral enforcement** — fraud flags evaluated inside the reward transaction; hard flags never payable without explicit approval; rewards idempotent and deferred, not paid-then-reported.
6. **Credit consistency and readiness** — authoritative balance reads for every authorization path; ledger clamps reversals inside the transaction; `hello` topology check fails fast at connect and at health readiness.
7. **Internal APIs** — constant-time shared-secret auth (fail-closed when unset), 120/min per-key limit, safe errors; runtime API keys derive project identity server-side.
8. **Production configuration** — `getAppUrl` requires an explicit https canonical URL in production (no localhost/path/query), OAuth redirects are canonically pinned, Dodo environment is explicit and its base URL is enforced.
9. **Prior findings rechecked** — AUD-01..AUD-19 re-verified; 14 targeted suites / 124 tests pass.
10. **Verification** — full suite green, project-wide typecheck exit 0, no lint tooling exists in the repo, build/browser/providers not executable here.

**Is the application safer than baseline?** Yes, materially: the confirmed money-integrity, account-takeover, enumeration, cost-abuse and configuration findings now have enforced server-side controls and regression coverage.

**Ready for the next testing stage?** Yes, with documented limitations: transaction isolation, browser journeys, provider sandboxes, load and multi-instance behavior remain unverified on this host (section F).

## B. Findings matrix

| Finding | Original risk | Initial status | Action taken | Final status | Evidence |
|---|---|---|---|---|---|
| AUD-01 fork failure refunds 0 | High — permanent user credit loss | Confirmed | Refund charged amount in catch path | FIXED AND TESTED | `app/api/projects/[id]/fork/route.ts:237-255`; `fork-refund.test.ts` |
| AUD-02 reversal drives bucket negative | High — ledger corruption | Confirmed | Re-read bucket in transaction, clamp per retry | FIXED, INFRASTRUCTURE VERIFICATION PENDING (no replica set) | `lib/billing/credit-service.ts:1086-1088`; `credit-service.reversal-race.test.ts` |
| AUD-03 async build failure never releases | High — users lose reserved credits | High-confidence | Release wired into failure/recovery paths | FIXED, INFRASTRUCTURE VERIFICATION PENDING (no provider sandbox) | `build-recovery.test.ts`; release helpers in `lib/billing/credit-service.ts` |
| AUD-04 deploy double charge | Medium — duplicate debit | Confirmed code | Atomic build-slot claim before any reservation | FIXED, INFRASTRUCTURE VERIFICATION PENDING (real concurrent deploy not run) | `app/api/projects/[id]/deploy/route.ts:65-70`; `deploy-claim.test.ts` |
| AUD-05 explore ReDoS / deep skip | High — anonymous CPU abuse | Confirmed | Escape literals, bound depth/pagination | FIXED AND TESTED | `app/api/explore/route.test.ts` |
| AUD-06 diagnostics leak | Medium — config/provider disclosure | Confirmed | Status-only health output; text logged, not returned | FIXED — CODE REVIEW (no dedicated suite) | `app/api/health/route.ts:19-22` |
| AUD-07 edge gate blocked public routes | High functional | Confirmed | Public allowlist in proxy | FIXED AND TESTED | `proxy.test.ts` |
| AUD-08 unbounded anonymous feedback upsert | Medium — storage DoS | Confirmed | Per-identity Mongo limiter (60/window) | FIXED AND TESTED | `app/api/public/feedback/route.ts:36-40`; `route.test.ts` |
| AUD-09 login account/ban oracle | Medium — enumeration | Confirmed | Uniform failures + dummy bcrypt verification | FIXED AND TESTED | `lib/auth/routes-security.test.ts` (dummy verification cases) |
| AUD-10 banned sessions stayed authorized | High — ban bypass | Confirmed | Authoritative per-request session read | FIXED AND TESTED | `lib/auth/session.ts`; `session-revocation.test.ts` |
| AUD-11 phantom grant user/bucket | Low–Medium — ledger integrity | Confirmed | Grant requires existing account in transaction | FIXED, INFRASTRUCTURE VERIFICATION PENDING (no replica set) | `credit-service.grant.test.ts` |
| AUD-12 unescaped admin regex | Low — ReDoS/query abuse | Confirmed | Escape before query | FIXED AND TESTED | `app/api/admin/planning-runs/route.test.ts` |
| AUD-13 raw error messages exposed | Low — info disclosure | Confirmed | Generic client errors; detailed logs | FIXED — CODE REVIEW (no dedicated suite) | Admin route error handling |
| AUD-14 unbounded visual `style` | Low — prompt/cost abuse | Confirmed | Type + 2 000-char bound | FIXED — CODE REVIEW (no dedicated suite) | `generate-visual/route.ts:107` |
| AUD-15 private-project existence oracle | Low — privacy | Confirmed | Identical 404 for foreign/missing | FIXED — CODE REVIEW (no dedicated suite) | `app/api/projects/[id]/route.ts:58,99,258,262` |
| AUD-16 OAuth link on unverified email | Medium — account takeover | Confirmed | Require provider-verified email | FIXED — CODE REVIEW (no dedicated suite) | `app/api/auth/google/callback/route.ts:53-57` |
| AUD-17 impossible percentile expectation | Test bug — false confidence | Confirmed | Correct p95 convention (48) | FIXED AND TESTED | `lib/intelligence/overview.test.ts` |
| AUD-18 `.env.example` missing core vars | Low — deploy misconfig | Confirmed | Documented Mongo/auth/URL/AI/Dodo vars | FIXED — FILE REVIEW | `.env.example` |
| AUD-19 password reset dead end | Medium — broken recovery | Confirmed | Full transactional reset journey | FIXED, INFRASTRUCTURE VERIFICATION PENDING (SMTP/browser/replica set) | Section C; `lib/auth/password-reset.ts`; reset suites |

"CODE REVIEW" marks findings verified by reading the current implementation where no dedicated suite exists; the full suite still passes. This qualifier is used because none of the prescribed statuses distinguishes code-verified from test-verified.

Outstanding-issue register:

| §I | Status | Notes |
|---|---|---|
| 1 dead reset | FIXED | See section C |
| 2 registration enumeration | NOT FIXED | Deliberate compatibility decision; changing it requires onboarding-contract changes |
| 3 identity-only auth limits | FIXED | Verified IP + account layers; deployment proxy config still to confirm |
| 4 AI burst limits | FIXED | Section D; stalled-takeover retries remain unmetered by design (bounded) |
| 5 upload MIME trust | FIXED | Content-based validation; public-file policy unchanged |
| 6 referral farming | FIXED | Flags block/defer rewards |
| 7 stale balance cache | FIXED | Authoritative reads; display-only caching |
| 8 internal API limits | FIXED | 120/min per key; unbounded projects list remains |
| 9 unsafe config defaults | FIXED | URL/payment environment fail closed |
| 10 OAuth-only password change | NOT FIXED | Session remains the only factor (product decision) |
| 11 untested surfaces | PARTIALLY FIXED | Browser/load/providers/multi-instance still untested |

## C. Password-recovery verification

| Step | Implementation |
|---|---|
| Request | `POST /api/auth/forgot-password` — ingress IP limit, hashed-email limit (3/h), neutral `{sent:true}`; all account-dependent work (lookup, token write, mail) deferred to `after()` so response timing/content does not vary |
| Token generation | 32 random bytes → 43-char base64url (`lib/auth/crypto.ts`); only SHA-256 hash stored |
| Storage | `verification_tokens` with `purpose:"password_reset"`, `expiresAt = now + 1h`; earlier unused reset links marked used on issuance |
| Delivery | Existing `sendMail` + `passwordResetEmail`; failures logged generically, never surfaced |
| Page | `app/reset-password/page.tsx` + client form; token read from query only (never localStorage), `no-referrer`, noindex, manual sign-in after success |
| Submission | `POST /api/auth/reset-password` — bounded body, ingress + per-account limit, existing password policy, bcrypt cost 12 |
| Claim | `findOneAndUpdate({ tokenHash, usedAt:{$exists:false}, expiresAt:{$gt:now} }, {$set:{usedAt}})` inside a transaction; exactly one concurrent submission can win |
| Account binding | Account comes from the token row; client cannot supply a user id. Deleted/banned/suspended/no-passwordHash accounts are rejected inside the transaction |
| Session revocation | `destroyAllSessionsForUser(userId, session)` in the same transaction (server-side delete — not cookie-only) |
| Sibling tokens | All other unused reset tokens for the account invalidated in the same transaction |
| OAuth-only | Accounts without a local password never receive a link and cannot use the reset endpoint; forgot-password response stays neutral |
| Transaction options | snapshot read concern, majority write concern, 10 s commit cap |

Acceptance "request → sign in with new password" is verified through unit/integration tests against the in-memory harness only; real SMTP and browser flow are pending (section F).

## D. Security implementation details

**Authentication rate limiting.** Existing Mongo `rate_limits` collection (unique key + TTL) is the only limiter store. `lib/auth/rate-limit.ts` uses atomic `findOneAndUpdate` with fixed windows; upsert-race `E11000` is folded; the negative cache expires at the Mongo window boundary; 429s carry `Retry-After`. `lib/auth/request-limit.ts` adds shared ingress (1 000/min) and per-operation IP limits; `lib/api/client-ip.ts` derives identity from `x-vercel-forwarded-for` only under platform-managed `VERCEL=1`, or from an explicitly configured `TRUSTED_PROXY_HOPS` chain; malformed/missing identity in production fails closed with 503 before limiter rows are created.

| Operation | IP limit | Account limit |
|---|---|---|
| Login | 60 / 15 min | 10 / email / 15 min |
| Register | 10 / h | 5 / email / h |
| Forgot password | 15 / h | 3 / hashed email / h |
| Reset submission | 20 / 15 min | 10 / user / 15 min |
| Verify email / confirm change | 60, 30 / 15 min | single-use token |
| Change password / email | 20/h, 10/h | 5/user/h, 3/user/h |
| Resend verification | 15 / h | 3 / user / h |

**AI burst and concurrency controls.** `lib/api/ai-protection.ts` order: `requireUser` → `checkAiQuota(kind, userId)` (`lib/api/ai-quota.ts`: burst + hourly windows) → 256 KB streamed body cap → `acquireAiLease(userId, kind)` → handler with `AsyncLocalStorage` context and 9-minute deadline. Leases allow 2 concurrent slots per user, carry a 10-minute TTL for crash recovery, and are released on success, failure, cancellation, timeout and deferred streaming completion; release is idempotent. Alternate identities cannot be chosen: the key is the authenticated user id.

| Route | Quota kind | Credits | Lease | Body cap |
|---|---|---|---|---|
| `resources/{marketing-playbook,market-research,competitors,action-plan}` | resources | yes | yes | yes |
| `analyze-plan`, `seo-audit` | analysis | yes | yes | yes |
| `plan-chat` | chat | yes | yes | yes |
| `cofounder` | chat | no direct chat charge (tools it invokes bill on their own paths) | yes | yes |
| `auto-complete` | autocomplete | yes | yes | yes |
| `generate-visual` | visual | yes | yes | yes |
| `content-studio`, `studio/refine`, `studio/variations`, `market/studio` | studio | yes | yes | yes |
| `projects/[id]/retry` (AI-restart states) | analysis | preflight only | n/a (background start) | n/a |
| `runtime/v1` | per-key platform/project limits | usage metering | yes | yes |

`AI_LIMITS`: chat 15/min, 120/h; analysis 4/min, 30/h; autocomplete 20/min, 120/h; resources 6/min, 30/h; visual 3/min, 30/h; studio 6/min, 60/h.

**File-content validation.** `lib/imagekit/validate-image.ts` decodes with sharp (`failOn:"warning"`, 25 MP, ≤100 frames, 10 s), accepts only png/jpeg/webp/gif, requires the declared MIME to match the detected format, re-encodes to strip metadata/trailing payloads, and enforces 5 MB before and after cleanup. Multipart reads are bounded (`readImageFile`). Upload responses are verified (`lib/imagekit/upload.ts:67`): https URL, provider origin, `filePath` under the requested folder. Project assets check ownership before upload and association (`app/api/projects/[id]/assets/route.ts:18`), use a 20/min limiter and an `image_upload` lease. Uploads use the provider default (public); no `isPrivateFile` flag is sent and no privacy policy change was made.

**Referral fraud enforcement.** `lib/referrals/referrals.ts`: flags (self-referral, attribution mismatch, circular, high count + existing signals) are computed inside the reward transaction; any hard or unapproved flag defers the reward (`referral.reward_deferred`) and no grant occurs. Issuance is a conditional update (`[issued]: false`, status not blocked) plus a ledger grant with key `referral_<kind>_<referralId>` — replay-safe. Milestones require the configured usage threshold. Existing earned credits are never confiscated.

**Credit consistency and readiness.** `getAvailableCredits` is used for every authorization decision; MongoStore caching serves display lists only. `reverseCredits` re-reads and clamps inside the transaction. `assertTransactionSupport` (`lib/db/transaction-readiness.ts`) runs at connect (`lib/db/mongodb.ts:76`) and in health (`app/api/health/route.ts:18`): it accepts replica-set (`setName`) or sharded (`isdbgrid`) topologies with valid wire version and session timeout, and returns 503 without exposing credentials.

**Internal API and configuration.** `/api/internal/*` uses timing-safe shared-secret auth (`lib/api/internal-key.ts`, 503 when unset), a 120/min limit keyed by secret hash, bounded email input and safe envelopes. Runtime `/api/runtime/v1` derives `userId/projectId/environment/scopes` only from the hashed API key lookup (`lib/runtime/auth/authenticate.ts:174-199`) and applies the per-key platform cap plus project rpm/rpd. `getAppUrl`, `getOAuthRedirectUri`, `getPaymentEnvironment` and the Dodo adapter (`lib/runtime/router/adapters/dodo/config.ts`) fail closed instead of defaulting in production.

## E. Test results

Host: Windows 10.0.26100, Node v24.18.0, vitest 5.0.1. Commands run from the repo root.

| Check | Command | Result |
|---|---|---|
| Full suite (first run) | `node node_modules/vitest/vitest.mjs run --reporter=dot` | 193 files / 2302 tests passed, exit 0, 138 s |
| Full suite (final re-run on the current tree) | same command | 193 files passed, exit 0; 954 s under heavy concurrent load. Test total not captured in this run; composition unchanged (193 files both runs), and the earlier run counted 2 302. Concurrent edits by another session were landing during this run, so it is a snapshot, not a frozen-tree certificate. |
| AUD-targeted matrix | 14 suites (fork-refund, deploy-claim, reversal-race, grant, feedback, build-recovery, explore, proxy, session-revocation, session, routes-security, admin planning-runs, overview, env-security) | 14 files / 124 tests passed, 79 s |
| AI/lease/internal/runtime batch | 11 suites under `lib/api/*`, `lib/runtime/{auth,concurrency,control}` | 108 tests passed, 74 s |
| Repaired harness suites | forgot-password, admin referrals, runtime v1, provisioning e2e, retry | 5 files / 77 tests passed, 10 s |
| Typecheck (project tsconfig) | `node node_modules/typescript/bin/tsc --noEmit` | **exit 0** (≈29 min wall on this host; ran against the current tree, including concurrent edits) |
| Scoped typecheck (authored files) | `tsc -p` temp config covering `ai-quota.ts`, `ai-protection.ts`, retry route | exit 0 (supplementary; not a substitute for the project-wide run) |
| Lint | — | No lint script or ESLint config exists in the repository; `eslint`/`typescript-eslint` are declared devDependencies without configuration, so no project lint command exists to run |
| Build | `next build` | Not run: tree-wide builds are known to stall on this host and the shared `.next` output belongs to the main session's dev server |
| Integration (real DB/concurrency) | — | Not run: no replica-set MongoDB available; transaction tests use an explicitly labeled in-memory harness |
| Browser E2E | — | Not run: no reachable dev server (`curl` to :3210 returned 000) |

Skipped/excluded tests: test files are matched by the Vitest config; no suites were skipped. `pnpm audit` was previously reported with dev-only advisories; not re-run in this increment.

## F. Remaining limitations

| Requirement | Risk | Exact next verification |
|---|---|---|
| Replica-set MongoDB | Transaction isolation, write-conflict retries, commit-ambiguity and concurrent ledger/reset behavior are unproven | Boot a single-node replica set; run reset concurrency, reversal race, deploy claim and grant phantom tests against it |
| Multiple instances | Session reads are per-request, but cross-instance limiter/lease behavior is untested | Two-app-instance harness sharing one Mongo; assert 429/lease rejection across instances |
| Trusted production proxy | Misconfiguration fails closed (availability) or, if configured wrongly, classifies traffic incorrectly | Confirm platform header behavior and `TRUSTED_PROXY_HOPS` on staging; replay spoofed-header tests through the real edge |
| ImageKit sandbox | Real upload/deletion and public/private policy unverified | Upload valid/spoofed/oversized files to a sandbox; confirm re-encode and metadata checks |
| Email-provider sandbox | Delivery, bounce and timeout behavior unverified; `after()` is not a durable outbox | Send to a sandbox mailbox; inject SMTP failure and confirm the neutral response/log |
| External AI providers | Quota/lease behavior under real provider latency, timeouts and disconnects unverified | Staging run with provider faults; confirm slot release and refund policy |
| Browser automation | Reset, retry and studio UI journeys unverified | Working dev server + Playwright/manual run of golden paths |
| Production-like env | `getAppUrl`/Dodo fail-closed behavior unverified against the real deployment variables | Staging deploy with production-like env matrix |

## G. Changed files

Authored or edited in this remediation (uncommitted):

- `lib/api/ai-quota.ts` — new centralized quota table and `checkAiQuota`.
- `lib/api/ai-protection.ts` — delegate quotas; re-export compatibility.
- `app/api/projects/[id]/retry/route.ts` — meter AI-restart retries.

Authored in the earlier increment (reported in `atai-phase2-auth-recovery-progress-2026-10-28.md`): `lib/auth/password-reset.ts`, `app/api/auth/reset-password/route.ts`, `app/reset-password/page.tsx`, `components/auth/reset-password-form.tsx`, `app/api/auth/forgot-password/route.ts`, `lib/auth/users.ts`, `lib/auth/session.ts`, `lib/api/client-ip.ts`, `lib/api/request-body.ts`, `lib/auth/request-limit.ts`, `lib/auth/rate-limit.ts`, `lib/errors.ts`, `lib/api/respond.ts`, the eight auth routes, `app/api/explore/route.ts`, `app/api/public/feedback/route.ts`, `lib/email/mailer.ts`, `.env.example`.

Verified but not authored by this remediation (existing concurrent implementations): upload validation, referral enforcement, credit/readiness, internal API and production config modules listed in section D.

Test files (gitignored, local only): the five repaired suites from section E. New dependencies or configuration variables: none.

## H. Regression and scope review

- Existing user work preserved: the only authored source diff is the three files above; the substantial unrelated edits that landed concurrently during this session (analysis/planning, plan and collaborate pages, auto-complete/deploy/status/explore/feedback/project routes, auth providers, billing, marketing) were left untouched.
- No destructive git commands; no commit, push or deploy.
- No real payments, provider transactions or emails were triggered; no customer data was read or modified for testing.
- No tests were disabled or assertions weakened; four pre-existing failing suites were repaired by correcting stale mocks, not by relaxing expectations.
- Final diff reviewed: quota ordering (credits preflight → quota → retry), single quota namespace, unchanged success envelopes, build/launch retry semantics preserved.

## I. Final recommendation

**READY WITH DOCUMENTED LIMITATIONS.** All scoped code changes are implemented and covered by a green full suite (2 302 tests on the instrumentation-stable run; 193/193 files, exit 0, on the final re-run) and targeted security suites; remaining gaps are environment-dependent verification (replica set, browser, SMTP/ImageKit/AI sandboxes, load, multi-instance) plus two product decisions (§I-2 registration enumeration, §I-10 OAuth-only password change). Closing those requires the staging stack described in section F — not further code changes identified in this review.
