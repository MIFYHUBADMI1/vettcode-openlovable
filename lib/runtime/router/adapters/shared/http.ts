import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { categoryForNetworkError, isAlreadyNormalized } from "./errors"

/**
 * Atai Runtime — shared provider HTTP primitives (server-only).
 *
 * The ONE bounded-timeout fetch used by every Phase 10 adapter (Phase 10
 * §44: no external provider call may wait forever; §78: native fetch, no new
 * HTTP dependency). Adapters keep their own status→category mapping and own
 * their endpoints; this module only guarantees:
 *
 *   - every call has a bounded AbortController timeout (normalizes to
 *     provider_timeout / provider_unavailable),
 *   - redirects are NEVER followed (a provider redirect must never send the
 *     Atai credential to an arbitrary host — mirrors OpenRouter §98),
 *   - raw network internals never escape (ProviderExecutionError only),
 *   - responses are size-capped before parsing (§43 resource limits).
 *
 * @module lib/runtime/router/adapters/shared/http
 */

/** Maximum provider response read into memory per request. */
export const MAX_PROVIDER_RESPONSE_BYTES = 8 * 1024 * 1024

/** One raw provider response: status plus the (capped) body as text. */
export interface ProviderHttpResponse {
  status: number
  ok: boolean
  /** Body text, truncated to MAX_PROVIDER_RESPONSE_BYTES. */
  text: string
  /** Populated only when the caller asks for binary bodies. */
  bytes?: ArrayBuffer
}

export interface ProviderFetchOptions {
  url: string
  /** GET/POST cover reads and side effects; PATCH/DELETE exist for
   * providers whose edit/remove operations are HTTP-method-shaped
   * (e.g. the Totalum VCaaS data endpoints). */
  method: "GET" | "POST" | "PATCH" | "DELETE"
  headers: Record<string, string>
  /** Pre-serialized body (JSON string or form-encoded). */
  body?: string
  /** Bounded timeout in milliseconds — REQUIRED, no unbounded calls. */
  timeoutMs: number
  /** Read and return the raw bytes of a 2xx response (voice/binary APIs). */
  binary?: boolean
  /** Correlation for logs (requestId). */
  requestId?: string
}

/**
 * Resolve a configured timeout against its bounds: 1s..300s, else fallback.
 * Mirrors the OpenRouter guard — nonsense configuration never disables the
 * timeout (§44).
 */
export function boundedTimeoutMs(raw: string | undefined, fallbackMs: number): number {
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 300_000 ? parsed : fallbackMs
}

/**
 * Execute one provider HTTP call. Resolves with the raw response (status +
 * capped body); adapters decide what each status means. Rejects ONLY with
 * ProviderExecutionError — raw network internals never escape.
 */
export async function providerFetch(opts: ProviderFetchOptions): Promise<ProviderHttpResponse> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)

  try {
    const res = await fetch(opts.url, {
      method: opts.method === "GET" ? "GET" : opts.method,
      headers: opts.headers,
      ...(opts.body !== undefined ? { body: opts.body } : {}),
      signal: controller.signal,
      redirect: "error", // never follow redirects to arbitrary hosts
    })

    // Non-2xx (or text/error paths): read as text — provider error bodies are
    // never trusted as JSON and are capped server-side.
    if (opts.binary && res.ok && res.status >= 200 && res.status < 300) {
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
        throw new ProviderExecutionError(
          "provider_error",
          "The provider returned a response that is too large.",
          `binary response exceeded ${MAX_PROVIDER_RESPONSE_BYTES} bytes`,
        )
      }
      return { status: res.status, ok: res.ok, text: "", bytes: buffer }
    }

    const text = (await res.text().catch(() => "")).slice(0, MAX_PROVIDER_RESPONSE_BYTES)
    return { status: res.status, ok: res.ok, text }
  } catch (e) {
    if (isAlreadyNormalized(e)) throw e
    const category = categoryForNetworkError(e)
    logger.info("runtime.adapter.http", "provider request failed at network level", {
      ...(opts.requestId ? { requestId: opts.requestId } : {}),
      latencyMs: Date.now() - startedAt,
      category,
      errorName: e instanceof Error ? e.name : "unknown",
    })
    throw new ProviderExecutionError(
      category,
      category === "provider_timeout"
        ? "The provider timed out."
        : "The provider is temporarily unavailable.",
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Parse a 2xx JSON body. Malformed JSON on a 2xx response is a normalized
 * provider_error — never a crash, never raw passthrough (§39/§71).
 */
export function parseJsonBody<T>(res: ProviderHttpResponse): T {
  try {
    return JSON.parse(res.text) as T
  } catch {
    throw new ProviderExecutionError(
      "provider_error",
      "The provider returned an invalid response.",
      "malformed JSON in 2xx response",
    )
  }
}

/** Build a bounded ProviderExecutionError for a non-2xx provider response. */
export function providerStatusFailure(
  category: ProviderExecutionError["category"],
  message: string,
  bodyText: string,
): ProviderExecutionError {
  return new ProviderExecutionError(category, message, bodyText ? bodyText.slice(0, 300) : undefined)
}
