import { NextResponse } from "next/server"
import { TotalumError } from "@/lib/integrations/totalum/errors"
import { ProviderNotConfiguredError } from "@/lib/integrations/firecrawl/client"
import { logger } from "@/lib/logging/logger"

/** Consistent JSON error envelope. Technical details stay server-side; the
 * client receives a friendly message and a stable code (spec section 28). */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

export function handleRouteError(stage: string, error: unknown) {
  if (error instanceof TotalumError) {
    const status = error.code === "PROVIDER_NOT_CONFIGURED" ? 503 : error.status ?? 400
    return fail(error.code, error.friendlyMessage, status)
  }
  if (error instanceof ProviderNotConfiguredError) {
    return fail("PROVIDER_NOT_CONFIGURED", "The website analyzer isn't connected yet. Add your Firecrawl API key to enable it.", 503)
  }
  logger.error(stage, "unhandled route error", { message: (error as Error).message })
  return fail("UNKNOWN", "Something went wrong. Please try again.", 500)
}
