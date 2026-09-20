import "server-only"
import { logger } from "@/lib/logging/logger"
import { requireRuntimeScope } from "@/lib/runtime/auth/authorize"
import { runtimeError } from "@/runtime/contracts/errors"
import { RuntimeRequestSchema } from "@/runtime/contracts/router"
import type {
  RuntimeRequest,
  RuntimeResponse,
} from "@/runtime/contracts/router"
import type { RuntimeAuthContext } from "@/runtime/contracts/auth"
import type { CapabilityScope } from "@/runtime/contracts/capabilities"
import { formatRequestId } from "@/runtime/contracts/capabilities"
import {
  meterRuntimeResult,
  recordFailedRuntimeUsage,
  preflightMeteredRequest,
} from "@/lib/runtime/metering"
import type { AppError } from "@/lib/errors"
import type { ProviderCostInfo } from "@/lib/runtime/metering"
import { hasCapability, hasOperation, requiredScopeFor } from "./capability-registry"
import { resolveProviderAdapter } from "./provider-registry"
import {
  ProviderExecutionError,
  providerFailureToRuntimeError,
} from "./adapter"

/**
 * Atai Runtime — central runtime router (server-only).
 *
 * The provider-neutral highway (Phase 5 §7). Orchestration only — zero
 * provider-specific code, no capability switch statements, no billing, no
 * usage persistence. Lifecycle (§28):
 *
 *   1. validate request      (identity injection structurally rejected)
 *   2. capability check      (registry-driven)
 *   3. operation check       (registry-provided)
 *   4. scope authorization   (Phase 4 primitive — reused, not duplicated)
 *   5. adapter resolution    (provider registry, deterministic)
 * 6. execute (normalized adapter contract)
 *   7. normalize response    (Atai shape — never a provider wire format)
 *
 * UNTRUSTED → TRUSTED boundary: untrusted request data never merges into the
 * trusted RuntimeAuthContext; the two flow as distinct parameters (§11/§37).
 *
 * @module lib/runtime/router/router
 */

// ─── Routing failures (stable runtime taxonomy) ────────────────────────────

export type RoutingFailureReason =
  | "invalid_request"
  | "unsupported_capability"
  | "unsupported_operation"
  | "capability_unavailable"
  | "provider_error"
  | "provider_timeout"

/**
 * Routing-level failure. Rethrown as the runtime AppError taxonomy by
 * routingFailureToAppError so route handlers can use handleRouteError
 * directly — no second error/response system.
 */
export class RoutingError extends Error {
  readonly reason: RoutingFailureReason
  readonly status: number
  /** Correlation ID, when one was established before the failure. */
  readonly requestId?: string
  constructor(reason: RoutingFailureReason, status: number, message: string, requestId?: string) {
    super(message)
    this.name = "RoutingError"
    this.reason = reason
    this.status = status
    if (requestId !== undefined) this.requestId = requestId
  }
}

/** Map routing failures onto the Phase 2 runtime error codes. */
export function routingFailureToAppError(e: RoutingError): ReturnType<typeof runtimeError> {
  switch (e.reason) {
    case "invalid_request":
      return runtimeError("runtime_invalid_request", e.message)
    case "unsupported_capability":
      return runtimeError("runtime_capability_unavailable", "The requested capability is not available.")
    case "unsupported_operation":
      return runtimeError("runtime_invalid_request", "The requested operation is not available for this capability.")
    case "capability_unavailable":
      return runtimeError("runtime_capability_unavailable")
    case "provider_timeout":
      return runtimeError("runtime_provider_timeout")
    case "provider_error":
      return runtimeError("runtime_provider_error")
  }
}

// ─── Request validation ────────────────────────────────────────────────────

/**
 * Validate an untrusted runtime request body. Identity injection
 * (userId/projectId/environment/apiKeyId) is structurally rejected by
 * RuntimeRequestSchema (z.never + strict) — a body can never override the
 * authenticated identity.
 */
export function parseRuntimeRequest(
  body: unknown,
  requestId?: string,
): RuntimeRequest {
  const parsed = RuntimeRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new RoutingError("invalid_request", 422, "The runtime request body is invalid.", requestId)
  }
  return parsed.data
}

// ─── Router lifecycle ───────────────────────────────────────────────────────

