/**
 * Atai Runtime — Router contracts (SDK-safe).
 *
 * Shared, strongly-typed vocabulary for the Runtime Router (Phase 5).
 * Everything exported here is consumable by the future SDK package: no
 * server-only imports, no MongoDB types, no secrets.
 *
 * Provider neutrality is the core invariant: generated applications speak
 * Atai's capability/operation vocabulary and receive Atai's normalized
 * response/error shapes — never a provider's wire format (Phase 5 §21/§22).
 *
 * @module runtime/contracts/router
 */

import { z } from "zod"

// ─── Capability & operation vocabulary ─────────────────────────────────────
//
// A CAPABILITY is a high-level service (ai, search, payments, …). An
// OPERATION is a provider-neutral action within it (chat, embed, web …).
// Operations are NOT provider API method names — adapters translate.

/**
 * Provider-neutral operation identifiers. Deliberately small: only actions
 * with an architectural owner today. New operations join this registry —
 * the router never hard-codes them.
 *
 * Phase 10 additions: synthesize (ai.speak), scrape (web.scrape), and the
 * shared "send" action for the side-effect comms capabilities (email, sms,
 * whatsapp, notifications) plus geocode/reverseGeocode (maps).
 *
 * Phase 10 second wave: calendar scheduling (listBookings/createBooking),
 * vector storage (upsert/search/delete), the generated app's runtime
 * database (query/create/edit/delete), and checkout sessions
 * (createCheckout).
 */
export const RUNTIME_OPERATIONS = [
  "chat",
  "completion",
  "embed",
  "web",
  // Phase 10
  "synthesize",
  "scrape",
  "send",
  "geocode",
  "reverseGeocode",
  // Phase 10 second wave
  "listBookings",
  "createBooking",
  "upsert",
  "search",
  "delete",
  "query",
  "create",
  "edit",
  "createCheckout",
] as const

export type RuntimeOperation = (typeof RUNTIME_OPERATIONS)[number]

/**
 * Capability → allowed operations. This is the registry of what the Runtime
 * API *can* route — NOT a claim that any provider implements it. Every
 * capability remains UNVERIFIED until its provider adapter exists (Phase 6+).
 * `test` exists for router testing only and must never ship a production
 * adapter (Phase 5 §39).
 *
 * NOTE: `auth` is deliberately ABSENT (Phase 10 §21/§86 — end-user auth for
 * generated apps is owned by the Totalum SDK inside the generated app; no
 * safe provider-neutral contract exists for an external auth provider yet).
 * A capability id without an entry here is unreachable — routing rejects it.
 */
export const CAPABILITY_OPERATIONS: Record<string, readonly RuntimeOperation[] | readonly string[]> = {
  "ai.text": ["chat", "completion", "embed"],
  "ai.embed": ["embed"],
  "ai.speak": ["synthesize"],
  "search.web": ["web"],
  "web.scrape": ["scrape"],
  "email": ["send"],
  "sms": ["send"],
  "whatsapp": ["send"],
  "notifications": ["send"],
  "maps": ["geocode", "reverseGeocode"],
  // Phase 10 second wave
  "calendar": ["listBookings", "createBooking"],
  "vectors": ["upsert", "search", "delete"],
  "db": ["query", "create", "edit", "delete"],
  "payments": ["createCheckout"],
  // Test-only capability proving the router end-to-end (mock adapter).
  test: ["echo"],
} as const

/** All capability IDs the registry knows about. */
export const ROUTE_CAPABILITY_IDS = Object.keys(CAPABILITY_OPERATIONS)

// ─── Runtime request contract ──────────────────────────────────────────────

/**
 * Provider-neutral runtime request. SECURITY: identity fields
 * (userId/projectId/environment/apiKeyId) are structurally FORBIDDEN here —
 * they come exclusively from the authenticated RuntimeAuthContext (Phase 5
 * §10/§19). z.never() makes any attempt a validation error.
 */
