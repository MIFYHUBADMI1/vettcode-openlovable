import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Totalum request/response mapper (server-only).
 *
 * Owns the translations for the generated application's runtime `db`
 * capability (query/create/edit/delete, Phase 10 §19). Strict schemas; the
 * table/record identifiers are validated against a safe charset BEFORE any
 * provider contact (they become URL path/query segments — §41). Record data
 * is the generated app's own JSON payload (bounded).
 *
 * @module lib/runtime/router/adapters/totalum/mapper
 */

/** Safe identifier charset for table/record ids (never URL-unsafe). */
const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/

/** Payload caps (§43 — bounded resources). */
export const MAX_RECORD_JSON_CHARS = 100_000
export const MAX_QUERY_LIMIT = 100

const recordData = z
  .record(z.string(), z.unknown())
  .refine((d) => JSON.stringify(d).length <= MAX_RECORD_JSON_CHARS, "record payload is too large")

// ── query (db/query) ───────────────────────────────────────────────────────

export const DbQueryInputSchema = z
  .object({
    tableName: z.string().regex(IDENTIFIER, "tableName must be a safe identifier"),
    filter: z.record(z.string(), z.unknown()).optional(),
    limit: z.number().int().min(1).max(MAX_QUERY_LIMIT).optional(),
    skip: z.number().int().min(0).max(10_000).optional(),
    /** Field names to sort by, ascending/descending. */
    sortBy: z.string().regex(IDENTIFIER).optional(),
    sortDirection: z.enum(["asc", "desc"]).optional(),
  })
  .strict()

export type DbQueryInput = z.infer<typeof DbQueryInputSchema>

export interface TranslatedQueryRequest {
  body: {
    tableName: string
    queryOptions?: Record<string, unknown>
  }
}

export function toTotalumQuery(input: unknown): TranslatedQueryRequest {
  const parsed = DbQueryInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`query input validation failed: ${firstIssue(parsed)}`)
  }
  const v = parsed.data
  const queryOptions: Record<string, unknown> = {
    ...(v.filter !== undefined ? { filter: v.filter } : {}),
    ...(v.limit !== undefined || v.skip !== undefined
      ? { pagination: { page: Math.floor((v.skip ?? 0) / (v.limit ?? MAX_QUERY_LIMIT)) + 1, pageSize: v.limit ?? MAX_QUERY_LIMIT } }
      : {}),
    ...(v.sortBy !== undefined ? { sort: { [v.sortBy]: v.sortDirection === "desc" ? -1 : 1 } } : {}),
  }
  return { body: { tableName: v.tableName, ...(Object.keys(queryOptions).length > 0 ? { queryOptions } : {}) } }
}

/** Documented Totalum query response (subset the contract consumes). */
export interface TotalumQueryResponse {
  data?: { items?: unknown[]; total?: number }
  errors?: unknown
}

export interface DbQueryResultData {
  records: unknown[]
  total?: number
}

export function toQueryResult(response: TotalumQueryResponse): ProviderExecutionResponse<DbQueryResultData> {
  assertTotalumOk(response)
  const items = response.data?.items
  if (!Array.isArray(items)) {
    throw new ProviderExecutionError(
      "provider_error",
      "The database provider returned an invalid response.",
      "missing data.items array",
    )
  }
  return {
    provider: "totalum",
    data: {
      records: items,
      ...(typeof response.data?.total === "number" ? { total: response.data.total } : {}),
    },
    usage: { inputTokens: 0, outputTokens: 0, metadata: { recordCount: items.length } },
  }
}

// ── create (db/create) ─────────────────────────────────────────────────────

export const DbCreateInputSchema = z
  .object({
    tableName: z.string().regex(IDENTIFIER, "tableName must be a safe identifier"),
    data: recordData,
  })
  .strict()

export type DbCreateInput = z.infer<typeof DbCreateInputSchema>

export interface TranslatedCreateRequest {
  path: string
  body: { tableName: string; data: Record<string, unknown> }
}

