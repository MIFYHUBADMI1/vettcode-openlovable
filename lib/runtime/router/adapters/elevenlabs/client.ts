import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { elevenLabsHeaders, getElevenLabsBaseUrl, getElevenLabsTimeoutMs } from "./config"
import { failureForStatus } from "./errors"
import { providerFetch } from "../shared/http"
import { isAlreadyNormalized } from "../shared/errors"

/**
 * Atai Runtime — ElevenLabs HTTP client (server-only).
 *
 * The ONLY place the adapter touches the network. Endpoint comes exclusively
 * from trusted server configuration; timeouts are bounded; redirects are
 * never followed; network faults normalize to provider_timeout/unavailable.
 *
 * @module lib/runtime/router/adapters/elevenlabs/client
 */

export async function executeTextToSpeech(params: {
  voiceId: string
  body: { text: string; model_id: string }
  requestId?: string
}): Promise<{ bytes: ArrayBuffer; latencyMs: number }> {
  const startedAt = Date.now()
  // Voice ID is encodeURIComponent-ed despite being shape-validated: the URL
  // can never be reshaped by request data (SSRF/§42).
  const url = `${getElevenLabsBaseUrl()}/v1/text-to-speech/${encodeURIComponent(params.voiceId)}?output_format=mp3_44100_128`

  try {
    const res = await providerFetch({
      url,
      method: "POST",
      headers: elevenLabsHeaders(),
      body: JSON.stringify(params.body),
      timeoutMs: getElevenLabsTimeoutMs(),
      binary: true,
      requestId: params.requestId,
    })

    if (!res.ok) {
      logger.error("runtime.elevenlabs", "provider returned an error status", {
        ...(params.requestId ? { requestId: params.requestId } : {}),
        status: res.status,
        latencyMs: Date.now() - startedAt,
        detail: res.text.slice(0, 300),
      })
      throw failureForStatus(res.status, res.text)
    }

    return { bytes: res.bytes ?? new ArrayBuffer(0), latencyMs: Date.now() - startedAt }
  } catch (e) {
    if (isAlreadyNormalized(e)) throw e
    logger.error("runtime.elevenlabs", "provider request failed", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      latencyMs: Date.now() - startedAt,
      errorName: e instanceof Error ? e.name : "unknown",
    })
    throw new ProviderExecutionError("provider_unavailable", "The voice provider is temporarily unavailable.")
  }
}
