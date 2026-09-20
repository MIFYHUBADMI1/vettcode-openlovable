import "server-only"
import { twilioAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Twilio adapter barrel (server-only).
 *
 * @module lib/runtime/router/adapters/twilio
 */

export { twilioAdapter, TWILIO_PROVIDER_ID } from "./adapter"
export { isTwilioConfigured } from "./config"
export { SmsSendInputSchema, WhatsappSendInputSchema } from "./mapper"
export type { MessageSendResultData } from "./mapper"

/** Register Twilio as the provider for its capability+operation pairs. */
export function registerTwilioAdapter(): void {
  registerProviderAdapter(twilioAdapter)
}
