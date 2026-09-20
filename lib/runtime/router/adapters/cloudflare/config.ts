import "server-only"
import { createHash } from "node:crypto"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Cloudflare adapter configuration (server-only).
 *
 * ONE controlled access point for the Cloudflare Vectorize credentials
 * (Phase 10 §9/§49). The account id, API token, and index name are
 * trusted server configuration — the caller can never select an account or
 * an index (§18/§53: no client-controlled infrastructure identifiers).
 *
 * PROJECT ISOLATION (§18/§34/§35): every vector operation is scoped to a
 * namespace derived EXCLUSIVELY from the authenticated project + environment
 * (namespaceForProject). Cross-project vector access is structurally
 * impossible — the namespace is never read from the request.
 *
 * @module lib/runtime/router/adapters/cloudflare/config
 */

/** Official Cloudflare API root. Override only for tests (trusted server env). */
export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"

export const DEFAULT_CLOUDFLARE_TIMEOUT_MS = 30_000

/** Vectorize namespace cap (Cloudflare docs: namespaces are ≤ 64 bytes). */
export const MAX_NAMESPACE_LENGTH = 64

export function getCloudflareBaseUrl(): string {
  return process.env.CLOUDFLARE_BASE_URL || CLOUDFLARE_API_BASE
}

/** The Cloudflare account that owns the platform Vectorize index (required). */
export function getCloudflareAccountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!id) throw new ProviderNotConfiguredError("cloudflare")
  return id
}

/** The server-side Cloudflare credential (missing → provider config problem). */
export function getCloudflareApiToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new ProviderNotConfiguredError("cloudflare")
  return token
}

/**
 * The single Vectorize index the runtime operates on. The index is an Atai
 * infrastructure decision — callers address it implicitly through the
 * capability, never by name (§53).
 */
export function getCloudflareVectorizeIndex(): string {
  const index = process.env.CLOUDFLARE_VECTORIZE_INDEX
  if (!index) throw new ProviderNotConfiguredError("cloudflare")
  return index
}

export function isCloudflareConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_VECTORIZE_INDEX,
  )
}

export function getCloudflareTimeoutMs(): number {
  return boundedTimeoutMs(process.env.CLOUDFLARE_TIMEOUT_MS, DEFAULT_CLOUDFLARE_TIMEOUT_MS)
}

/**
 * Deterministic, collision-safe namespace for one authenticated project +
 * environment. Human-readable prefix when it fits; a short digest suffix
 * keeps long project ids collision-free under the 64-byte provider cap.
 * NEVER derived from request content — only from the trusted auth context.
 */
export function namespaceForProject(projectId: string, environment: string): string {
  const sanitized = projectId.replace(/[^A-Za-z0-9_-]/g, "_")
  const readable = `p_${sanitized}_${environment}`
  if (readable.length <= MAX_NAMESPACE_LENGTH) return readable
  const digest = createHash("sha256").update(`${projectId}:${environment}`).digest("hex").slice(0, 12)
  return `${readable.slice(0, MAX_NAMESPACE_LENGTH - 13)}_${digest}`
}

/** Headers for a Cloudflare API request: provider credential only. */
export function cloudflareHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${getCloudflareApiToken()}`,
    "content-type": "application/json",
    accept: "application/json",
  }
}
