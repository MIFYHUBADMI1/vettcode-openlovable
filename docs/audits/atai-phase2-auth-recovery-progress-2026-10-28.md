# ATAI Phase 2 — account recovery and authentication progress

Date: 2026-10-28. This is an incremental report for execution phases 0–2, **not completion of the entire remediation mission**. The original audit remains unchanged at `docs/audits/atai-full-application-audit-2026-10-28.md`.

## Baseline and ownership

- Started on `main` at `a69d07f` with 21 modified tracked files and an untracked original audit. Existing billing, credit-gate, project pipeline, OAuth, package and lockfile changes were preserved.
- Additional changes appeared during execution in uploads, referrals, AI protection, readiness, environment configuration, billing and marketing. Those are concurrent work, not authored or certified by this report.
- Inspected the actual MongoDB 7.6 driver, token schema and indexes, existing `withTransaction` credit operations, auth/session helpers, rate limiter, mail templates, response envelope, proxy allowlist and installed Next.js 16.3.3 route/page/`after` documentation.
- Targeted baseline: `node node_modules/vitest/vitest.mjs run lib/auth proxy.test.ts --maxWorkers=2 --reporter=dot` — **6 files / 44 tests passed**, 107.77 seconds.
- The initial `npx vitest run --reporter=dot` launch never produced test output and was stopped. It is not a passed full baseline.
- No `mongod`, Docker or MongoDB memory-server was available in the inspected local tooling. No real customer database was used for mutation tests.

## Findings status

| Original finding | Current scope/status | Changes and tests | Remaining verification or risk |
|---|---|---|---|
| §I-1 / AUD-19: dead password reset | Implemented, integration verification outstanding | New emailed-URL page and endpoint; same SHA-256 token storage and bcrypt cost 12; token claim, password write, session revocation and invalidation of other reset links share one MongoDB transaction. Tests cover invalid/expired/used tokens, malformed/weak input, real password verification, concurrent consumption, deleted accounts and rollback at each mutation/commit boundary. | Tests use an explicitly labeled in-memory transaction harness, not a replica set. Browser and SMTP end-to-end delivery remain unverified. |
| §I-2: registration enumeration | Still open by explicit compatibility decision | Existing 409 response, verification email, immediate session and 201 success payload are preserved and tested. | A neutral existing-account response alone would be misleading because new registrations return a user and authenticated session. A privacy redesign must change the registration UI/API onboarding contract together. |
| §I-3: identity-only auth limits; spoofed forwarding | Core password/email endpoints hardened | Existing Mongo limiter reused for shared ingress, verified-IP and existing account limits; 8 KiB streamed body limit. Nine endpoints covered by ingress controls. Untrusted forwarding cannot bypass production auth limits. Tests cover forged headers, proxy chains, normalized IPs, repeated/concurrent attempts, reset boundaries and storage errors. Explore and feedback use verified addresses or their existing shared anonymous bucket. | Confirm actual deployment routing and origin firewall before production. OAuth-specific quotas and real multi-instance load tests remain outstanding. |
| §I-4: expensive AI operations | Not verified in this increment | Concurrent work exists; do not treat its presence as proof. | Next implementation/review phase. |
| §I-5: uploaded file validation | Not verified in this increment | Concurrent work exists; do not overwrite it. | Format-aware tests and storage-policy review remain required. |
| §I-6: referral farming | Not verified in this increment | Concurrent work exists. | Review reward/fraud transaction ordering and flag resolution with financial integration tests. |
| §I-7: balance-cache staleness / transaction readiness | Not verified in this increment | Existing transaction architecture reused for reset. Concurrent credit/readiness changes exist. | Real replica-set readiness and cross-instance credit tests remain required. |
| §I-8: internal API rate limiting | Not verified in this increment | Concurrent work exists. | Review credential handling, limits and legitimate caller behavior. |
| §I-9: unsafe production config defaults | Not verified in this increment | Only proxy deployment requirements were added by this increment; other configuration changes are concurrent work. | Production configuration and Dodo-mode tests remain required. |
| §I-10: OAuth-only password change needs no current password | Unchanged | Retained existing product semantics; added ingress/input limits only. | Reauthentication product/security decision remains open. |
| §I-11: browser/provider/load/multi-instance coverage | Open | Attempted local browser preview; no provider mutation tests. | Isolated staging and working browser/dev server required. |

## Implementation details

### Password reset

