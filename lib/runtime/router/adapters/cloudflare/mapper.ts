import "server-only"
import { z } from "zod"
import type { ProviderExecutionRequest, ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { namespaceForProject } from "./config"

/**
 * Atai Runtime — Cloudflare Vectorize request/response mapper (server-only).
 *
 * Owns the translations for the `vectors` capability (upsert/search/delete,
 * Phase 10 §18). Strict schemas reject unknown fields; vector ids/values and
 * metadata are validated BEFORE any provider contact. The namespace is
 * injected here from the TRUSTED auth context — request content can never
 * influence which project partition is addressed (§18/§34).
 *
 * @module lib/runtime/router/adapters/cloudflare/mapper
 */

/** Provider caps enforced at the contract layer (§43 — bounded resources). */
export const MAX_VECTORS_PER_UPSERT = 100
export const MAX_VECTOR_DIMENSIONS = 1536
export const MAX_VECTOR_ID_LENGTH = 64
export const MAX_TOP_K = 100
export const MAX_METADATA_KEYS = 32

const finiteNumber = z
  .number()
  .refine((n) => Number.isFinite(n), "vector values must be finite numbers")

/** One vector in provider-neutral form. */
export const VectorInputSchema = z.object({
  id: z.string().min(1).max(MAX_VECTOR_ID_LENGTH),
  values: z.array(finiteNumber).min(1).max(MAX_VECTOR_DIMENSIONS),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

// ── upsert (vectors/upsert) ────────────────────────────────────────────────

export const VectorUpsertInputSchema = z
  .object({
    vectors: z.array(VectorInputSchema).min(1).max(MAX_VECTORS_PER_UPSERT),
  })
  .strict()

export type VectorUpsertInput = z.infer<typeof VectorUpsertInputSchema>

export interface TranslatedUpsertRequest {
  body: {
    vectors: Array<{
      id: string
      values: number[]
      namespace: string
      metadata?: Record<string, string | number | boolean>
    }>
  }
}

export function toCloudflareUpsert(input: unknown, request: ProviderExecutionRequest): TranslatedUpsertRequest {
  const parsed = VectorUpsertInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`upsert input validation failed: ${firstIssue(parsed)}`)
  }
  const namespace = namespaceForProject(request.auth.projectId, request.auth.environment)
  return {
    body: {
      vectors: parsed.data.vectors.map((v) => ({
        id: v.id,
        values: v.values,
        namespace,
        ...(v.metadata !== undefined ? { metadata: v.metadata } : {}),
      })),
    },
  }
}

/** Documented Cloudflare v4 upsert response (subset the contract consumes). */
export interface CloudflareVectorMutationResponse {
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
  result?: { mutationId?: string; count?: number; ids?: string[] }
}

export interface VectorUpsertResultData {
  /** Async mutation id — Vectorize mutations settle asynchronously. */
  mutationId?: string
  count?: number
}

export function toUpsertResult(
  response: CloudflareVectorMutationResponse,
): ProviderExecutionResponse<VectorUpsertResultData> {
  assertCloudflareSuccess(response)
  const result = response.result
  return {
    provider: "cloudflare",
    data: {
      ...(typeof result?.mutationId === "string" ? { mutationId: result.mutationId } : {}),
      ...(typeof result?.count === "number" ? { count: result.count } : {}),
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      ...(typeof result?.count === "number" ? { metadata: { vectorCount: result.count } } : {}),
    },
  }
}

// ── search (vectors/search) ────────────────────────────────────────────────

export const VectorSearchInputSchema = z
  .object({
    vector: z.array(finiteNumber).min(1).max(MAX_VECTOR_DIMENSIONS),
    topK: z.number().int().min(1).max(MAX_TOP_K).optional(),
    /** "none" (default) | "indexed" | "all" — all caps topK at 50 per provider docs. */
    returnMetadata: z.enum(["none", "indexed", "all"]).optional(),
    returnValues: z.boolean().optional(),
  })
  .strict()

export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>

export interface TranslatedSearchRequest {
  body: {
    vector: number[]
    topK: number
    namespace: string
    returnMetadata?: "none" | "indexed" | "all"
    returnValues?: boolean
  }
}

export function toCloudflareSearch(input: unknown, request: ProviderExecutionRequest): TranslatedSearchRequest {
  const parsed = VectorSearchInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`search input validation failed: ${firstIssue(parsed)}`)
  }
  const returnMetadata = parsed.data.returnMetadata ?? "none"
  let topK = parsed.data.topK ?? 5
  // Provider contract: returnValues/returnMetadata:"all" cap topK at 50.
  if ((parsed.data.returnValues || returnMetadata === "all") && topK > 50) topK = 50
  return {
    body: {
      vector: parsed.data.vector,
      topK,
      namespace: namespaceForProject(request.auth.projectId, request.auth.environment),
      ...(returnMetadata !== "none" ? { returnMetadata } : {}),
      ...(parsed.data.returnValues !== undefined ? { returnValues: parsed.data.returnValues } : {}),
    },
  }
}

