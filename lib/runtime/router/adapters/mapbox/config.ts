import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Mapbox adapter configuration (server-only, Phase 10 §16).
 *
 * ONE controlled access point for the Mapbox access token. The token is
 * never exposed to runtime callers, logs, or responses, and only the two
 * contract-approved geocoding endpoints are reachable (§16: no arbitrary
 * Mapbox endpoint forwarding).
 *
 * @module lib/runtime/router/adapters/mapbox/config
 */

/** Official Mapbox API root. Override only for tests (trusted server env). */
export const MAPBOX_API_BASE = "https://api.mapbox.com"

export const DEFAULT_MAPBOX_TIMEOUT_MS = 15_000

export function getMapboxBaseUrl(): string {
  return process.env.MAPBOX_BASE_URL || MAPBOX_API_BASE
}

export function getMapboxAccessToken(): string {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) throw new ProviderNotConfiguredError("mapbox")
  return token
}

export function isMapboxConfigured(): boolean {
  return Boolean(process.env.MAPBOX_ACCESS_TOKEN)
}

export function getMapboxTimeoutMs(): number {
  return boundedTimeoutMs(process.env.MAPBOX_TIMEOUT_MS, DEFAULT_MAPBOX_TIMEOUT_MS)
}
