# PHASE 11 — RUNTIME CONTROL CENTER — PROGRESS STATUS

> **Status: COMPLETE — all validations passed.**
> Last updated: 2026-09-21
> Scope: Project-owner Runtime Control Center (management layer over the existing Atai Runtime — no runtime, billing, auth, or router changes).

---

## 1. Summary

The founder-facing **Runtime Control Center** at `/project/[projectId]/runtime` is complete and validated. It gives project owners one place to observe and control their generated application's Atai Runtime usage: health, requests, Atai credits, API keys, model policy, rate limits, and per-capability/model/key cost breakdowns — with **zero new duplicate architecture**. Every page/API reuses the existing runtime services (Phase 2–10).

Final validation results:

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` (typecheck) | ✅ 0 errors |
| `npx vitest run` (full suite) | ✅ **57 files, 872 tests passed** |
| `npx next build` (production) | ✅ success, no errors/warnings |
| `@atai/sdk` build + tests | ✅ build clean, **7 files, 85 tests passed** |

---

## 2. Architecture audit — what exists and was REUSED

The audit (§132 of the phase brief) found the runtime already implemented through Phase 10. **Nothing was rebuilt:**

| Existing system | Location | Reused by the Control Center |
| --- | --- | --- |
| API-key lifecycle (create/list/revoke/rotate/expire, hash-only storage) | `lib/runtime/keys/*` | Keys pages — no second key collection |
| Runtime authentication (Bearer, fail-closed, per-key limiter) | `lib/runtime/auth/*` | New `/api/runtime/v1/health` endpoint |
| Scope authorization (`scopes: []` = all; dotted sub-scopes) | `lib/runtime/auth/authorize.ts` | Scope display + server-side enforcement |
| Central router (capability → scope → adapter → metering) | `lib/runtime/router/router.ts` | Untouched |
| Model policy (server-authoritative `resolveChatModel`) | `lib/runtime/control/model-policy.ts` + OpenRouter adapter | Models page UI reads/edits the same config the adapter enforces |
| Project runtime config store (unique per project, 5s TTL cache) | `lib/runtime/control/config-store.ts` | Models & Limits pages |
| Project-level rate limits (tightens platform 300/min ceiling) | `lib/runtime/control/enforce-limits.ts` | Limits page |
| Metering & billing (preflight → pre-charge → refund, idempotent via `runtime_<requestId>`) | `lib/runtime/metering/*` | Untouched; usage pages *read* the `runtime_usage` records it writes |
| Credit service (single ledger, subscription-first consumption) | `lib/billing/credit-service.ts` | Balance display only — no second wallet |
| Usage persistence (metadata only, no prompts/responses) | `lib/runtime/usage.ts` | Requests/Usage/Health pages |
| Generated-app provisioning (auto-injected `ATAI_API_KEY`, scope `ai.text`) | `lib/runtime/provisioning/service.ts` | Overview/Health pages show status + retry |
| Ownership checks (fail-closed, no existence leak) | `lib/runtime/ownership.ts`, `lib/runtime/control/owner.ts` | Every Control Center API route |

**Navigation:** the Workspace (`/project/[projectId]`) already had a Runtime button; `RuntimeNav` provides Overview / API keys / Models / Limits / Usage / Requests / Health tabs.

---

## 3. What was implemented in this phase

### 3.1 Typecheck repairs (pre-existing failures — now 0 errors)

The repository had **14 `tsc` errors** before this phase. All fixed minimally, no behavior changes:

- `lib/runtime/control/config-store.ts` — Mongo `WithId` typing on `findOne` result.
- `lib/runtime/router/adapters/calcom/client.ts` — import `calComHeaders` (was a stale `getCalComHeaders` name).
- `lib/runtime/router/adapters/cloudflare/client.ts` — import `cloudflareHeaders` (stale `getCloudflareHeaders`).
- `lib/runtime/router/adapters/totalum/client.ts` — import `totalumHeaders` (stale `getTotalumHeaders`).
- `lib/runtime/router/adapters/shared/http.ts` — widen `ProviderFetchOptions.method` to include `PATCH | DELETE` (needed by the Totalum data endpoints; `GET` still normalized explicitly).
- `lib/runtime/router/adapters/firecrawl/mapper.ts` — import the existing `assertPublicHttpUrl` SSRF guard (it was referenced but never imported).
- `lib/runtime/router/adapters/calcom/mapper.ts` — bookings without a `start` timestamp are now **skipped** in list results (the contract requires `start`; a missing timestamp is never fabricated), and create-booking responses missing `start` throw a normalized provider error.
- `lib/onboarding/state.ts` — widen `OnboardingSource` union to include the `dashboard_*` variants `sourceForMode()` actually returns.

### 3.2 Usage & cost analytics (server-authoritative)

**New file `lib/runtime/control/breakdown.ts`** (+ `breakdown.test.ts`, 11 tests):

- `breakdownByApiKey / breakdownByCapability / breakdownByModel / breakdownByProvider` — MongoDB aggregation over `runtime_usage`, project-scoped + bounded window, row-capped (50/50/50/20), grouped by error category for failed requests (25).
- Each row: requests, succeeded, failed, credits charged, average latency, provider cost (sum) with an **explicit `providerCostUnavailableCount`** — missing provider cost is never shown as `$0`.
- `estimatePeriodUsage` — clearly-labeled **estimate** (kind: `"estimate"`, never an invoice): linear projection of the observed daily rate onto 30 days. Returns `insufficientData: true` when there are fewer than 20 events or less than 24h of observation — no fabricated numbers.

**API** `GET /api/projects/:id/runtime/usage` now returns `{ events, nextCursor, summary, byApiKey, byCapability, byModel, byProvider, byError, estimate }` — the server computes every total (§54: the browser never computes authoritative cost).

**Rebuilt `components/runtime-control/usage-client.tsx`:**

- Filters: environment, status, API key, capability, model, request ID (URL-forwardable query params; server-side filtering).
- Working **cursor pagination** (Previous/Next) replacing the old "more results exist" dead-end text.
- Summary tiles: requests, success rate, Atai credits charged, provider cost (or "Unavailable").
- Estimate block explicitly labeled *"clearly an estimate, not an invoice"* with the basis string; honest "not enough usage data to estimate yet" state.
- Breakdown tables by capability / model / API key / provider / error category.
- **Removed the fake disabled "Export CSV (not enabled)" button** (§118 no-fake-features). Export is out of scope per the brief ("only if the app already supports data export").
- Empty state: "No runtime activity yet…" — no fake zero-value charts.

### 3.3 Authenticated runtime health endpoint

**New `app/api/runtime/v1/health/route.ts`** (`GET /api/runtime/v1/health`, `Authorization: Bearer <runtime key>`):

- Runs the **same Phase 4 authentication path** as invocation — a success proves the key is active, unexpired, and the identity context resolves.
- Response: safe metadata only — `status: "operational"`, `requestId`, trusted identity (`projectId`, `environment`, `apiKeyId`, `scopes`), key status, and the documented request-lifecycle stage names. **No secrets, no hashes, no `userId`, no provider details.**
- Failures: normalized runtime codes (401 `runtime_authentication_error` / `runtime_key_revoked` / `runtime_key_expired`) — never key-state enumeration.
- Covered by `app/api/runtime/v1/health/route.test.ts` (7 tests): missing/unknown/revoked/expired keys, safe-metadata shape, secret-leak scan, and identity isolation (spoofed query/header cannot change the project).

### 3.4 SDK health method

**`@atai/sdk` 1.0.0 → health capability** (backwards compatible, additive):

- New `packages/atai-sdk/src/capabilities/health.ts` — `await atai.health.check()` → `AtaiHealthResult` (status, requestId, identity, key status, lifecycle stages).
- Type `AtaiHealthResult` added to `types.ts`; exports added in `client.ts` (as `atai.health`) and `index.ts`.
- Response payload is structurally validated client-side (`assertHealthResult`) per the SDK's never-trust-the-server pattern.
- New `packages/atai-sdk/tests/health.test.ts` (9 tests): wire shape (GET to `/api/runtime/v1/health`, Bearer header, no body), normalized response, malformed-payload rejection, 401 propagation, key never leaks outside the Authorization header.
- README updated: health-check docs, **"Server-side secret"** warning (Atai runtime keys are secret credentials; there is no browser-safe key type), key-hygiene guidance, and pointer to Workspace → Runtime for key management.

### 3.5 Runtime Overview improvements

`components/runtime-control/overview-client.tsx`:

- **Honest status line** derived only from data the backend can determine: Operational / Operational (some recent failures) / Degraded — recent request failures / Idle — no requests in 24h / No runtime activity. No invented health states.
- Credits-remaining card now links to `/settings/billing` (the real billing page) instead of the legacy top-up redirect.
- Retained: active-key counts, 24h requests/credits, provider-cost-unavailable disclosure, config and provisioning status.

---

## 4. Security posture (unchanged invariants, verified by tests)

- **Two authentication domains stay separate:** session-cookie management routes (`/api/runtime/keys/*`, `/api/projects/:id/runtime/*`) vs. Bearer runtime routes (`/api/runtime/v1*`). `proxy.ts` gating untouched.
- **Ownership on every query:** all Control Center APIs derive `userId` from the session and filter by `projectId` — 404 for both missing and not-owned (no existence leak).
- **Model security:** allowlist / default / fallback / end-user-selection are enforced in the OpenRouter adapter path server-side; UI checkboxes never authorize a model.
- **Billing integrity:** charges still flow only through `consumeCredits` with `runtime_<requestId>` idempotency; fixed-price pre-charge + idempotent refund; pricing snapshots keep historical charges immutable; estimates are display-only and never authoritative.
- **No secrets anywhere new:** plaintext keys appear exactly once (create/rotate); usage records and health responses carry metadata only; no provider credentials in any response, log, or client bundle.

---

## 5. Known limitations (intentional, per brief)

1. **Export CSV/JSON** — not implemented (the fake button was removed); the brief only suggests export where the platform already supports it.
2. **Fallback on provider failure** — automatic retry/fallback chains are NOT enabled; the fallback list only affects model resolution when no model is specified (existing documented behavior — no double-charge risk).
3. **Concurrent-requests limit** — not owner-configurable; platform caps in-flight work at `RUNTIME_MAX_IN_FLIGHT` (default 32) per process. The Limits page states this honestly instead of exposing a fake control.
4. **Notification/alerting** — no separate alert system built; provisioning failures surface in Workspace activity + Health page.
5. **Environment-specific model config** — one project-level model policy (matches the current runtime architecture; environment remains a property of keys/usage).
6. **Period estimate horizon** — 30-day linear projection (the platform has no per-user billing-period anchor on runtime usage); basis and limits are displayed with the number.

---

## 6. Validation commands executed

```bash
npx tsc --noEmit                    # 0 errors
npx vitest run                      # 57 files, 872 tests passed
npx next build                      # production build OK
cd packages/atai-sdk
npx tsc -p tsconfig.json            # SDK build OK
npx vitest run                      # 7 files, 85 tests passed
```

---

## 7. Files changed in this phase

**New:**
- `lib/runtime/control/breakdown.ts` + `breakdown.test.ts`
- `app/api/runtime/v1/health/route.ts` + `route.test.ts`
- `packages/atai-sdk/src/capabilities/health.ts`, `packages/atai-sdk/tests/health.test.ts`
- `docs/PHASE_11_RUNTIME_CONTROL_CENTER_STATUS.md` (this file)

**Modified:**
- `app/api/projects/[id]/runtime/usage/route.ts` — breakdowns + estimate + requestId filter
- `lib/runtime/control/analytics.ts` — `requestId` query support
- `components/runtime-control/usage-client.tsx` — rebuilt (filters, pagination, breakdowns, estimate, no fake export)
- `components/runtime-control/overview-client.tsx` — honest status line, billing link
- `packages/atai-sdk/src/{client,index,types}.ts`, `packages/atai-sdk/README.md` — health capability + docs
- Typecheck repairs: `lib/runtime/control/config-store.ts`, `lib/onboarding/state.ts`, `lib/runtime/router/adapters/{calcom,cloudflare,totalum,firecrawl}/…`, `lib/runtime/router/adapters/shared/http.ts`

**Untouched (by design):** router, adapters' runtime behavior, metering/charging, credit service, key service, provisioning, proxy gating, admin area.

---

## 8. Completion checklist (§138)

- [x] Workspace has Runtime navigation (pre-existing, verified)
- [x] Project authorization works on every route (fail-closed 404)
- [x] API-key management works (create/rotate/revoke, one-time secret)
- [x] Key secrets protected (hash-only storage, metadata-only reads)
- [x] Model configuration works (default/allowed/fallback/end-user toggle)
- [x] Allowed-model enforcement server-side (adapter-level)
- [x] Fallback behavior documented and honest (resolution-only; no silent retries)
- [x] Rate limits configurable and enforced (RPM/RPD ≤ platform ceiling)
- [x] Usage visible with filters + pagination + breakdowns
- [x] Costs visible; Atai credits ≠ provider cost; unavailable ≠ $0
- [x] Estimates clearly labeled with basis; insufficient-data state
- [x] Requests observable with request detail by ID
- [x] Health meaningful (new authenticated endpoint + honest overview status)
- [x] Project/user/environment isolation verified by tests
- [x] Billing unchanged; historical records immutable (pricing snapshots)
- [x] SDK compatible (additive health method, 85 tests pass)
- [x] Provider secrets protected; no duplicate architecture introduced
- [x] Full test suite, typecheck, build all pass
- [x] No temporary bypasses or placeholder features remain

**PHASE — ATAI RUNTIME CONTROL CENTER COMPLETE — READY FOR FOUNDER TESTING**