/**
 * Route and execute one runtime request.
 *
 * @param authContext  TRUSTED — from Phase 4 authenticateRuntimeRequest().
 * @param request      UNTRUSTED — raw request body (parsed/validated here).
 * @param requestId    Correlation ID (reused when auth already created one).
 */
export async function routeRuntimeRequest(
  authContext: RuntimeAuthContext & { requestId?: string },
  body: unknown,
  requestId?: string,
): Promise<RuntimeResponse> {
  // Correlation precedence: explicit arg → Phase 4 auth context → new ID.
  const corrId = requestId ?? authContext.requestId ?? formatRequestId()
  const req = parseRuntimeRequest(body, corrId)

  const logBase = {
    requestId: corrId,
    apiKeyId: authContext.apiKeyId,
    userId: authContext.userId,
    projectId: authContext.projectId,
    environment: authContext.environment,
    capability: req.capability,
    operation: req.operation,
  }

  // 2. Capability check (registry-driven — no switch statements).
  if (!hasCapability(req.capability)) {
    logger.info("runtime.router", "routing rejected: unknown capability", logBase)
    throw new RoutingError(
      "unsupported_capability",
      404,
      "The requested capability is not available.",
      corrId,
    )
  }

  // 3. Operation check.
  if (!hasOperation(req.capability, req.operation)) {
    logger.info("runtime.router", "routing rejected: unknown operation", logBase)
    throw new RoutingError(
      "unsupported_operation",
      404,
      "The requested operation is not available for this capability.",
      corrId,
    )
  }

  // 4. Scope authorization — the canonical Phase 4 primitive, reused.
  // (requiredScopeFor returns the capability string; capability ID == scope ID
  // per the Phase 2 contract, so the cast is a safe narrowing, not a bypass.)
  requireRuntimeScope(authContext, requiredScopeFor(req.capability) as CapabilityScope)

  // 5. Provider resolution — deterministic, registry-driven.
  const adapter = resolveProviderAdapter(req.capability, req.operation)
  if (!adapter) {
    logger.info("runtime.router", "routing rejected: no provider adapter registered", logBase)
    throw new RoutingError(
      "capability_unavailable",
      501,
      "This capability is not available yet.",
      corrId,
    )
  }

  // 5b. Metering preflight (Phase 9 §17, 9.5 §15/§19/§37): resolve pricing
  //     centrally (deny unconfigured operations BEFORE provider spend), then
  //     either pre-charge a fixed price or reject a spent balance. The `test`
  //     capability is the Phase 5 router self-test and is never billed.
  let prepaid
  if (req.capability !== "test") {
    const gate = await preflightMeteredRequest({
      auth: { ...authContext, requestId: corrId },
      provider: adapter.provider,
      capability: req.capability,
      operation: req.operation,
      // Untrusted input used ONLY for the conservative usage-based
      // insufficient-credit estimate (Phase 9.5 audit fix) — never for
      // pricing decisions or identity.
      input: req.input,
    })
    if (gate.denial) throw gate.denial
    prepaid = gate.prepaid
  }

  // 6. Execute inside the provider failure boundary. Raw provider errors are
  //    wrapped server-side and never serialized to clients.
  const startedAt = Date.now()
  try {
    const result = await adapter.execute({
      auth: {
        apiKeyId: authContext.apiKeyId,
        userId: authContext.userId,
        projectId: authContext.projectId,
        environment: authContext.environment,
        scopes: authContext.scopes,
      },
      requestId: corrId,
      request: req,
    })

    const latencyMs = Date.now() - startedAt

    // 7. Runtime metering (Phase 9 §14, 9.5 §23): normalize usage → finalize
    //    the charge (skipped when preflight pre-paid a fixed price) →
    //    runtime_usage record with the pricing snapshot + provider cost.
    //    This is the ONE central billing path — adapters report usage only.
    let meterError: AppError | undefined
    let creditsCharged = 0
    try {
      const metered = await meterRuntimeResult({
        auth: { ...authContext, requestId: corrId },
        provider: adapter.provider,
        capability: req.capability,
        operation: req.operation,
        ...(typeof result.data === "object" && result.data !== null && "model" in (result.data as Record<string, unknown>)
          ? { model: String((result.data as Record<string, unknown>).model) }
          : {}),
        usage: result.usage,
        providerCost: extractProviderCostInfo(result.usage),
        latencyMs,
        startedAt,
        ...(prepaid ? { prepaid } : {}),
      })
      creditsCharged = metered.creditsCharged
    } catch (e) {
      // Billing failures FAIL CLOSED (Phase 9 §128/§129): a provider success
      // with an unknown financial state is never reported as a free success.
      // The provider already ran; the normalized response is NOT returned.
      if (isRuntimeAppError(e)) {
        meterError = e
      } else {
        meterError = runtimeError("runtime_billing_unavailable")
      }
      logger.error("runtime.router", "runtime billing failed — failing closed", {
        ...logBase,
        provider: adapter.provider,
        latencyMs,
        message: e instanceof Error ? e.message : String(e),
      })
    }

    if (meterError) throw meterError

    // 8. Normalized Atai response — never the provider's wire format.
    logger.info("runtime.router", "runtime request routed", {
      ...logBase,
      provider: adapter.provider,
      latencyMs,
      status: "succeeded",
      creditsCharged,
    })

    return {
      requestId: corrId,
      capability: req.capability,
      operation: req.operation,
      data: result.data,
    }
  } catch (e) {
    const latencyMs = Date.now() - startedAt

    // Provider failed → audit with creditsCharged = 0 (Phase 9 §16/§43),
    // then propagate the NORMALIZED provider error (never raw internals).
    // Billing denials (402/503 from metering) are rethrown untouched — they
    // are not provider failures.
    if (e instanceof ProviderExecutionError) {
      await recordFailedRuntimeUsage({
        auth: { ...authContext, requestId: corrId },
        provider: adapter.provider,
        capability: req.capability,
        operation: req.operation,
        errorCategory: e.category,
        latencyMs,
        startedAt,
        ...(prepaid ? { prepaid } : {}),
      })
      logger.warn("runtime.router", "provider execution failed", {
        ...logBase,
        provider: adapter.provider,
        latencyMs,
        status: "failed",
        category: e.category,
        detail: e.detail, // server-side only — logger redaction applies
      })
      throw providerFailureToRuntimeError(e)
    }

    if (isRuntimeAppError(e)) throw e

    // Unknown adapter failure — treat as provider error; the detail stays
    // server-side. Never rethrow raw provider exceptions.
    await recordFailedRuntimeUsage({
      auth: { ...authContext, requestId: corrId },
      provider: adapter.provider,
      capability: req.capability,
      operation: req.operation,
      errorCategory: "provider_error",
      latencyMs,
      startedAt,
      ...(prepaid ? { prepaid } : {}),
    })
    logger.error("runtime.router", "provider threw unexpected error", {
      ...logBase,
      provider: adapter.provider,
      latencyMs,
      status: "failed",
      message: e instanceof Error ? e.message : String(e),
    })
    throw runtimeError("runtime_provider_error")
  }
}

