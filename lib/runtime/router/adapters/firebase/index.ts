import "server-only"
import { firebaseAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Firebase adapter barrel (server-only).
 *
 * @module lib/runtime/router/adapters/firebase
 */

export { firebaseAdapter, FIREBASE_PROVIDER_ID } from "./adapter"
export { isFirebaseConfigured } from "./config"
export { NotificationSendInputSchema } from "./mapper"
export { clearFcmTokenCache } from "./auth"
export type { NotificationSendResultData } from "./mapper"

/** Register Firebase as the provider for its capability+operation. */
export function registerFirebaseAdapter(): void {
  registerProviderAdapter(firebaseAdapter)
}