export interface VectorMatch {
  id: string
  score: number
  metadata?: Record<string, unknown>
  values?: number[]
}

export interface VectorSearchResultData {
  matches: VectorMatch[]
  count: number
}

export interface CloudflareQueryResponse {
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
  result?: { count?: number; matches?: Array<{ id?: string; score?: number; metadata?: unknown; values?: number[]; namespace?: string }> }
}

export function toSearchResult(response: CloudflareQueryResponse): ProviderExecutionResponse<VectorSearchResultData> {
  assertCloudflareSuccess(response)
  const matches = response.result?.matches
  if (!Array.isArray(matches)) {
    throw new ProviderExecutionError(
      "provider_error",
      "The vector provider returned an invalid response.",
      "missing result.matches array",
    )
  }
  const normalized: VectorMatch[] = []
  for (const m of matches) {
    if (typeof m?.id !== "string" || typeof m?.score !== "number") continue
    normalized.push({
      id: m.id,
      score: m.score,
      ...(m.metadata !== undefined && m.metadata !== null && typeof m.metadata === "object"
        ? { metadata: m.metadata as Record<string, unknown> }
        : {}),
      ...(Array.isArray(m.values) ? { values: m.values } : {}),
    })
  }
  return {
    provider: "cloudflare",
    data: { matches: normalized, count: typeof response.result?.count === "number" ? response.result.count : normalized.length },
    usage: { inputTokens: 0, outputTokens: 0, metadata: { matchCount: normalized.length } },
  }
}

// ── delete (vectors/delete) ────────────────────────────────────────────────

export const VectorDeleteInputSchema = z
  .object({
    ids: z.array(z.string().min(1).max(MAX_VECTOR_ID_LENGTH)).min(1).max(MAX_VECTORS_PER_UPSERT),
  })
  .strict()

export type VectorDeleteInput = z.infer<typeof VectorDeleteInputSchema>

export interface TranslatedDeleteRequest {
  body: { ids: string[]; namespace: string }
}

export function toCloudflareDelete(input: unknown, request: ProviderExecutionRequest): TranslatedDeleteRequest {
  const parsed = VectorDeleteInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`delete input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    body: {
      ids: parsed.data.ids,
      namespace: namespaceForProject(request.auth.projectId, request.auth.environment),
    },
  }
}

export interface VectorDeleteResultData {
  mutationId?: string
}

export function toDeleteResult(
  response: CloudflareVectorMutationResponse,
): ProviderExecutionResponse<VectorDeleteResultData> {
  assertCloudflareSuccess(response)
  return {
    provider: "cloudflare",
    data: {
      ...(typeof response.result?.mutationId === "string" ? { mutationId: response.result.mutationId } : {}),
    },
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

// ── Shared ──────────────────────────────────────────────────────────────────

/**
 * Cloudflare wraps failures in success:false + errors[] even on HTTP 200 —
 * check the envelope, not just the status (mirrors the OpenRouter 200-with-
 * error contract).
 */
export function assertCloudflareSuccess(response: { success?: boolean; errors?: Array<{ code?: number; message?: string }> }): void {
  if (response.success === false) {
    const first = response.errors?.[0]
    throw new ProviderExecutionError(
      "provider_error",
      "The vector provider returned an error.",
      `cloudflare error ${first?.code ?? "unknown"}: ${String(first?.message ?? "").slice(0, 200)}`,
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
