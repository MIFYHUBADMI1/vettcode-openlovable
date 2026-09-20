import { NextResponse } from "next/server"
import { TotalumError } from "@/lib/integrations/totalum/errors"
import { ProviderNotConfiguredError } from "@/lib/integrations/firecrawl/client"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

/** Consistent JSON error envelope. Technical details stay server-side; the
 * client receives a friendly message and a stable code (spec section 28). */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

/**
 * Response helpers for endpoints that carry a correlation ID: the ID is
 * emitted as `x-request-id` (success AND failure) so SDK clients can surface
 * it on errors for support/debugging correlation. Never log or expose
 * credential material here — the ID is a random correlation token only.
 */
export function okWithRequestId<T>(data: T, requestId: string, init?: ResponseInit) {
  return ok(data, { ...init, headers: withRequestId(init?.headers, requestId) })
}

export function failWithRequestId(code: string, requestId: string | undefined, message?: string, status = 400) {
  return fail(code, message, status, requestIdHeaders(requestId))
}

/** Headers carrying the correlation ID, or undefined when there is none. */
export function requestIdHeaders(requestId: string | undefined): Headers | undefined {
  if (!requestId) return undefined
  const headers = new Headers()
  headers.set("x-request-id", requestId)
  return headers
}

function withRequestId(base: HeadersInit | undefined, requestId: string): Headers {
  const headers = new Headers(base)
  headers.set("x-request-id", requestId)
  return headers
}

const DEFAULT_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Try signing in instead.",
  DATABASE_UNAVAILABLE: "The database is temporarily unavailable. Please try again shortly.",
  VALIDATION: "Please check the submitted information.",
}

export function fail(code: string, message?: string, status = 400, headers?: Headers) {
  return NextResponse.json({ ok: false, error: { code, message: message ?? DEFAULT_MESSAGES[code] ?? "Request failed." } }, { status, headers })
}

export function handleRouteError(stage: string, error: unknown, headers?: Headers) {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.status, headers)
  }
  if (error instanceof TotalumError) {
    // Map Totalum error codes to safe HTTP status codes — never leak raw provider statuses
    const statusMap: Partial<Record<string, number>> = {
      PROVIDER_NOT_CONFIGURED: 503,
      RATE_LIMIT_EXCEEDED: 429,
      INSUFFICIENT_CREDITS: 402,
      PROJECT_NOT_FOUND: 404,
      UNAUTHORIZED_PROJECT_ACCESS: 403,
      SERVER_NOT_READY: 503,
      AGENT_RUNNING: 409,
      DEPLOYMENT_RUNNING: 409,
    }
    const status = statusMap[error.code] ?? 400
    return fail(error.code, error.friendlyMessage, status)
  }
  if (error instanceof ProviderNotConfiguredError) {
    return fail("PROVIDER_NOT_CONFIGURED", "The website analyzer isn't connected yet. Add your Firecrawl API key to enable it.", 503)
  }
  if (error instanceof Error && /E11000|duplicate key/i.test(error.message)) {
    return fail("EMAIL_ALREADY_REGISTERED", undefined, 409)
  }
  if (error instanceof Error && /mongo|mongodb|database|topology|server selection|connection/i.test(error.message)) {
    logger.error(stage, "database operation failed", { message: error.message })
    return fail("DATABASE_UNAVAILABLE", undefined, 503)
  }
  logger.error(stage, "unhandled route error", { message: error instanceof Error ? error.message : String(error) })
  return fail("UNKNOWN", "Something went wrong. Please try again.", 500, headers)
}
