import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getTotalumBaseUrl, getTotalumTimeoutMs, totalumHeaders } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, providerStatusFailure } from "../shared/http"
import type { ProviderHttpResponse } from "../shared/http"

/**
 * Atai Runtime — Totalum HTTP client (server-only).
 *
 * The generated application's runtime database access, executed server-side
 * with the platform credential and scoped to the authenticated project's
 * Totalum project (resolved by project-binding.ts — never by request
 * content). Only the four contract-approved data endpoints are reachable —
 * never arbitrary Totalum API forwarding (§19/§53).
 *
 * Write operations are side effects (§45/§46): NO automatic retries.
 *
 * @module lib/runtime/router/adapters/totalum/client
 */

export async function executeTotalumQuery(params: {
  path: string
  body: unknown
  requestId?: string
}): Promise<ProviderHttpResponse> {
  return callTotalum({ ...params, method: "POST" as const, label: "query" })
}

export async function executeTotalumCreate(params: {
  path: string
  body: unknown
  requestId?: string
}): Promise<ProviderHttpResponse> {
  return callTotalum({ ...params, method: "POST" as const, label: "create" })
}

export async function executeTotalumEdit(params: {
  path: string
  body: unknown
  requestId?: string
}): Promise<ProviderHttpResponse> {
  return callTotalum({ ...params, method: "PATCH" as const, label: "edit" })
}

export async function executeTotalumDelete(params: {
  path: string
  requestId?: string
}): Promise<ProviderHttpResponse> {
  return callTotalum({ ...params, method: "DELETE" as const, label: "delete" })
}

async function callTotalum(params: {
  path: string
  body?: unknown
  method: "POST" | "PATCH" | "DELETE"
  label: string
  requestId?: string
}): Promise<ProviderHttpResponse> {
  const startedAt = Date.now()
  const res = await providerFetch({
    url: `${getTotalumBaseUrl()}${params.path}`,
    method: params.method,
    headers: totalumHeaders(),
    ...(params.body !== undefined ? { body: JSON.stringify(params.body) } : {}),
    timeoutMs: getTotalumTimeoutMs(),
    requestId: params.requestId,
  })
  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.totalum", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      operation: params.label,
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The database provider returned an error.", res.text)
  }
  logger.info("runtime.totalum", "database operation complete", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    operation: params.label,
    status: res.status,
    latencyMs,
  })
  return res
}
