# Atai Runtime — API-Key Authentication (Phase 4)

How generated applications authenticate to the Atai Runtime API. This is the
**customer runtime** authentication domain — completely separate from the Atai
web session system used by the dashboard.

## Credential

```text
ATAI_API_KEY=atai_<environment>_<secret>
```

Keys are issued via the dashboard key-management API (Phase 3 lifecycle: see
`docs/RUNTIME_API_KEYS.md`). The plaintext is shown exactly once at
creation/rotation.

## Request authentication

Standard HTTP Bearer authentication:

```http
Authorization: Bearer atai_production_xxxxxxxxxxxx
```

The credential is extracted by **one canonical extractor**
(`lib/runtime/auth/extract.ts`). Missing header, wrong scheme, empty token, or
a non-runtime token shape is rejected before any database work.

## The canonical authentication path

All runtime endpoints call exactly one function — `authenticateRuntimeRequest()`
in `lib/runtime/auth/authenticate.ts`:

```text
HTTP request
   ↓
extractApiKey()            missing / malformed / wrong shape → 401
   ↓
SHA-256 hash               same normalization as creation
   ↓
classifyApiKeyByHash()     one indexed lookup; full lifecycle state
   ↓
status/expiration check    revoked → runtime_key_revoked (401)
                           expired (expiresAt <= now, regardless of stored
                           status) → runtime_key_expired (401)
   ↓
rate limits                failures: 20 per 5 min per hash
                           requests: 300 per minute per key (both reuse the
                           existing Mongo limiter; mapped to
                           runtime_rate_limited at the boundary)
   ↓
touchLastUsed()            throttled ≥60s per key; failure never rejects
   ↓
RuntimeAuthContext         { requestId, apiKeyId, userId, projectId,
                             environment, scopes } — server-trusted
```

## Trusted context — the security invariant

`userId`, `projectId`, `environment`, and `scopes` come **only** from the
`api_keys` record. There is no code path by which a client can set them:

- Request bodies/headers/query strings are never read for identity. A body
  claiming `{"projectId": "other"}` or an `X-Project-ID` header is ignored.
- `authenticateRuntimeRequest(request)` takes only the `Request` — no identity
  parameter exists to misuse.
- Environment is bound to the key: a production key is always a production
  key; a development key can never claim production.

## Authentication ≠ authorization

- `authenticateRuntimeRequest()` answers *who the key is*.
- `requireRuntimeScope(context, capability)` answers *what the key may do*:
  `scopes: []` = all capabilities; otherwise exact capability IDs cover their
  dotted sub-operations (`ai.image` covers `ai.image.generate`). Denial throws
  `runtime_capability_not_allowed` (403).

## Error contract

Stable runtime error codes via the central `AppError`/`fail()` envelope
(no second error system):

| Situation | Code | HTTP |
|---|---|---|
| No/wrong/unknown credential | `runtime_authentication_error` | 401 |
| Revoked key | `runtime_key_revoked` | 401 |
| Expired key | `runtime_key_expired` | 401 |
| Throttled | `runtime_rate_limited` | 429 |
| Scope denied | `runtime_capability_not_allowed` | 403 |

Responses never disclose key metadata beyond the code — revoked and unknown
keys are indistinguishable to a caller without the code, and no message ever
contains a hash, prefix, or key material.

## Secret safety

- Plaintext keys exist only in the request and the one-time creation/rotation
  response; they are never persisted or logged.
- The Authorization header is never logged. Logs carry safe identifiers only
  (`requestId`, `apiKeyId`, `userId`, `projectId`, `environment`, failure
  reason).
- Rate-limit identifiers are the credential **hash** and `apiKeyId` — never
  plaintext.
- `keyPrefix` is display metadata and can never authenticate.

## Internal-auth separation

`ATAI_INTERNAL_KEY` (internal service-to-server authentication) is a different
security domain. It does not match the runtime key shape, is not rejected as
equivalent, and there is no fallback such as "try the internal key if the
customer key fails". Customer keys cannot reach internal endpoints.

## Gateway note

`proxy.ts` (the Next.js edge gate that requires a session cookie on `/api/*`)
excludes `/api/runtime/v1/` — the Bearer-auth domain. Management routes under
`/api/runtime/keys/*` intentionally remain session-gated.

## Known limitations (documented, deferred by design)

- No response caching of key validation (Phase 4 §24: simplest correct
  implementation). Every request performs one indexed lookup. If latency
  requires caching later, it must be short-TTL and invalidation-aware.
- No per-capability or per-provider rate limits yet — Phase 5+ router concern.
- Rate-limit windows are per-instance fixed windows (existing repo mechanism);
  cross-region global limiting would need a redesign in a later phase.
