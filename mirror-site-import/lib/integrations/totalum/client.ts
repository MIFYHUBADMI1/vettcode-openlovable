import "server-only"
import { logger } from "@/lib/logging/logger"
import { TotalumError, mapTotalumError } from "./errors"

/** Server-side Totalum VCaaS HTTP client. The api-key is read from the server
 * environment and is NEVER exposed to the browser. All Totalum access flows
 * through this module (spec sections 8, 26 & 39). */
const TOTALUM_BASE = "https://api-accounts.totalum.app"
const API_PREFIX = "/api/v1/vcaas"

export function isTotalumConfigured() {
  return Boolean(process.env.TOTALUM_VCAAS_API_KEY)
}

type Method = "GET" | "POST" | "PATCH" | "DELETE"

export async function totalumFetch<T>(
  method: Method,
  path: string,
  body?: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const key = process.env.TOTALUM_VCAAS_API_KEY
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
      logger.error("totalum.http", "request failed", { path, method, status: res.status })
      throw mapTotalumError(res.status, text)
    }
    logger.info("totalum.http", "ok", { path, method, status: res.status })
    return (text ? JSON.parse(text) : {}) as T
  } catch (e) {
    if (e instanceof TotalumError) throw e
    if ((e as Error).name === "AbortError") throw new TotalumError("SERVER_NOT_READY", "timeout")
    logger.error("totalum.http", "unexpected error", { path, message: (e as Error).message })
    throw new TotalumError("UNKNOWN", (e as Error).message)
  } finally {
    clearTimeout(timer)
  }
}
