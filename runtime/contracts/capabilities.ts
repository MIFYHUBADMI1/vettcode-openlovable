/**
 * Atai Runtime — Shared Contracts (SDK-consumable)
 *
 * Single source of truth for the Runtime API's request/response vocabulary.
 * These types and schemas are intentionally **free of server-only imports and
 * MongoDB types** so the future SDK package (packages/atai-sdk, Phase 7) can
 * consume them verbatim without dragging server code into browser bundles.
 *
 * Server modules under lib/runtime/** may import from here; the reverse is
 * forbidden — contracts must never import server-only code.
 *
 * Zod is used (the repo's existing validation library) so contracts can be
 * validated at the runtime API edge and reused by the SDK for response
 * parsing.
 *
 * @module runtime/contracts/capabilities
 */

import { z } from "zod"

// ─── Capability identifiers ────────────────────────────────────────────────
//
// Capability IDs are the *products* of the Runtime API (what a generated app
// asks for), NOT provider confirmations. A capability existing here does NOT
// mean any provider supports it — each capability stays UNVERIFIED until its
// provider documentation is checked in its own implementation phase (Phase 1
// report, capability matrix).

export const CAPABILITY_IDS = [
  // AI
  "ai.text",
  "ai.reason",
  "ai.vision",
  "ai.image",
  "ai.video",
  "ai.transcribe",
  "ai.speak",
  "ai.embed",
  "ai.models",
  // Search / web
  "search.web",
  "web.scrape",
  "web.crawl",
  // Data & files
  "db",
  "storage",
  // Commerce & comms
  "payments",
  "auth",
  "email",
  "sms",
  "whatsapp",
  "notifications",
  // Location & time
  "maps",
  "calendar",
  // AI infrastructure
  "vectors",
  // NOTE: CDN/DNS/domain capabilities are explicitly OUT OF SCOPE for Phase 2
  // (verification directive). A future atai.cdn abstraction over Cloudflare
  // may be added in its own approved phase — never preemptively.
] as const

export type CapabilityId = (typeof CAPABILITY_IDS)[number]

/** Central runtime environment enum — never re-declare this union elsewhere. */
export const RUNTIME_ENVIRONMENTS = ["development", "production"] as const
export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number]

/**
 * A capability scope granted to an API key. Today a scope equals a capability
 * ID; a future dotted-operation sub-namespace (e.g. `ai.image.generate`) can
 * be introduced later without breaking existing keys because validation is
 * prefix-tolerant (see CapabilityScopeSchema).
 */
export type CapabilityScope = CapabilityId

// ─── Zod schemas ───────────────────────────────────────────────────────────

export const CapabilityIdSchema = z.enum(CAPABILITY_IDS)

/**
 * Scope validation. Accepts exact capability IDs; also tolerates future
 * dotted sub-operations of a known capability (e.g. "ai.image.generate") so
 * the scope vocabulary can evolve without invalidating previously issued
 * keys.
 */
export const CapabilityScopeSchema = z
  .string()
  .refine(
    (s) =>
      (CAPABILITY_IDS as readonly string[]).includes(s) ||
      CAPABILITY_IDS.some((c) => s.startsWith(`${c}.`)),
    { message: "Unknown capability scope" },
  )

export const RuntimeEnvironmentSchema = z.enum(RUNTIME_ENVIRONMENTS)

/** Scopes stored on a key; empty array means "all capabilities granted". */
export const ApiKeyScopesSchema = z.array(CapabilityScopeSchema).max(50) as unknown as z.ZodType<CapabilityScope[]>

// ─── API key public shape (safe to return from any endpoint) ──────────────

export const ApiKeyStatusSchema = z.enum(["active", "revoked", "expired"])
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>

/**
 * Public API key metadata. By construction this type can never carry the
 * plaintext secret or its hash — there is no field for either.
 *
 * Lifecycle metadata (revocation/rotation) is included so dashboards can
 * render key history; all fields are additive and optional.
 */
