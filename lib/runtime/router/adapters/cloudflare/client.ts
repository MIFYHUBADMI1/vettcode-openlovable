import "server-only"
import { logger } from "@/lib/logging/logger"
import {
  cloudflareHeaders,
  getCloudflareAccountId,
  getCloudflareBaseUrl,
  getCloudflareTimeoutMs,
  getCloudflareVectorizeIndex,
} from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { ProviderHttpResponse } from "../shared/http"
import type {
  CloudflareQueryResponse,
  CloudflareVectorMutationResponse,
} from "./mapper"

/**
 * Atai Runtime — Cloudflare Vectorize HTTP client (server-only).
 *
 * Only the three contract-approved Vectorize v2 endpoints are reachable —
 * never arbitrary Cloudflare API forwarding (§18/§53). The index name and
 * account id come from trusted server configuration; the namespace is
 * injected by the mapper from the trusted auth context.
 *
 * @module lib/runtime/router/adapters/cloudflare/client
 */

interface VectorizeCallParams {
  endpoint: "upsert" | "query" | "delete_by_ids"
  body: unknown
  requestId?: string
}

async function callVectorize(params: VectorizeCallParams): Promise<ProviderHttpResponse> {
  const startedAt = Date.now()
  const account = encodeURIComponent(getCloudflareAccountId())
  const index = encodeURIComponent(getCloudflareVectorizeIndex())
  const url = `${getCloudflareBaseUrl()}/accounts/${account}/vectorize/v2/indexes/${index}/${params.endpoint}`

  const res = await providerFetch({
    url,
    method: "POST",
    headers: cloudflareHeaders(),
    body: JSON.stringify(params.body),
    timeoutMs: getCloudflareTimeoutMs(),
    requestId: params.requestId,
  })
  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.cloudflare", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      endpoint: params.endpoint,
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The vector provider returned an error.", res.text)
  }
  logger.info("runtime.cloudflare", "vectorize call complete", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    endpoint: params.endpoint,
    status: res.status,
    latencyMs,
  })
  return res
}

export async function executeUpsertVectors(params: {
  body: unknown
  requestId?: string
}): Promise<CloudflareVectorMutationResponse> {
  return parseJsonBody<CloudflareVectorMutationResponse>(
    await callVectorize({ endpoint: "upsert", body: params.body, requestId: params.requestId }),
  )
}

export async function executeQueryVectors(params: {
  body: unknown
  requestId?: string
}): Promise<CloudflareQueryResponse> {
  return parseJsonBody<CloudflareQueryResponse>(
    await callVectorize({ endpoint: "query", body: params.body, requestId: params.requestId }),
  )
}

export async function executeDeleteVectors(params: {
  body: unknown
  requestId?: string
}): Promise<CloudflareVectorMutationResponse> {
  return parseJsonBody<CloudflareVectorMutationResponse>(
    await callVectorize({ endpoint: "delete_by_ids", body: params.body, requestId: params.requestId }),
  )
}