/**
 * Runtime AppErrors (runtime_* codes) must flow to the client untouched —
 * they are contractual responses (402/503/...), not provider failures to be
 * wrapped. Structural check: AppError instances carrying a registered
 * runtime_* code (the central registry is extended additively by
 * runtime/contracts/errors.ts).
 */
function isRuntimeAppError(e: unknown): e is AppError {
  return e instanceof Error && (e as AppError).name === "AppError" && typeof (e as AppError).code === "string" && (e as AppError).code.startsWith("runtime_")
}

/**
 * Map the adapter's normalized usage onto the metering-layer provider-cost
 * contract (Phase 9.5 §23/§50): provider-specific extraction stays inside
 * the adapter boundary; generic billing never parses provider payloads.
 * Unavailable cost stays explicitly unavailable (§82) — never fabricated.
 */
function extractProviderCostInfo(
  usage: import("@/runtime/contracts/router").NormalizedProviderUsage | undefined,
): ProviderCostInfo {
  if (
    usage &&
    typeof usage.providerCost === "number" &&
    Number.isFinite(usage.providerCost)
  ) {
    return {
      amount: usage.providerCost,
      currency: usage.providerCostCurrency ?? "USD",
      source: usage.providerCostSource ?? "provider_reported",
    }
  }
  return { source: "unavailable" }
}