export const ApiKeyPublicSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environment: RuntimeEnvironmentSchema,
  name: z.string().optional(),
  /** Non-secret display prefix, e.g. "atai_production_a81f…". */
  keyPrefix: z.string(),
  scopes: ApiKeyScopesSchema,
  status: ApiKeyStatusSchema,
  createdAt: z.number(),
  lastUsedAt: z.number().optional(),
  expiresAt: z.number().optional(),
  // ── Lifecycle metadata (Phase 3) ──
  revokedAt: z.number().optional(),
  /** Sanitized reason — never contains secrets or raw error text. */
  revokedReason: z.string().optional(),
  /** Set on the NEW key: the key this one replaced. */
  rotatedFromId: z.string().optional(),
  /** Set on the OLD key: the key that replaced it. */
  rotatedToId: z.string().optional(),
})
export type ApiKeyPublic = z.infer<typeof ApiKeyPublicSchema>

/**
 * The one-time create response. The plaintext `secret` appears exactly once,
 * at creation; it is never persisted server-side and never returned again.
 */
export const ApiKeyCreatedSchema = ApiKeyPublicSchema.extend({
  secret: z.string(),
})
export type ApiKeyCreated = z.infer<typeof ApiKeyCreatedSchema>

// ─── API key creation input (service-level; dashboard route derives
// projectId from the URL path and userId from the session) ─────────────────

export const ApiKeyCreateInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  environment: RuntimeEnvironmentSchema,
  scopes: ApiKeyScopesSchema,
  /** Optional absolute epoch-ms expiry. Must be in the future if present. */
  expiresAt: z.number().int().positive().optional(),
})
export type ApiKeyCreateInput = z.infer<typeof ApiKeyCreateInputSchema>

// ─── Runtime request identity & context ───────────────────────────────────

/** Opaque per-request identifier connecting request → provider → usage → billing → logs. */
export type RuntimeRequestId = string

export function formatRequestId(): RuntimeRequestId {
  // High-entropy, URL-safe, sortable-ish request id. Crypto only — no Math.random.
  const rand = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? ""
  return `rtreq_${rand}`
}

/**
 * Server-side runtime context, derived EXCLUSIVELY from an authenticated API
 * key. SECURITY INVARIANT: userId/projectId/environment must never be read
 * from client-supplied request bodies, headers, or query strings — they come
 * from the key record only. (Enforced by tests.)
 */
export interface RuntimeContext {
  requestId: RuntimeRequestId
  userId: string
  projectId: string
  apiKeyId: string
  environment: RuntimeEnvironment
  scopes: CapabilityScope[]
}

/** Runtime usage record shape (also persisted in the runtime_usage collection). */
export const RuntimeUsageStatusSchema = z.enum(["succeeded", "failed"])
export type RuntimeUsageStatus = z.infer<typeof RuntimeUsageStatusSchema>

export const RuntimeUsageEventSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  userId: z.string(),
  projectId: z.string(),
  apiKeyId: z.string(),
  environment: RuntimeEnvironmentSchema,
  capability: z.string(), // validated as scope; kept loose for future sub-operations
  operation: z.string().optional(),
  provider: z.string(),
  model: z.string().optional(),
  status: RuntimeUsageStatusSchema,
  latencyMs: z.number().int().nonnegative(),
  /** Provider-reported usage metrics (tokens, credits used…). No content payloads. */
  usage: z.record(z.string(), z.unknown()).optional(),
  /** Provider cost inputs (e.g. token counts, per-unit prices). Never secrets. */
  costMetadata: z.record(z.string(), z.unknown()).optional(),
  creditsCharged: z.number(),
  errorCategory: z.string().optional(),
  createdAt: z.number(),
})
export type RuntimeUsageEvent = z.infer<typeof RuntimeUsageEventSchema>
