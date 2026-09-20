import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { executeTotalumQuery, executeTotalumCreate, executeTotalumEdit, executeTotalumDelete } from "./client"
import {
  toTotalumQuery,
  toTotalumCreate,
  toTotalumEdit,
  toTotalumDelete,
  toQueryResult,
  toRecordResult,
  toDeleteResult,
  type DbQueryResultData,
  type DbRecordResultData,
  type DbDeleteResultData,
} from "./mapper"
import { resolveTotalumProjectId } from "./project-binding"

/**
 * Atai Runtime — Totalum provider adapter (server-only).
 *
 * Serves the provider-neutral `db` capability (query/create/edit/delete,
 * Phase 10 §19) through the EXISTING RuntimeProviderAdapter interface.
 * PROJECT ISOLATION: every operation is scoped to the authenticated project's
 * Totalum project (resolved by project-binding.ts — never by request content).
 * Platform credentials remain server-side (§9/§53).
 *
 * @module lib/runtime/router/adapters/totalum/adapter
 */

export const TOTALUM_PROVIDER_ID = "totalum"

class TotalumAdapter implements RuntimeProviderAdapter {
  readonly provider = TOTALUM_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return (
      capability === "db" &&
      (operation === "query" || operation === "create" || operation === "edit" || operation === "delete")
    )
  }

  async execute(
    request: ProviderExecutionRequest,
  ): Promise<ProviderExecutionResponse<DbQueryResultData | DbRecordResultData | DbDeleteResultData>> {
    const { capability, operation } = request.request

    // Resolve project binding (server-side only — never from request content).
    const totalumProjectId = await resolveTotalumProjectId(request.auth.projectId)

    if (capability === "db" && operation === "query") {
      const translated = toTotalumQuery(request.request.input)
      const response = await executeTotalumQuery({
        path: `/projects/${encodeURIComponent(totalumProjectId)}/database/query`,
        body: translated.body,
        requestId: request.requestId,
      })
      const result = toQueryResult(JSON.parse(response.text))
      logger.info("runtime.totalum", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        recordCount: result.data.records.length,
        latencyMs: Date.now(),
      })
      return result
    }

    if (capability === "db" && operation === "create") {
      const translated = toTotalumCreate(request.request.input, totalumProjectId)
      const response = await executeTotalumCreate({
        path: translated.path,
        body: translated.body,
        requestId: request.requestId,
      })
      const result = toRecordResult(JSON.parse(response.text))
      logger.info("runtime.totalum", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        recordId: result.data.id,
        latencyMs: Date.now(),
      })
      return result
    }

    if (capability === "db" && operation === "edit") {
      const translated = toTotalumEdit(request.request.input, totalumProjectId)
      const response = await executeTotalumEdit({
        path: translated.path,
        body: translated.body,
        requestId: request.requestId,
      })
      const result = toRecordResult(JSON.parse(response.text))
      logger.info("runtime.totalum", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        recordId: result.data.id,
        latencyMs: Date.now(),
      })
      return result
    }

    if (capability === "db" && operation === "delete") {
      const translated = toTotalumDelete(request.request.input, totalumProjectId)
      const response = await executeTotalumDelete({
        path: translated.path,
        requestId: request.requestId,
      })
      const result = toDeleteResult(JSON.parse(response.text))
      logger.info("runtime.totalum", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        latencyMs: Date.now(),
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
export const totalumAdapter = new TotalumAdapter()
