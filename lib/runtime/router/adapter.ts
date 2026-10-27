import "server-only"
import { runtimeError } from "@/runtime/contracts/errors"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
  ProviderFailureCategory,
} from "@/runtime/contracts/router"

/**
 * Atai Runtime — provider adapter contract (server-only).
 *
 * The ONLY interface by which provider code joins the runtime (Phase 5 §12):
 * adapters receive normalized provider-neutral input, execute one runtime
 * operation, and return normalized provider-neutral output. They must never
 * expose provider credentials to the router, and they must wrap raw provider
 * failures in ProviderExecutionError so provider internals never leak across
 * the boundary (Phase 5 §29).
 *
 * @module lib/runtime/router/adapter
 */

/**
 * Normalized failure thrown BY an adapter. Raw provider errors are captured
 * server-side (never serialized to clients) and mapped to the normalized
 * taxonomy.
 */
export class ProviderExecutionError extends Error {
  readonly category: ProviderFailureCategory
  /** Server-side detail — for logs only, never client responses. */
  readonly detail?: string
  /**
   * Undici/node network cause code (UND_ERR_CONNECT_TIMEOUT, ENOTFOUND, …)
   * when this error came from a raw network fault. Kept server-side only —
   * lets callers distinguish never-delivered requests (safe to retry) from
   * post-connect failures (§45). Never serialized to clients.
   */
  networkCauseCode?: string

  constructor(category: ProviderFailureCategory, message: string, detail?: string) {
    super(message)
    this.name = "ProviderExecutionError"
    this.category = category
    this.detail = detail
  }
}

/**
 * The provider-neutral adapter interface. Phase 6 (OpenRouter) will be the
 * first production implementation; Phase 5 ships only the contract plus a
 * test-only echo adapter.
 */
export interface RuntimeProviderAdapter {
  /** Stable provider identifier (e.g. "openrouter", "firecrawl"). */
  readonly provider: string

  /** Does this adapter serve this capability + operation? */
  supports(capability: string, operation: string): boolean

  /**
   * Execute one runtime operation. Implementations must:
   *  - throw ProviderExecutionError (normalized) on failure,
   *  - return provider-neutral data (no raw provider wire formats),
   *  - never read credentials from the request (they come from adapter config/env).
   */
  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse>
}

/**
 * Map a normalized adapter failure to the runtime AppError taxonomy. Used by
 * the router's error boundary so provider internals never reach clients.
 */
export function providerFailureToRuntimeError(e: ProviderExecutionError): AppErrorShape {
  switch (e.category) {
    case "provider_unavailable":
      return runtimeError("runtime_capability_unavailable")
    case "provider_timeout":
      return runtimeError("runtime_provider_timeout")
    case "provider_rate_limited":
      return runtimeError("runtime_provider_rate_limited")
    case "provider_not_entitled":
      return runtimeError("runtime_provider_not_entitled")
    case "model_unavailable":
      return runtimeError("runtime_model_unavailable", e.message)
    case "unsupported_operation":
      // Adapter-authored messages for this category are neutral, actionable
      // literals ("choose an image-capable model"), so they are forwarded —
      // a caller-side failure the developer can actually fix. Provider wording
      // lives in `detail`, which never leaves the server.
      return runtimeError("runtime_invalid_request", e.message)
    case "provider_error":
    default:
      return runtimeError("runtime_provider_error")
  }
}

/** Structural type to avoid importing AppError here (keeps the module pure). */
interface AppErrorShape {
  code: string
  status: number
  message: string
}
