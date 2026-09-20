import "server-only"
import { logger } from "@/lib/logging/logger"
import { getOpenRouterBaseUrl, openRouterHeaders } from "./config"
import {
  OPENROUTER_CHAT_COMPLETIONS_PATH,
  type OpenRouterChatRequest,
  type OpenRouterChatResponse,
  type OpenRouterErrorBody,
} from "./types"
import {
  categoryForNetworkError,
  categoryForStatus,
  openRouterFailure,
  ProviderNotConfiguredError,
} from "./errors"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — OpenRouter HTTP client (server-only).
 *
 * The ONLY place the adapter touches the network. Uses the repo's existing
 * pattern (native fetch + AbortController, mirroring the Firecrawl client)
 * — no new HTTP library (Phase 6 §14/§68). Endpoint comes exclusively from
 * trusted server configuration; callers can never redirect it (§96/§97).
 *
 * Response handling follows the official OpenRouter contract:
 *   - documented error statuses use { error: { code, message, metadata? } }
 *   - a 200 can STILL carry an error-only body (mid-generation failure, §103)
 *   - malformed JSON / malformed success payloads are normalized provider
 *     errors, never crashes and never raw passthrough (§31/§71/§103)
 *
 * @module lib/runtime/router/adapters/openrouter/client
 */

/** Bounded timeout — converted into a normalized provider timeout (§27). */
const DEFAULT_TIMEOUT_MS = 60_000

export function getOpenRouterTimeoutMs(): number {
  const raw = process.env.OPENROUTER_TIMEOUT_MS
  const parsed = raw ? Number(raw) : NaN
  // Guard against nonsense configuration; fall back to the bounded default.
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 300_000
    ? parsed
    : DEFAULT_TIMEOUT_MS
}

/** Structural guard for a normalized completion response (§31/§70). */
function isChatResponse(value: unknown): value is OpenRouterChatResponse {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== "string" || typeof v.model !== "string") return false
  if (!Array.isArray(v.choices)) return false
  // Message/content presence is checked by the mapper — an empty choices
  // array or a null content is treated as a failed generation there.
  return true
}

/**
 * Already-normalized adapter failures must pass through the network boundary
 * UNCHANGED. Detection is name-based in addition to instanceof so the check
 * stays correct regardless of module-instance duplication in the bundler —
 * the router boundary (Phase 5) relies on receiving the ORIGINAL category.
 */
function isAlreadyNormalized(e: unknown): boolean {
  if (e instanceof ProviderExecutionError) return true
  if (e instanceof ProviderNotConfiguredError) return true
  if (e instanceof Error && e.name === "ProviderExecutionError") return true
  return e instanceof Error && e.name === "ProviderNotConfiguredError"
}

/**
 * Execute one OpenRouter chat completion. Rejects ONLY with
 * ProviderExecutionError — raw provider internals never escape (§34/§36).
 */
export async function executeChatCompletion(
  request: OpenRouterChatRequest,
): Promise<{ response: OpenRouterChatResponse; latencyMs: number; httpStatus: number }> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), getOpenRouterTimeoutMs())

  try {
    const res = await fetch(`${getOpenRouterBaseUrl()}${OPENROUTER_CHAT_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(request),
      signal: controller.signal,
      redirect: "error", // never follow redirects to arbitrary hosts (§98)
    })
    const latencyMs = Date.now() - startedAt

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      logger.error("runtime.openrouter", "provider returned an error status", {
        httpStatus: res.status,
        latencyMs,
        // Server-side detail only: first slice of the provider body. The
        // credential is in the request headers, which are never logged.
        detail: detail.slice(0, 300),
      })
      throw openRouterFailure(
        categoryForStatus(res.status),
        "OpenRouter request failed",
        detail.slice(0, 300) || undefined,
      )
    }

    // 200 — but OpenRouter may still report a mid-generation error in the
    // body (error-only JSON, no choices). Check before trusting the shape.
    let payload: unknown
    try {
      payload = await res.json()
    } catch {
      throw openRouterFailure(
        "provider_error",
        "The AI provider returned an invalid response.",
        "malformed JSON in 200 response",
      )
    }

    const body = payload as OpenRouterErrorBody
    if (body && typeof body === "object" && body.error && !Array.isArray(body) ) {
      logger.error("runtime.openrouter", "provider reported an error inside a 200 body", {
        httpStatus: res.status,
        latencyMs,
        detail: String(body.error.message ?? "").slice(0, 300),
      })
      throw openRouterFailure(
        categoryForStatus(Number(body.error.code ?? 500)),
        "OpenRouter request failed",
        String(body.error.message ?? "").slice(0, 300),
      )
    }

    if (!isChatResponse(payload)) {
      throw openRouterFailure(
        "provider_error",
        "The AI provider returned an invalid response.",
        "response did not match the documented completion shape",
      )
    }

    return { response: payload, latencyMs, httpStatus: res.status }
  } catch (e) {
    if (isAlreadyNormalized(e)) throw e
    // Missing server credential → the provider configuration problem (§99),
    // rethrown untouched so it is NEVER mistaken for a customer auth failure.
    // Network fault / abort → normalized timeout or unavailable (§102).
    logger.error("runtime.openrouter", "provider request failed at network level", {
      latencyMs: Date.now() - startedAt,
      errorName: e instanceof Error ? e.name : "unknown",
    })
    throw openRouterFailure(
      categoryForNetworkError(e),
      categoryForNetworkError(e) === "provider_timeout"
        ? "The AI provider timed out."
        : "The AI provider is temporarily unavailable.",
    )
  } finally {
    clearTimeout(timer)
  }
}
