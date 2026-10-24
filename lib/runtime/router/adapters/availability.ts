import "server-only"
import { CAPABILITY_OPERATIONS } from "@/runtime/contracts/router"
import { registerAllRuntimeAdapters } from "./register-all"
import {
  resolveProviderAdapter,
} from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — capability availability map (server-only).
 *
 * Answers one dashboard question: "which capabilities can a key actually
 * exercise on THIS deployment?" Two independent layers, reported separately:
 *
 *  1. WIRING — is a production adapter registered for this capability at all?
 *     Answered by the Phase 5 provider registry (never promises by itself).
 *  2. CONFIGURATION — are the platform's server-side provider credentials
 *     present in this deployment? Answered by the environment variable names
 *     each adapter's config module reads (names only — NEVER their values).
 *
 * Response metadata is safe to expose publicly: provider names, capability
 * ids, and MISSING environment variable NAMES only. No secrets, no values,
 * no per-project data (unlike the per-key /health route).
 *
 * @module lib/runtime/router/adapters/availability
 */

/** One capability's deployment status (safe to expose publicly). */
export interface CapabilityAvailability {
  /** The provider behind this capability (null when nothing is wired yet). */
  provider: string | null
  /** true when every required env var is present; null when nothing is wired. */
  configured: boolean | null
  /** NAMES ONLY of env vars missing on this deployment (no values, ever). */
  missingEnvVars: string[]
  /** Registry operations paired with their per-operation adapter wiring. */
  operations: { name: string; available: boolean }[]
}

/**
 * Environment variables each AVAILABLE capability's provider needs. Keep in
 * sync with each adapter's config module — those modules stay the single
 * runtime access point; this list only powers status metadata.
 */
const REQUIRED_ENV_VARS: Record<string, readonly string[]> = {
  "ai.text": ["OPENROUTER_API_KEY"],
  // Embeddings run on Cloudflare Workers AI (account + token; the model id
  // has a platform default). No Vectorize index is needed to embed.
  "ai.embed": ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
  "ai.speak": ["ELEVENLABS_API_KEY"],
  "ai.image": ["OPENROUTER_API_KEY"],
  "ai.video": ["OPENROUTER_API_KEY"],
  "ai.speech": ["OPENROUTER_API_KEY"],
  "ai.transcribe": ["OPENROUTER_API_KEY"],
  "ai.vision": ["OPENROUTER_API_KEY"],
  "search.web": ["FIRECRAWL_API_KEY"],
  "web.scrape": ["FIRECRAWL_API_KEY"],
  "email": ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
  "sms": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
  "whatsapp": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM_NUMBER"],
  "notifications": ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
  "maps": ["MAPBOX_ACCESS_TOKEN"],
  // CALCOM_DEFAULT_EVENT_TYPE_ID becomes required for createBooking only when
  // the caller does not supply eventTypeId (see the calendar hint).
  "calendar": ["CALCOM_API_KEY"],
  "vectors": ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_VECTORIZE_INDEX"],
  "db": ["TOTALUM_API_KEY"],
  "payments": ["DODO_PAYMENTS_API_KEY"],
}

function missingEnvVarsFor(capability: string): string[] {
  return (REQUIRED_ENV_VARS[capability] ?? []).filter((name) => !process.env[name])
}

export function capabilityAvailability(): Record<string, CapabilityAvailability> {
  registerAllRuntimeAdapters()

  const out: Record<string, CapabilityAvailability> = {}
  for (const [capability, ops] of Object.entries(CAPABILITY_OPERATIONS)) {
    const primary = resolveProviderAdapter(capability, ops[0] as string)
    const missing = missingEnvVarsFor(capability)
    if (primary) {
      out[capability] = {
        provider: primary.provider,
        configured: missing.length === 0,
        missingEnvVars: missing,
        operations: ops.map((op) => ({
          name: op as string,
          available: resolveProviderAdapter(capability, op as string) !== null,
        })),
      }
    } else {
      out[capability] = {
        provider: null,
        configured: null,
        missingEnvVars: [],
        operations: ops.map((op) => ({ name: op as string, available: false })),
      }
    }
  }
  return out
}