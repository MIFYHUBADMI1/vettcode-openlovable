import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Totalum adapter configuration (server-only).
 *
 * REUSES the EXISTING platform Totalum credential (TOTALUM_API_KEY, the
 * same variable the build-time VCaaS client reads — Phase 10 §9: never
 * invent duplicate environment configuration for an existing integration).
 * The build system and the runtime adapter stay fully separate code paths
 * (§19): this module only provides configuration values.
 *
 * The key authorizes Atai's platform account; per-project isolation comes
 * from routing every data operation through the authenticated Atai
 * project's own Totalum project id (see project-binding.ts).
 *
 * @module lib/runtime/router/adapters/totalum/config
 */

/** Official Totalum VCaaS API root (matches the build-time client). */
export const TOTALUM_API_BASE = "https://api-accounts.totalum.app"
export const TOTALUM_API_PREFIX = "/api/v1/vcaas"

export const DEFAULT_TOTALUM_TIMEOUT_MS = 30_000

export function getTotalumBaseUrl(): string {
  return process.env.TOTALUM_RUNTIME_BASE_URL || `${TOTALUM_API_BASE}${TOTALUM_API_PREFIX}`
}

/** The platform Totalum credential (missing → provider config problem). */
export function getTotalumApiKey(): string {
  const key = process.env.TOTALUM_API_KEY ?? process.env.TOTALUM_VCAAS_API_KEY
  if (!key) throw new ProviderNotConfiguredError("totalum")
  return key
}

export function isTotalumRuntimeConfigured(): boolean {
  return Boolean(process.env.TOTALUM_API_KEY ?? process.env.TOTALUM_VCAAS_API_KEY)
}

export function getTotalumTimeoutMs(): number {
  return boundedTimeoutMs(process.env.TOTALUM_RUNTIME_TIMEOUT_MS, DEFAULT_TOTALUM_TIMEOUT_MS)
}

/** Headers for a Totalum VCaaS API request: provider credential only. */
export function totalumHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "api-key": getTotalumApiKey(),
  }
}
