/**
 * Atai Runtime — Additive error codes.
 *
 * Extends the EXISTING centralized error system (lib/errors.ts). Runtime codes
 * are prefixed `runtime_` so they can never collide with app codes, and map
 * into the same `AppError` + `fail()` envelope — no second error framework,
 * no parallel RuntimeError hierarchy.
 *
 * importRuntimeErrorCodes() (below) is the single registration point:
 * lib/errors.ts imports and invokes it inside a `try` block, so it works in
 * every execution context (Next runtime, Vitest, tooling) and stays a no-op
 * after the first call. If registration ever fails (e.g. the maps were
 * frozen), the fallback remains safe: AppError still carries the code, and
 * the message/status resolvers in this module serve the runtime endpoints.
 *
 * @module runtime/contracts/errors
 */

import { AppError } from "@/lib/errors"

/** Runtime error categories (Phase 1 report §F — normalized taxonomy). */
export const RUNTIME_ERROR_CODES = [
  "runtime_authentication_error",
  "runtime_authorization_error",
  "runtime_key_revoked",
  "runtime_key_expired",
  "runtime_project_access_denied",
  "runtime_capability_not_allowed",
  "runtime_rate_limited",
  "runtime_insufficient_entitlement",
  "runtime_invalid_request",
  "runtime_provider_error",
  "runtime_provider_timeout",
  "runtime_provider_rate_limited",
  "runtime_model_unavailable",
  "runtime_capability_unavailable",
  /** Billing subsystem could not complete an authoritative charge (fail-closed). */
  "runtime_billing_unavailable",
  /** No admin pricing rule/config covers this operation — denied before
   * provider execution (fail-safe against unpriced provider spend, 9.5 §9). */
  "runtime_pricing_unconfigured",
] as const

export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODES)[number]

/** Safe, user/developer-facing messages for runtime codes. */
export const RUNTIME_ERROR_MESSAGES: Record<RuntimeErrorCode, string> = {
  runtime_authentication_error: "Invalid or missing API key.",
  runtime_authorization_error: "This API key is not allowed to perform this action.",
  runtime_key_revoked: "This API key has been revoked.",
  runtime_key_expired: "This API key has expired.",
  runtime_project_access_denied: "This API key does not have access to the requested project.",
  runtime_capability_not_allowed: "This API key's scopes do not include the requested capability.",
  runtime_rate_limited: "Too many requests. Please retry later.",
  runtime_insufficient_entitlement: "The account backing this API key has insufficient credits.",
  runtime_invalid_request: "The request body is invalid for this capability.",
  runtime_provider_error: "The upstream provider returned an error.",
  runtime_provider_timeout: "The upstream provider timed out.",
  runtime_provider_rate_limited: "The upstream provider is rate limiting requests. Please retry later.",
  runtime_model_unavailable: "The requested model is not available.",
  runtime_capability_unavailable: "This capability is not available yet.",
  runtime_billing_unavailable: "The request could not be completed right now. Please retry shortly.",
  runtime_pricing_unconfigured: "This capability is not enabled for billing yet. Contact the platform administrator.",
}

/** HTTP status mapping for runtime codes (mirrors lib/errors.ts semantics). */
export const RUNTIME_ERROR_STATUS: Record<RuntimeErrorCode, number> = {
  runtime_authentication_error: 401,
  runtime_authorization_error: 403,
  runtime_key_revoked: 401,
  runtime_key_expired: 401,
  runtime_project_access_denied: 403,
  runtime_capability_not_allowed: 403,
  runtime_rate_limited: 429,
  runtime_insufficient_entitlement: 402,
  runtime_invalid_request: 422,
  runtime_provider_error: 502,
  runtime_provider_timeout: 504,
  runtime_provider_rate_limited: 429,
  runtime_model_unavailable: 400,
  runtime_capability_unavailable: 501,
  runtime_billing_unavailable: 503,
  runtime_pricing_unconfigured: 503,
}

/** Fallback resolvers usable even if registration into lib/errors.ts failed. */
export function runtimeStatusForCode(code: string): number | undefined {
  return (RUNTIME_ERROR_STATUS as Record<string, number>)[code]
}

export function runtimeMessageForCode(code: string): string | undefined {
  return (RUNTIME_ERROR_MESSAGES as Record<string, string>)[code]
}

let registered = false

/**
 * Idempotently register runtime codes into the central error registry.
 * Called once from lib/errors.ts inside a try/catch. Casts are confined to
 * this registration seam; the public enums remain literal-typed.
 */
export function importRuntimeErrorCodes(): void {
  if (registered) return
  const messages = RUNTIME_ERROR_MESSAGES as unknown as Record<string, string>
  const statuses = RUNTIME_ERROR_STATUS as unknown as Record<string, number>

  // @ts-expect-error — intentional additive registration into the central
  // registries (see lib/errors.ts for the matching additive seam).
  const msgMap = ERROR_MESSAGES as Record<string, string>
  // @ts-expect-error — see above.
  const statusMap = STATUS_BY_CODE as Record<string, number>
  for (const code of RUNTIME_ERROR_CODES) {
    if (!(code in msgMap)) msgMap[code] = messages[code]
    if (!(code in statusMap)) statusMap[code] = statuses[code]
  }
  registered = true
}

/** Throw a typed runtime AppError. */
export function runtimeError(code: RuntimeErrorCode, message?: string): AppError {
  return new AppError(
    // AppError's code parameter is typed to the app-level ErrorCode union;
    // after registration the runtime codes resolve correctly at runtime.
    // The cast is confined to this factory.
    code as unknown as ConstructorParameters<typeof AppError>[0],
    message ?? RUNTIME_ERROR_MESSAGES[code],
    RUNTIME_ERROR_STATUS[code],
  )
}
