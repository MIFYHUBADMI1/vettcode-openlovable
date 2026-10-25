import { requireAdmin } from "@/lib/auth/session"
import { ok, failWithRequestId, handleRouteError } from "@/lib/api/respond"
import { cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { AppError } from "@/lib/errors"
import { isConsoleMethod, executeCalComConsoleCall, type CalComConsoleRequest } from "@/lib/runtime/router/adapters/calcom/console"

/**
 * OWNER-ONLY Cal.com console — admin session required, project API keys never
 * reach this route. The tenant-facing runtime contract stays closed
 * (calendar = listBookings/createBooking); this console exists so the
 * platform's own Cal.com integration can be exercised, logged and debugged
 * against the live v2 API. The platform credential is attached server-side
 * and is never accepted from, echoed to, or logged for the caller.
 */
export async function POST(req: Request) {
  const requestId = cryptoId()
  try {
    const admin = await requireAdmin()

    const payload = (await req.json().catch(() => null)) as
      | { method?: unknown; path?: unknown; body?: unknown; apiVersion?: unknown }
      | null

    if (!payload || typeof payload.path !== "string") {
      throw new AppError("VALIDATION", "A console call needs a method and a relative /v2 path.")
    }
    if (!isConsoleMethod(payload.method)) {
      throw new AppError("VALIDATION", "Unsupported HTTP method for the Cal.com console.")
    }
    if (payload.apiVersion !== undefined && typeof payload.apiVersion !== "string") {
      throw new AppError("VALIDATION", "apiVersion must be a string when provided.")
    }

    const call: CalComConsoleRequest = {
      method: payload.method,
      path: payload.path,
      ...(payload.body !== undefined ? { body: payload.body } : {}),
      ...(typeof payload.apiVersion === "string" && payload.apiVersion.trim()
        ? { apiVersion: payload.apiVersion.trim() }
        : {}),
    }

    const result = await executeCalComConsoleCall(call, { requestId, actor: admin.id })
    return ok({ requestId, ...result }, { headers: { "x-request-id": requestId } })
  } catch (e) {
    if (e instanceof Error && (e.name === "ProviderNotConfiguredError" || e.message.includes("not configured"))) {
      logger.error("runtime.calcom.console", "console call skipped — provider not configured", { requestId })
      return failWithRequestId("PROVIDER_NOT_CONFIGURED", requestId, "The platform Cal.com credential (CALCOM_API_KEY) isn't set on this deployment.", 503)
    }
    return handleRouteError("runtime.calcom.console", e, new Headers({ "x-request-id": requestId }))
  }
}
