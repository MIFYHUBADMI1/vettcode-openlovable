# Atai Runtime — Phase 2 Implementation Prompt

> Copy everything below the horizontal line into your AI coding agent, as-is.
> It is self-contained: context, guardrails, exact scope, and acceptance criteria.
> The Phase 1 architecture report lives at `docs/RUNTIME_API_ARCHITECTURE.md` —
> the agent must read it first.

---

## PROMPT — Start here

You are working inside the **Atai** codebase (Next.js 16 App Router, MongoDB via the
raw `mongodb` driver, pnpm, Vitest, TypeScript strict). Atai is an
application-generation platform: it plans applications through a multi-stage AI
pipeline and generates them via Totalum VCaaS.

A prior architecture phase produced `docs/RUNTIME_API_ARCHITECTURE.md`. **Read that
file completely before writing any code.** You are implementing **Phase 2 and part of
Phase 3–4** of the plan in that document: the **API key service + runtime database
layer + key management endpoints + runtime authentication middleware foundation**.

# 1. PRODUCT CONTEXT (why this exists)

Atai generates full applications for founders (e.g. a ChatGPT-style SaaS). Today those
generated apps would demand third-party API keys from their owners (`OPENAI_API_KEY`,
`FIRECRAWL_API_KEY`, Stripe, …). We are removing that burden with the **Atai Runtime
API**: generated applications receive ONE credential — `ATAI_API_KEY` — and call Atai's
Runtime API, which routes to providers (OpenRouter, Firecrawl, Dodo Payments, …) whose
credentials stay behind Atai forever.

Two planes that must stay separate:

- **Build plane (existing, DO NOT TOUCH):** idea → collaboration plan → pipelines →
  specification → Totalum → generated app.
- **Runtime plane (new):** generated app → Atai SDK (future) → Runtime API → Router →
  provider. The key you build in this phase is a **runtime credential for generated
  applications** — it is NOT used by Atai's own pipeline, and it is NOT a session or a
  second user system.