- A read-only token check avoids spending bcrypt work on random invalid tokens. Expiration and unused state are checked again atomically inside the transaction after hashing.
- Every mutation receives the same `ClientSession`; a password, session-delete, sibling-token or commit failure aborts together. There is no best-effort claim rollback or successful response after failed session deletion.
- Reset issuance no longer deletes earlier links before attempting mail delivery. A successful reset invalidates outstanding password-reset links; email-verification tokens remain untouched.
- Forgot-password schedules **all account-dependent work**, including lookup and token persistence, with Next's `after`, not just the SMTP call. Its normal response is always `{sent:true}`. Delivery/persistence failures are logged generically; this response is an acknowledgement, not proof of delivery. `after` is not a durable queue.
- SMTP timeouts are bounded; error logging no longer includes raw provider error text that could echo message contents.
- Session authorization is read from Mongo on each request rather than a per-process 30-second cache. This closes cross-instance stale authorization, at the cost of additional database reads. Load verification is still required.
- Form supports missing/invalid/expired links, recoverable server failures, password confirmation, duplicate-submit protection, and success with manual sign-in. No account is auto-signed-in by reset. Metadata uses `no-referrer` and no indexing.

### Authentication limits and deployment

The existing Mongo `rate_limits` collection, unique key index and TTL are retained; no second limiter backend or credit ledger was created.

| Operation | Verified-IP limit | Existing identifier limit |
|---|---|---|
| Login | 60 / 15 minutes | 10 / email / 15 minutes |
| Register | 10 / hour | 5 / email / hour |
| Forgot password | 15 / hour | 3 / hashed email / hour |
| Reset submission | 20 / 15 minutes | Single-use token; no attacker-controlled token buckets |
| Verify email | 60 / 15 minutes | Single-use token |
| Confirm email change | 30 / 15 minutes | Single-use token |
| Change password | 20 / hour | 5 / user / hour |
| Change email | 10 / hour | 3 / user / hour |
| Resend verification | 15 / hour | 3 / user / hour |

A fixed shared auth-ingress limit of 1,000/minute precedes per-IP/account row creation to bound distributed identifier churn. Email-sending operations have lower quotas than password checking. These are conservative starting limits, **not load-calibrated production capacity claims**. Shared capacity exhaustion and users behind a large NAT can affect availability; monitor and calibrate with staging traffic.

- On Vercel, only platform-managed `VERCEL=1` enables `x-vercel-forwarded-for`; other forwarding headers are ignored for auth identity.
- Self-hosting requires explicit `TRUSTED_PROXY_HOPS=1..10` and an origin accessible only through that exact trusted chain. Proxies must append the observed peer; alternate shorter/direct paths invalidate the trust assumption.
- Missing or malformed trustworthy identity in production returns generic 503 **before creating limiter rows**. Development/test requests without verified identity use one bounded shared bucket, irrespective of spoofed headers.
- IP syntax is validated with Node's `isIP`; IPv6 spellings and IPv4-mapped IPv6 normalize consistently. Long chains are rejected or indexed from the right, never truncated to an attacker-controlled prefix.
- The in-process rejection cache now expires at **Mongo's original window boundary**. Rejected requests do not extend a lockout window. Lost upsert-conflict recovery fails closed instead of silently admitting an uncounted request. 429 responses include `Retry-After`.
- Verify-email and confirm-email-change now explicitly enforce expiry in their atomic claims; TTL cleanup alone does not enforce deadlines.

## Files authored or edited in this increment

- `lib/auth/password-reset.ts`: transactional reset service.
- `app/api/auth/reset-password/route.ts`: bounded validation, ingress protection and safe recovery response.
- `app/reset-password/page.tsx`, `components/auth/reset-password-form.tsx`: reset UI at the emailed path.
- `app/api/auth/forgot-password/route.ts`: neutral asynchronous issuance and layered limiting.
- `lib/auth/users.ts`: transaction-aware password writes with a live-account matched-count result.
- `lib/auth/session.ts`: transaction-aware revocation and authoritative session/account reads.
- `lib/api/client-ip.ts`: trusted identity extraction and fail-closed auth bucket selection.
- `lib/api/request-body.ts`: bounded auth JSON streaming and shape validation.
- `lib/auth/request-limit.ts`: shared ingress and per-operation IP limits using the existing limiter.
- `lib/auth/rate-limit.ts`, `lib/errors.ts`, `lib/api/respond.ts`: correct rejection expiry, fail-closed race recovery, retry headers.
- `app/api/auth/{login,register,change-password,change-email,resend-verification,verify-email,confirm-email-change}/route.ts`: ingress/input validation; explicit expiry for token confirmations.
- `app/api/explore/route.ts`, `app/api/public/feedback/route.ts`: remove trust in arbitrary forwarding headers, including feedback fallback identity.
- `lib/email/mailer.ts`: SMTP time limits and redacted failures.
- `.env.example`: documented trusted-proxy dependency only; other contents remain shared pre-existing/concurrent work.

