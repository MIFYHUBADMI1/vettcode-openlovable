import "server-only"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import { calComHeaders, getCalComBaseUrl, getCalComTimeoutMs } from "./config"
import { providerFetch } from "../shared/http"

/**
 * Atai Runtime — OWNER-ONLY Cal.com console transport.
 *
 * This is the deliberate exception to the calcom adapter rule that only the
 * two contract-approved endpoints are reachable: the tenant-facing runtime
 * contract (`calendar` = listBookings/createBooking) stays closed, and this
 * module is reachable ONLY through the admin-gated console route
 * (/api/admin/calcom/console). It exercises the platform's own Cal.com
 * account for integration debugging; project API keys never route here.
 *
 * Guarantees carried over from the shared adapter primitives:
 *   - the credential is attached server-side via calComHeaders() and is never
 *     accepted from, echoed to, or logged for the caller;
 *   - bounded timeout, redirects never followed, response size capped;
 *   - relative /v2 paths only — no host, scheme, or credentials in the path.
 *
 * @module lib/runtime/router/adapters/calcom/console
 */

export type CalComConsoleMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT"

const ALLOWED_METHODS: readonly CalComConsoleMethod[] = ["GET", "POST", "PATCH", "DELETE", "PUT"]

/** Console responses are debug views — cap the payload we hand back. */
const MAX_CONSOLE_BODY_CHARS = 200_000

export interface CalComConsoleRequest {
  method: CalComConsoleMethod
  /** Relative Cal.com API path, e.g. "/v2/bookings?limit=10". */
  path: string
  /** JSON-serializable body for method-shaped calls. */
  body?: unknown
  /** Optional cal-api-version override; defaults to server configuration. */
  apiVersion?: string
}

export interface CalComConsoleResponse {
  status: number
  statusText: string
  ok: boolean
  latencyMs: number
  contentType: string | null
  /** Pretty-printed when the provider returned JSON. */
  bodyPretty: string
  /** True when the raw body was not valid JSON. */
  bodyIsJson: boolean
  truncated: boolean
}

export function isConsoleMethod(value: unknown): value is CalComConsoleMethod {
  return typeof value === "string" && (ALLOWED_METHODS as readonly string[]).includes(value)
}

/**
 * Validate a caller-supplied path. Anything that could redirect the platform
 * credential off api.cal.com (scheme, host, authority, embedded credentials,
 * absolute path) is rejected before a socket is opened.
 */
export function validateConsolePath(rawPath: string): string {
  const path = rawPath.trim()
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new AppError("VALIDATION", "The console path must be a relative /v2/... path.")
  }
  if (/[\s\\]/.test(path) || path.includes("://") || /\bBasic\b|\bBearer\b/i.test(path)) {
    throw new AppError("VALIDATION", "The console path contains disallowed content.")
  }
  let url: URL
  try {
    url = new URL(path, getCalComBaseUrl())
  } catch {
    throw new AppError("VALIDATION", "The console path is not a valid URL path.")
  }
  if (url.origin !== new URL(getCalComBaseUrl()).origin) {
    throw new AppError("VALIDATION", "The console path must stay on the configured Cal.com host.")
  }
  if (!url.pathname.startsWith("/v2/")) {
    throw new AppError("VALIDATION", "The console only serves Cal.com API v2 paths (/v2/...).")
  }
  return url.pathname + url.search
}

/** Execute one console call against Cal.com v2 with the platform credential. */
export async function executeCalComConsoleCall(
  request: CalComConsoleRequest,
  params: { requestId: string; actor: string },
): Promise<CalComConsoleResponse> {
  const path = validateConsolePath(request.path)
  const headers = calComHeaders()
  if (request.apiVersion) headers["cal-api-version"] = request.apiVersion

  const startedAt = Date.now()
  const res = await providerFetch({
    url: `${getCalComBaseUrl()}${path}`,
    method: request.method,
    headers,
    ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    timeoutMs: getCalComTimeoutMs(),
    requestId: params.requestId,
  })
  const latencyMs = Date.now() - startedAt

  const raw = res.text.slice(0, MAX_CONSOLE_BODY_CHARS)
  const truncated = res.text.length > MAX_CONSOLE_BODY_CHARS
  let bodyPretty = raw
  let bodyIsJson = false
  try {
    bodyPretty = JSON.stringify(JSON.parse(raw), null, 2)
    bodyIsJson = true
  } catch {
    /* non-JSON provider response — keep raw text for debugging */
  }

  logger.info("runtime.calcom.console", "console call complete", {
    requestId: params.requestId,
    actor: params.actor,
    method: request.method,
    path,
    status: res.status,
    latencyMs,
    truncated,
  })

  return {
    status: res.status,
    statusText: res.statusText ?? "",
    ok: res.ok,
    latencyMs,
    contentType: res.contentType ?? null,
    bodyPretty,
    bodyIsJson,
    truncated,
  }
}