Ownership model: the key is bound to the founder's existing Atai **user** (ownership
root) and to one existing Atai **project** (the generated app's project). Usage will be
charged to that user's existing credit balance in later phases.

# 2. HARD CONSTRAINTS — read twice

- DO NOT modify the planning pipeline, Totalum integration, collaboration workspace,
  existing billing flows, Dodo webhooks, or any existing route.
- DO NOT create a second users/accounts collection. The existing `users` collection is
  the only identity source. Keys reference `users.id` (string, e.g. `user_xxx`).
- DO NOT store plaintext API keys anywhere — only SHA-256 hashes (`lib/auth/crypto.ts`
  already provides `generateToken`/`hashToken`; reuse that pattern).
- DO NOT return full key secrets in any GET response — prefix display only.
- DO NOT add new npm dependencies.
- Reuse existing infra: `lib/db/mongodb.ts`, `lib/db/collections.ts` (add your
  collections/indexes there following its conventions), `lib/errors.ts` +
  `lib/api/respond.ts` envelope, `lib/logging/logger.ts`, `lib/auth/session.ts`
  (`requireUser`), `lib/auth/rate-limit.ts`, `lib/auth/crypto.ts`.
- Match existing code style: `server-only` markers on server modules, typed `AppError`s,
  `ok()/fail()/handleRouteError()` in routes, JSDoc explaining *why*.

# 3. WHAT TO BUILD

## 3.1 Runtime collections (extend `lib/types/db.ts` + `lib/db/collections.ts`)

**`api_keys`** — one doc per credential:

```text
id                     "rkey_<cryptoId>"       (non-secret reference)
userId                 Atai user id            (REQUIRED — ownership root)
projectId              Atai project id         (REQUIRED — the generated app's project)
name                   optional display label
environment            "development" | "production"
keyHash                SHA-256 of full secret  (UNIQUE index)
keyPrefix              first ~10 chars, e.g. "atai_prod_ab12…" (dashboard display)
scopes                 string[] of capability scopes (see 3.2; empty array = all future
                       capabilities granted — document this explicitly in the type)
status                 "active" | "revoked" | "expired"
createdAt              epoch ms
lastUsedAt             optional epoch ms (throttled updates, see 3.4)
expiresAt              optional epoch ms
revokedAt / revokedReason
rotatedFromId / rotatedToId
```

Indexes (add in `ensureIndexes()`): `{ keyHash: 1 } unique`,
`{ userId: 1, createdAt: -1 }`, `{ projectId: 1, status: 1 }`.
Key format: `atai_<env>_<40+ urlsafe-random chars>`, generated via `crypto.randomBytes`
(32 bytes, base64url). Secret shown exactly once at creation.

**`runtime_usage`** — create the collection accessor + type now (records will be
written by later phases, but land the schema + a TTL'd index now):
requestId, userId, projectId, apiKeyId, environment, capability, provider, model,
status ("succeeded" | "failed"), latencyMs, usage?, creditsCharged, errorCategory?,
createdAt. TTL index on createdAt (90 days) — following the `planning_runs` precedent.

## 3.2 Capability scopes (lib/runtime/scopes.ts)

A const registry of valid scope strings with zod validation:
`ai.text`, `ai.vision`, `ai.image`, `ai.voice`, `search.web`, `payments`, `email`,
`sms`, `notifications`, `db`, `storage`, `maps`, `vectors`, `cdn`.
Only these are valid; anything else fails validation. (This is the scope vocabulary
only — no capability is implemented in this phase.)

## 3.3 Key service (lib/runtime/keys.ts, server-only)

Functions: `createApiKey` (generates secret, persists hash, returns plaintext ONCE),
`listApiKeys(userId)` (metadata only), `rotateApiKey` (create new with copied scopes +
`rotatedFromId`, mark old revoked with grace via `expiresAt` overlap, return new
plaintext once), `revokeApiKey` (immediate), `getApiKeyStatus`. Every mutation must
verify ownership (`userId`) in the same query/filter — never fetch-then-check.

## 3.4 Key validation + runtime auth (lib/runtime/auth.ts, server-only)

`authenticateApiKey(req)`:
1. Extract `Authorization: Bearer atai_...` (also accept `x-atai-key` header for SDK
   flexibility later). Missing → `authentication_error`.
2. Hash and look up by `keyHash` (unique index). Not found → generic
   `authentication_error` (never reveal whether the key exists).
3. Reject: `status !== "active"`, `expiresAt < now`, user missing/soft-deleted/
   suspended/banned (join `users` by `userId`), project missing. Each → precise
   normalized error code.
4. Return a `RuntimeContext { key, user, projectId, environment }` — identity comes
   ONLY from the key record, never from client-supplied body/headers/query.
5. Update `lastUsedAt` opportunistically: only if older than 60s (throttle — avoid a
   write per request). Never let this update fail the request.

In-process cache of key lookups (TTL 30–60s), invalidated by `revokeApiKey`/
`rotateApiKey` on the same process; document that cross-instance invalidation relies on
the short TTL (consistent with the existing MongoStore cache approach).

Normalized runtime error codes (lib/runtime/errors.ts, mapping into the existing
`fail()` envelope): `authentication_error` (401), `authorization_error` (403),
`insufficient_entitlement` (402), `invalid_request` (422), `rate_limit_error` (429),
`capability_unavailable` (501), `model_unavailable` (400), `provider_error` (502),
`timeout` (504), `service_unavailable` (503). Only `authentication_error`,
`authorization_error`, `invalid_request`, `rate_limit_error`, and
`capability_unavailable` can occur in this phase — the rest are for later phases but
the taxonomy lands now.

## 3.5 Key management endpoints (session-authenticated, dashboard-facing)

`app/api/projects/[id]/keys/route.ts`:
- GET — list the project's keys (metadata only; caller must own the project — mirror
  the ownership check in `app/api/projects/[id]/secrets/route.ts`).
- POST — create a key `{ name?, environment?, scopes? }`; returns full secret ONCE.
  Rate-limit creation via `checkRateLimit` (e.g. 10/day/user).

`app/api/projects/[id]/keys/[keyId]/route.ts`:
- DELETE — revoke (owner-only).

`app/api/projects/[id]/keys/[keyId]/rotate/route.ts`:
- POST — rotate; returns the new plaintext once.

All return the `{ ok, data } / { ok, error }` envelope via `ok()/fail()/handleRouteError()`.

## 3.6 proxy.ts exception (single existing-file change)

Runtime capability endpoints will be Bearer-key authenticated (no session cookie).
Add `"/api/runtime/"` to `PUBLIC_API_PREFIXES` in `proxy.ts` so the edge short-circuit
doesn't 401 Bearer-key traffic. Do NOT add any runtime capability routes in this phase —
this is the only gateway change.

# 4. TESTS (Vitest, mirroring existing `*.test.ts` style)

- Scope validation: valid/invalid/scope-normalization.
- Key service against a mocked collection layer (follow the mocking pattern used by
  existing tests — check `lib/analysis/*.test.ts` for the established approach):
  create → list shows prefix only, rotate lineage, revoke immediacy, ownership
  enforcement (a second user cannot revoke/list another's keys).
- `authenticateApiKey`: valid key, revoked, expired, missing header, unknown key
  (identical generic error), suspended user, deleted user; `lastUsedAt` throttling.
- Secret format: `atai_` prefix, env segment, length, uniqueness across 1,000
  generations, hash does not contain the secret.

# 5. VERIFICATION

Run `npx tsc --noEmit` and `npm test` — both must pass. Do not mark the phase complete
until both are green.

# 6. EXPLICITLY OUT OF SCOPE (do not build, do not stub)

- No capability endpoints (`/api/runtime/v1/ai/*` etc.) — later phase.
- No provider adapters, no OpenRouter/Firecrawl/Dodo runtime calls.
- No SDK package (`packages/atai-sdk`) — later phase.
- No usage charging (ledger writes) — later phase; `runtime_usage` schema only.
- No pricing logic, no new env vars beyond none (this phase needs zero new secrets).
- No changes to the build pipeline, Totalum client, or existing billing.

# 7. WHEN YOU FINISH

Report: files added/changed (expect ~8 new files + 3 small edits:
`lib/types/db.ts`, `lib/db/collections.ts`, `proxy.ts`), test results, typecheck
results, and any deviation from this prompt with justification. Do not claim the
router, providers, or SDK are implemented — they are not part of this phase.

---

## PROMPT — End
