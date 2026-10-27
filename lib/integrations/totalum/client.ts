import "server-only"
import { logger } from "@/lib/logging/logger"
import { describeErrorChain, isProviderUnreachableError, isTlsClockError } from "@/lib/api/upstream-error"
import { TotalumError, mapTotalumError } from "./errors"

/** Server-side Totalum VCaaS HTTP client. The api-key is read from the server
 * environment and is NEVER exposed to the browser. All Totalum access flows
 * through this module (spec sections 8, 26 & 39). */
const TOTALUM_BASE = "https://api-accounts.totalum.app"
const API_PREFIX = "/api/v1/vcaas"

function getTotalumApiKey() {
  // TOTALUM_API_KEY is the project variable; keep the legacy VCaaS name as a fallback.
  return process.env.TOTALUM_API_KEY ?? process.env.TOTALUM_VCAAS_API_KEY
}

export function isTotalumConfigured() {
  return Boolean(getTotalumApiKey())
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export async function totalumFetch<T>(
  method: Method,
  path: string,
  body?: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const key = getTotalumApiKey()
  if (!key) throw new TotalumError("PROVIDER_NOT_CONFIGURED")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${TOTALUM_BASE}${API_PREFIX}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "api-key": key,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) {
      logger.error("totalum.http", "request failed", { path, method, status: res.status, detail: text.slice(0, 300) })
      throw mapTotalumError(res.status, text)
    }
    logger.info("totalum.http", "ok", { path, method, status: res.status })
    if (!text) return {} as T
    const json = JSON.parse(text)
    // Totalum wraps all responses in { errors, data }. Unwrap automatically
    // so callers get the inner payload directly.
    if (json && typeof json === "object" && "data" in json && json.data !== undefined) {
      return json.data as T
    }
    return json as T
  } catch (e) {
    if (e instanceof TotalumError) throw e
    if ((e as Error).name === "AbortError") throw new TotalumError("SERVER_NOT_READY", "timeout")
    // Below here nothing reached (or was answered by) Totalum: undici raises a
    // bare `TypeError: fetch failed` with the real reason on `cause`. Flattening
    // those into UNKNOWN turned a dead socket or a wrong system clock into a 400
    // that read like the founder's plan was at fault.
    const detail = describeErrorChain(e).join(" | ")
    if (isTlsClockError(e)) {
      logger.error("totalum.http", "certificate rejected — check the system clock", { path, detail })
      throw new TotalumError("TLS_CLOCK", detail)
    }
    if (isProviderUnreachableError(e)) {
      logger.error("totalum.http", "provider unreachable", { path, detail })
      throw new TotalumError("PROVIDER_UNREACHABLE", detail)
    }
    logger.error("totalum.http", "unexpected error", { path, detail })
    throw new TotalumError("UNKNOWN", detail)
  } finally {
    clearTimeout(timer)
  }
}
