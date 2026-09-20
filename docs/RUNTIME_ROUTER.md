# Atai Runtime — Router Core (Phase 5)

The provider-neutral highway between Phase 4 authentication and future
provider adapters. Phase 6 (OpenRouter) will be the first production adapter —
it plugs in without a single router change.

## API surface

```text
POST /api/runtime/v1        { capability, operation, input?, metadata? }
GET  /api/runtime/v1        capability/operation discovery (registry metadata only)
```

Both live under the versioned `/api/runtime/v1/` namespace that `proxy.ts`
excludes from session gating (Bearer-key domain). The GET response lists what
the registry knows — it does NOT promise provider availability.

## Request/response contract (SDK-safe: `runtime/contracts/router.ts`)

```jsonc
// Request — identity fields are structurally FORBIDDEN (z.never + strict):
{
  "capability": "ai.text",
  "operation": "chat",
  "input": { "messages": [] },
  "metadata": {}          // optional, never identity/authorization
}

// Response — normalized Atai shape, never a provider wire format:
{
  "requestId": "rtreq_...",
  "capability": "ai.text",
  "operation": "chat",
  "data": { ... }         // provider-neutral, adapter-produced
}
```

## Router lifecycle (`lib/runtime/router/router.ts`)

```text
authenticateRuntimeRequest()        Phase 4 — trusted RuntimeAuthContext + requestId
   ↓
routeRuntimeRequest(auth, body)
   ├─ parseRuntimeRequest()         zod strict; identity injection rejected
   ├─ hasCapability()               capability-registry.ts (data-driven)
   ├─ hasOperation()                registry-driven, provider-neutral ops
   ├─ requireRuntimeScope()         Phase 4 primitive reused (403 on denial)
   ├─ resolveProviderAdapter()      provider-registry.ts, first-match deterministic
   ├─ adapter.execute()             inside the provider failure boundary
   └─ RuntimeResponse               normalized; logs carry safe metadata only
```

Routing failures map onto the Phase 2 runtime error taxonomy
(`routingFailureToAppError`): invalid request → 422, unknown
capability/operation → 404, no adapter → 501, provider error → 502, provider
timeout → 504. `ProviderExecutionError` keeps raw provider internals
server-side; unexpected adapter exceptions normalize to
`runtime_provider_error` and never propagate raw.

## Registries

- **Capability registry** (`capability-registry.ts`): what the runtime CAN
  route — capability IDs and their provider-neutral operations from
  `CAPABILITY_OPERATIONS`. Extend the contract table to add a capability; the
  router is untouched. `test`/`echo` exists for router testing only.
- **Provider registry** (`provider-registry.ts`): which adapter serves a
  capability+operation. Phase 6 registers the first production adapter
  (OpenRouter, `ai.text`/`chat`) — every other capability still resolves to
  the graceful `runtime_capability_unavailable` (501).

## Phase 6 (OpenRouter) — plugged in with no router changes

Implemented in `lib/runtime/router/adapters/openrouter/` (adapter, client,
mapper, errors, config, types). The route module registers it at startup:

```ts
// app/api/runtime/v1/route.ts — module top-level, once per server process
registerOpenRouterAdapter()
```

Scope: `ai.text`/`chat` only, official endpoint
`https://openrouter.ai/api/v1/chat/completions`, server-side
`OPENROUTER_API_KEY` (never from the request). Responses are normalized to
provider-neutral data (`id`, `model` actually used, `content`, `finishReason`,
`usage`); failures become `ProviderExecutionError` categories, including
`provider_rate_limited` for a provider 429 (distinct from Atai's own
`runtime_rate_limited`). Streaming, model fallbacks, and provider routing
options are deliberately not exposed yet.

Adapter rules: normalized input in, normalized output out; credentials never
cross the boundary; all failures wrapped in `ProviderExecutionError`;
timeouts/retries are adapter concerns.

## Security invariants

- Identity (`userId`/`projectId`/`environment`/`apiKeyId`) flows only from the
  Phase 4 context — request bodies cannot set or override it (schema rejects
  identity fields; tests prove adapter-side truth).
- Scope authorization happens BEFORE adapter resolution — an out-of-scope key
  never reaches provider code.
- Untrusted body and trusted context stay distinct parameters; they never merge.
- Logs carry `requestId`, `apiKeyId`, `userId`, `projectId`, `environment`,
  `capability`, `operation`, `provider`, `latencyMs`, `status` — never keys,
  hashes, Authorization headers, or raw input content.

## Intentionally deferred

- Per-operation input schemas (arrive with each capability's provider phase).
- Runtime usage metering and billing hooks (later phase; `runtime_usage`
  service already exists unused by the router).
- Runtime idempotency (Phase 2 contract reserved `runtimeUsageIdempotencyKey`;
  not wired — no billing behavior exists yet).
- `runtime_requests` persistence (deliberately not created — Phase 2 decision).
