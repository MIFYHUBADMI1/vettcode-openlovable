import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { executeDeleteVectors, executeQueryVectors, executeUpsertVectors } from "./client"
import {
  toCloudflareDelete,
  toCloudflareSearch,
  toCloudflareUpsert,
  toDeleteResult,
  toSearchResult,
  toUpsertResult,
  type VectorDeleteResultData,
  type VectorSearchResultData,
  type VectorUpsertResultData,
} from "./mapper"

/**
 * Atai Runtime — Cloudflare Vectorize provider adapter (server-only).
 *
 * Serves the provider-neutral `vectors` capability (upsert/search/delete,
 * Phase 10 §18) through the EXISTING RuntimeProviderAdapter interface.
 * Project isolation: every operation is namespace-scoped to the
 * authenticated project + environment (namespaceForProject) — cross-project
 * vector access is structurally impossible. Index/account/credentials are
 * trusted server configuration (§9/§53).
 *
 * @module lib/runtime/router/adapters/cloudflare/adapter
 */

export const CLOUDFLARE_PROVIDER_ID = "cloudflare"

class CloudflareAdapter implements RuntimeProviderAdapter {
  readonly provider = CLOUDFLARE_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return (
      capability === "vectors" &&
      (operation === "upsert" || operation === "search" || operation === "delete")
    )
  }

  async execute(
    request: ProviderExecutionRequest,
  ): Promise<ProviderExecutionResponse<VectorUpsertResultData | VectorSearchResultData | VectorDeleteResultData>> {
    const { capability, operation } = request.request

    if (capability === "vectors" && operation === "upsert") {
      const translated = toCloudflareUpsert(request.request.input, request)
      const response = await executeUpsertVectors({ body: translated.body, requestId: request.requestId })
      const result = toUpsertResult(response)
      logger.info("runtime.cloudflare", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        vectorCount: (request.request.input as { vectors?: unknown[] } | undefined)?.vectors
          ? (request.request.input as { vectors: unknown[] }).vectors.length
          : undefined,
      })
      return result
    }

    if (capability === "vectors" && operation === "search") {
      const translated = toCloudflareSearch(request.request.input, request)
      const response = await executeQueryVectors({ body: translated.body, requestId: request.requestId })
      const result = toSearchResult(response)
      logger.info("runtime.cloudflare", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        matchCount: result.data.count,
      })
      return result
    }

    if (capability === "vectors" && operation === "delete") {
      const translated = toCloudflareDelete(request.request.input, request)
      const response = await executeDeleteVectors({ body: translated.body, requestId: request.requestId })
      const result = toDeleteResult(response)
      logger.info("runtime.cloudflare", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
      })
      return result
    }

    // Unreachable: supports() gates routing. Defensive normalized failure.
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The requested operation is not supported.",
    )
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const cloudflareAdapter = new CloudflareAdapter()
