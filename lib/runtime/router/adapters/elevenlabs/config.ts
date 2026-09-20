import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — ElevenLabs adapter configuration (server-only).
 *
 * ONE controlled access point for the ElevenLabs credential (mirrors the
 * OpenRouter config pattern, Phase 10 §9/§49). The secret is read lazily at
 * call time and never appears in RuntimeAuthContext, RuntimeRequest,
 * RuntimeResponse, logs, or database documents.
 *
 * @module lib/runtime/router/adapters/elevenlabs/config
 */

/** Official ElevenLabs API root. Override only for tests (trusted server env). */
export const ELEVENLABS_API_BASE = "https://api.elevenlabs.io"

export const DEFAULT_ELEVENLABS_TIMEOUT_MS = 60_000

export function getElevenLabsBaseUrl(): string {
  return process.env.ELEVENLABS_BASE_URL || ELEVENLABS_API_BASE
}

/** The server-side ElevenLabs credential (missing → provider config problem). */
export function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new ProviderNotConfiguredError("elevenlabs")
  return key
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY)
}

export function getElevenLabsTimeoutMs(): number {
  return boundedTimeoutMs(process.env.ELEVENLABS_TIMEOUT_MS, DEFAULT_ELEVENLABS_TIMEOUT_MS)
}

/** Server-configured default voice (callers may override per request). */
export function getElevenLabsDefaultVoiceId(): string | undefined {
  return process.env.ELEVENLABS_DEFAULT_VOICE_ID || undefined
}

/** Server-configured default model (callers may override per request). */
export function getElevenLabsDefaultModel(): string | undefined {
  return process.env.ELEVENLABS_DEFAULT_MODEL || undefined
}

/** Headers for an ElevenLabs API request: provider credential only. */
export function elevenLabsHeaders(): Record<string, string> {
  return {
    "xi-api-key": getElevenLabsApiKey(),
    "content-type": "application/json",
    accept: "audio/mpeg",
  }
}