export function toTotalumCreate(input: unknown, totalumProjectId: string): TranslatedCreateRequest {
  const parsed = DbCreateInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`create input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    path: `/projects/${encodeURIComponent(totalumProjectId)}/database/records`,
    body: { tableName: parsed.data.tableName, data: parsed.data.data },
  }
}

/** Documented Totalum record response (subset the contract consumes). */
export interface TotalumRecordResponse {
  data?: Record<string, unknown>
  errors?: unknown
}

export interface DbRecordResultData {
  record: Record<string, unknown>
  id?: string
}

export function toRecordResult(
  response: TotalumRecordResponse,
): ProviderExecutionResponse<DbRecordResultData> {
  assertTotalumOk(response)
  const record = response.data
  if (typeof record !== "object" || record === null) {
    throw new ProviderExecutionError(
      "provider_error",
      "The database provider returned an invalid response.",
      "missing record object",
    )
  }
  const id = typeof record.id === "string" ? record.id : typeof record._id === "string" ? record._id : undefined
  return {
    provider: "totalum",
    data: { record, ...(id !== undefined ? { id } : {}) },
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

// ── edit (db/edit) ─────────────────────────────────────────────────────────

export const DbEditInputSchema = z
  .object({
    tableName: z.string().regex(IDENTIFIER, "tableName must be a safe identifier"),
    recordId: z.string().regex(IDENTIFIER, "recordId must be a safe identifier"),
    data: recordData,
  })
  .strict()

export type DbEditInput = z.infer<typeof DbEditInputSchema>

export interface TranslatedEditRequest {
  path: string
  body: { tableName: string; data: Record<string, unknown> }
}

export function toTotalumEdit(input: unknown, totalumProjectId: string): TranslatedEditRequest {
  const parsed = DbEditInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`edit input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    path: `/projects/${encodeURIComponent(totalumProjectId)}/database/records/${encodeURIComponent(parsed.data.recordId)}`,
    body: { tableName: parsed.data.tableName, data: parsed.data.data },
  }
}

// ── delete (db/delete) ─────────────────────────────────────────────────────

export const DbDeleteInputSchema = z
  .object({
    tableName: z.string().regex(IDENTIFIER, "tableName must be a safe identifier"),
    recordId: z.string().regex(IDENTIFIER, "recordId must be a safe identifier"),
  })
  .strict()

export type DbDeleteInput = z.infer<typeof DbDeleteInputSchema>

export interface TranslatedDeleteRequest {
  path: string
}

export function toTotalumDelete(input: unknown, totalumProjectId: string): TranslatedDeleteRequest {
  const parsed = DbDeleteInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`delete input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    path: `/projects/${encodeURIComponent(totalumProjectId)}/database/records/${encodeURIComponent(parsed.data.recordId)}?tableName=${encodeURIComponent(parsed.data.tableName)}`,
  }
}

export interface TotalumDeleteResponse {
  data?: { success?: boolean }
  errors?: unknown
}

export interface DbDeleteResultData {
  success: true
}

export function toDeleteResult(response: TotalumDeleteResponse): ProviderExecutionResponse<DbDeleteResultData> {
  assertTotalumOk(response)
  return { provider: "totalum", data: { success: true }, usage: { inputTokens: 0, outputTokens: 0 } }
}

// ── Shared ──────────────────────────────────────────────────────────────────

/** Totalum wraps failures in { errors: [...] } — check the envelope. */
export function assertTotalumOk(response: { errors?: unknown }): void {
  if (response.errors !== undefined && response.errors !== null) {
    const summary = Array.isArray(response.errors) && response.errors.length > 0
      ? String((response.errors[0] as { message?: string } | null)?.message ?? "").slice(0, 200)
      : "provider reported errors"
    throw new ProviderExecutionError(
      "provider_error",
      "The database provider returned an error.",
      summary,
    )
  }
}

function invalid(detail: string): ProviderExecutionError {
  return new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    detail,
  )
}

function firstIssue(parsed: { error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> } }): string {
  const issue = parsed.error.issues[0]
  return `${issue?.path.join(".") ?? "unknown"} ${issue?.message ?? ""}`.trim()
}