export const RuntimeRequestSchema = z
  .object({
    /** High-level capability, e.g. "ai.text". */
    capability: z.string().min(1).max(100),
    /** Provider-neutral operation within the capability, e.g. "chat". */
    operation: z.string().min(1).max(100),
    /** Operation input — validated per-operation by the capability layer. */
    input: z.unknown().optional(),
    /** Optional caller metadata (never treated as identity/authorization). */
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Identity injection attempts are rejected explicitly. */
    userId: z.never().optional(),
    projectId: z.never().optional(),
    environment: z.never().optional(),
    apiKeyId: z.never().optional(),
    /** Client-supplied pricing/charge fields are never authoritative. */
    credits: z.never().optional(),
    price: z.never().optional(),
    providerCost: z.never().optional(),
    discount: z.never().optional(),
  })
  .strict()

export type RuntimeRequest = z.infer<typeof RuntimeRequestSchema>

// ─── Runtime response contract ─────────────────────────────────────────────

/**
 * Normalized Atai response. Generated applications NEVER see a provider's
 * wire format — adapters return provider-neutral `data`.
 */
export interface RuntimeResponse<T = unknown> {
  requestId: string
  capability: string
  operation: string
  data: T
}

// ─── Adapter execution envelope ────────────────────────────────────────────

/**
 * What an adapter receives: the authenticated identity (read-only), the
 * normalized request, and the correlation ID. Adapters must NOT re-derive
 * identity from request content.
 */
export interface ProviderExecutionRequest {
  /** Trusted identity from Phase 4 authentication. */
  auth: {
    apiKeyId: string
    userId: string
    projectId: string
    environment: "development" | "production"
    scopes: readonly string[]
  }
  /** Correlation ID (Phase 4 format: rtreq_...). */
  requestId: string
  /** Validated, provider-neutral request. */
  request: RuntimeRequest
}

/**
 * Provider-neutral billable usage, normalized BY the adapter from whatever
 * the provider reported (Phase 9). This is the ONLY usage shape the runtime
 * metering layer consumes — billing never parses raw provider payloads.
 *
 * All values must be non-negative and finite; the meter validates before
 * charging (provider usage is untrusted external input).
 */
export interface NormalizedProviderUsage {
  /** Input/prompt tokens (or the capability's analogous unit). */
  inputTokens: number
  /** Output/completion tokens (or the capability's analogous unit). */
  outputTokens: number
  /** The provider's own total, when it reports one. */
  totalTokens?: number
  /**
   * Provider-reported monetary cost (Phase 9.5 §23/§24) — what the provider
   * says the request cost in real currency. NEVER the Atai customer charge;
   * recorded verbatim for Atai-side financial analytics. Undefined = the
   * provider did not report a usable cost (recorded as "unavailable", not 0).
   */
  providerCost?: number
  /** Currency of providerCost as reported by the provider (e.g. "USD"). */
  providerCostCurrency?: string
  /** provenance: provider_reported (confirmed) vs provider_estimated. */
  providerCostSource?: "provider_reported" | "provider_estimated"
  /**
   * Provider-specific usage metadata (Phase 10, §55): safe numeric/string
   * scalars reported by the provider — e.g. characters billed (voice),
   * credits used (scrape/search), message segments (sms). Merged into the
   * runtime_usage record's usage object. NEVER request/response content,
   * never credentials.
   */
  metadata?: Record<string, unknown>
}

/**
 * Normalized adapter result. `data` must be provider-neutral; `provider` is
 * safe metadata (a name), never credentials or raw provider payloads.
 * `usage` (Phase 9) carries the billable normalized usage when the provider
 * reported it — undefined means no billable usage (adapter retries collapse
 * into ONE result, so one logical operation never reports usage twice).
 */
export interface ProviderExecutionResponse<T = unknown> {
  provider: string
  data: T
  usage?: NormalizedProviderUsage
}

/**
 * Normalized error categories an adapter may throw. Raw provider errors must
 * be wrapped — never allowed to propagate across the boundary (Phase 5 §22).
 */
export type ProviderFailureCategory =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_error"
  | "provider_rate_limited"
  | "unsupported_operation"
