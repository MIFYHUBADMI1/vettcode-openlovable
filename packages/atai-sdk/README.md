# @atai/sdk

Official Atai Runtime SDK — the typed client generated applications use to
communicate with the **Atai Runtime API**.

The SDK knows only Atai: its origin, its API key, and its capability
vocabulary. Provider implementation, provider credentials, routing, billing,
and storage are Atai infrastructure concerns and never appear in the SDK.

## Installation

```bash
npm install @atai/sdk
```

## Initialization

```ts
import { Atai } from "@atai/sdk"

const atai = new Atai({
  apiKey: process.env.ATAI_API_KEY!, // atai_<environment>_<secret>
  // baseUrl is optional; it defaults to Atai's production runtime origin.
  // Configure it only when pointing at a non-production runtime.
})
```

The client is an instance model — create one per credential/environment:

```ts
const dev = new Atai({ apiKey: process.env.ATAI_DEV_KEY! })
const prod = new Atai({ apiKey: process.env.ATAI_PROD_KEY! })
```

## Authentication

The SDK authenticates every request with your **Atai runtime API key**:

```http
Authorization: Bearer atai_<environment>_<secret>
```

This is a runtime application credential issued through the Atai dashboard —
it is *not* a user session and there is no refresh flow. Create keys, set
scopes, rotate, and revoke them in the Atai dashboard; the SDK simply uses
an existing key.

> **Server-side secret.** Atai runtime keys are secret credentials — there is
> no browser-safe/public key type. If a generated application runs entirely in
> a public browser, the API key can be seen by end users. For production use,
> call the SDK from your server (or a serverless function) and proxy results
> to the browser. Never compensate by embedding any provider key in the
> client — the SDK has no fields for them and never will.
>
> Treat your key like a password: keep it private, never commit it to Git, and
> rotate or revoke it from the Atai dashboard (Workspace → Runtime → API keys)
> if it leaks.

## AI usage

The SDK speaks Atai's capability vocabulary, not any provider's:

```ts
const result = await atai.ai.chat({
  model: "openai/gpt-5.2", // optional; Atai's default model is used otherwise
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Write a haiku about databases." },
  ],
  temperature: 0.7,
  max_tokens: 200,
})

console.log(result.content)
console.log(result.model) // the model Atai actually used
console.log(result.usage?.totalTokens)
```

Fields map 1:1 onto the Atai Runtime `ai.text`/`chat` contract: `messages`,
`model`, `temperature`, `top_p`, `max_tokens`, `stop`, `frequency_penalty`,
`presence_penalty`, `seed`.

## Health check

Verify connectivity and credential status before/alongside real operations —
the "Atai Runtime connected" signal for generated applications:

```ts
const health = await atai.health.check()

console.log(health.status)                 // "operational"
console.log(health.requestId)              // correlation ID for support
console.log(health.identity.projectId)     // your project, from the key record
console.log(health.identity.environment)   // "development" | "production"
```

The health check is Bearer-authenticated with your runtime key and shares the
invocation path's authentication, so a successful check proves the key is
active and unexpired. It never exposes the key, any hash, or provider details.
An invalid/revoked/expired key throws a normalized `AtaiError` (401) instead.

## Errors

Every failure is an `AtaiError` with a normalized code, the HTTP status when
one exists, and the server-provided `requestId` for support correlation:

```ts
import { AtaiError, isAuthenticationError, isRateLimitError } from "@atai/sdk"

try {
  await atai.ai.chat({ messages: [{ role: "user", content: "Hello" }] })
} catch (e) {
  if (e instanceof AtaiError) {
    console.error(e.code)      // runtime_* (from Atai) or atai_* (from the SDK)
    console.error(e.status)    // e.g. 401, 403, 429, 502
    console.error(e.requestId) // correlation ID for support/debugging
    if (isRateLimitError(e)) {
      const waitMs = e.retry?.afterMs // safe retry metadata when provided
    }
  }
}
```

`runtime_*` codes are Atai's normalized taxonomy — a provider failure
upstream arrives as, e.g., `runtime_provider_error` (502). The SDK never
reveals which provider Atai used, and there is nothing provider-specific to
handle.

## Cancellation

Pass a standard `AbortSignal` — the SDK uses the platform's cancellation, no
custom protocol:

```ts
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

try {
  await atai.ai.chat({ messages: [{ role: "user", content: "Long task?" }] }, { signal: controller.signal })
} catch (e) {
  // e.code === "atai_aborted" when cancelled by the caller
}
```

A default per-request timeout (60s) applies; cancellations and timeouts are
always reported as distinct `atai_aborted` / `atai_timeout` errors, never
masked as network or provider failures.

## What the SDK deliberately does NOT do

- **No provider access.** The SDK communicates exclusively with the Atai
  Runtime API. It never contacts a provider and contains no provider code,
  endpoints, or credentials.
- **No provider keys.** `OPENROUTER_API_KEY` and every other provider
  credential stay server-side at Atai. There is no field to set one.
- **No key management.** `createApiKey` / `rotateApiKey` / `revokeApiKey`
  are dashboard operations (Workspace → Runtime), not SDK operations. The
  SDK can only *check* a key's health, never mint or retire credentials.
- **No billing.** Credits, metering, and ledger writes are Atai's server
  responsibility. The SDK only exposes usage metadata included in a
  response; it does not persist anything.
- **No base-URL overrides per request.** The runtime origin comes from
  client configuration only; request parameters cannot redirect traffic.
- **No telemetry.** The SDK sends nothing anywhere except your requests to
  the Runtime API.
- **No secrets in storage.** The SDK never writes your API key to
  localStorage, cookies, or any store — your application owns credential
  handling.

## Security notes

- The API key is sent only as the `Authorization: Bearer` header to the
  configured Atai origin and is never logged, serialized into errors, or
  attached to thrown objects.
- Error messages and `JSON.stringify(error)` are safe to log: they contain
  only code/status/requestId/message.
- The package has **zero runtime dependencies** — it is pure `fetch` +
  standard JavaScript and runs in browsers, Node.js ≥ 18, serverless, and
  edge runtimes.

## License

UNLICENSED — proprietary to Atai.
