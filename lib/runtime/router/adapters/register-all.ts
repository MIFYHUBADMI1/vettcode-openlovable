import "server-only"
import { registerOpenRouterAdapter } from "./openrouter"
import { registerElevenLabsAdapter } from "./elevenlabs"
import { registerFirecrawlAdapter } from "./firecrawl"
import { registerResendAdapter } from "./resend"
import { registerTwilioAdapter } from "./twilio"
import { registerFirebaseAdapter } from "./firebase"
import { registerMapboxAdapter } from "./mapbox"
import { registerCalComAdapter } from "./calcom"
import { registerCloudflareAdapter } from "./cloudflare"
import { registerTotalumAdapter } from "./totalum"
import { registerDodoAdapter } from "./dodo"

/**
 * Atai Runtime — production adapter registration (server-only).
 *
 * The ONE place every production adapter joins the Phase 5 provider
 * registry. Adding a provider is one line here plus its own adapter module
 * — no router changes, no second registry (Phase 10 FINAL PRINCIPLE:
 * "adding a provider must become boring").
 *
 * Idempotent: a module-level guard makes repeated imports/calls a no-op, so
 * the runtime route and admin surfaces can both safely depend on the
 * registry being populated (the admin pricing API validates rules against
 * listProviders(), which reflects THIS registration — Phase 10 §54).
 *
 * @module lib/runtime/router/adapters/register-all
 */

let registered = false

export function registerAllRuntimeAdapters(): void {
  if (registered) return
  registerOpenRouterAdapter()
  registerElevenLabsAdapter()
  registerFirecrawlAdapter()
  registerResendAdapter()
  registerTwilioAdapter()
  registerFirebaseAdapter()
  registerMapboxAdapter()
  registerCalComAdapter()
  registerCloudflareAdapter()
  registerTotalumAdapter()
  registerDodoAdapter()
  registered = true
}