Regression files: `lib/auth/{password-reset,request-limit,rate-limit-enforcement,routes-security}.test.ts`, `lib/api/client-ip.test.ts`, `app/api/auth/{forgot-password,reset-password}/route.test.ts`, `components/auth/reset-password-form.test.tsx`, `app/api/public/feedback/route.test.ts`. Extended `lib/auth/__tests__/session-revocation.test.ts`, existing limiter tests, and `app/api/explore/route.test.ts`. Test files are excluded by this repository's ignore rules; ensure they are deliberately included when preparing a future commit. No commit or deployment was performed here.

## Executed verification

| Command / activity | Observed outcome |
|---|---|
| Targeted baseline command above | 6 files / 44 passed |
| `node node_modules/vitest/vitest.mjs run lib/auth/password-reset.test.ts lib/api/client-ip.test.ts app/api/auth/reset-password/route.test.ts app/api/auth/forgot-password/route.test.ts lib/auth/__tests__/session-revocation.test.ts --maxWorkers=2 --reporter=dot` | 4 files passed, 1 failed; 56 tests passed, 11 reset tests timed out at 5 seconds. No assertion failures reported. |
| `node node_modules/vitest/vitest.mjs run lib/auth/password-reset.test.ts --maxWorkers=1 --testTimeout=30000 --reporter=verbose` | 16/16 passed, 79.98 seconds. Real hashing/verification and concurrency took up to 11.58 seconds per test on this host. New reset suite now uses a 30-second budget without changing assertions or bcrypt cost. |
| Final targeted suite, scoped TypeScript, full suite and lint | Results pending; not yet certified. |
| `git diff --check` | Passed at checkpoint; only line-ending warnings. |
| Local Next dev start on port 3002 | Refused because the main session already owns a server on port 3210. No existing server was stopped. |
| Browser navigation to `/reset-password` on port 3210 | Timed out at 60 seconds; HTTP probe also timed out. UI interaction and golden path are **not browser-verified**. |
| Production build | Not attempted in the shared dev output while the existing server is unresponsive; no build pass claimed. |

## Remaining blockers and risk assessment

1. Run reset and revocation against an isolated replica set, including real driver write-conflict retries, rollback, concurrent different tokens for one account, and commit-acknowledgement ambiguity. The in-memory harness is not evidence of Mongo isolation behavior.
2. Obtain a functioning local browser session and test the success, expired, invalid, missing, duplicate-submit and recoverable-failure UI paths. Run real SMTP only against a sandbox mailbox.
3. Verify the deployment's actual trusted proxy configuration before enabling these auth routes in production. Fail-closed behavior intentionally prevents unsafe fallback to client-supplied headers.
4. Removing process-local session caching increases database load. Benchmark the existing pool under representative staging traffic; do not restore a stale authorization cache to mask capacity problems.
5. Requests already authorized before revocation can still complete. A password login that verified the old password before reset and creates its session afterward is a separate in-flight race that requires a credential-version/session-creation design and integration tests; this increment does not claim to cancel such work.
6. Email verification and email-change confirmation still consume tokens before subsequent non-transactional account/reward work. Only password reset is made fully transactional here. Their partial-failure recovery remains a follow-up.
7. Registration still exposes account existence, and the reset acknowledgement cannot guarantee delivery without a durable outbox. These limitations are explicit rather than hidden behind privacy/reliability claims.
8. Prior audit findings AUD-01..AUD-18 have **not all been re-certified** here. Login dummy verification, session revocation, proxy baseline and public limiter changes have direct targeted coverage; the financial/async/OAuth/admin findings still need the requested deeper review, especially because concurrent work is changing those files.

## Next concrete work

Finish and record the outstanding verification jobs, then review the current concurrent Phase 3 AI-protection changes before modifying any resource/plan/chat/visual route. Verify quotas precede reservations and rejected requests never debit credits. Continue phases 4–8 against the current tree, preserving concurrent changes, then complete the full findings register and staging test matrix. The mission is not marked complete.
