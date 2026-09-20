import "server-only"
import { resendAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Resend adapter barrel (server-only).
 *
 * @module lib/runtime/router/adapters/resend
 */

export { resendAdapter, RESEND_PROVIDER_ID } from "./adapter"
export { isResendConfigured, getResendFromAddress } from "./config"
export { EmailSendInputSchema } from "./mapper"
export type { EmailSendResultData } from "./mapper"

/** Register Resend as the provider for its capability+operation. */
export function registerResendAdapter(): void {
  registerProviderAdapter(resendAdapter)
}
