import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeTextToSpeech } from "./client"
import { toElevenLabsRequest, toSynthesizeResult, type SynthesizeResultData } from "./mapper"

/**
 * Atai Runtime — ElevenLabs provider adapter (server-only).
 *
 * Serves the provider-neutral `ai.speak`/`synthesize` capability+operation
 * (Phase 10 §11) through the EXISTING RuntimeProviderAdapter interface — no
 * duplicate router, no second registry. The adapter knows ElevenLabs;
 * nothing else in the runtime does. Customer auth (Atai API key → Phase 4)
 * and provider auth (Atai server → ELEVENLABS_API_KEY) remain completely
 * separate.
 *
 * @module lib/runtime/router/adapters/elevenlabs/adapter
 */

export const ELEVENLABS_PROVIDER_ID = "elevenlabs"

class ElevenLabsAdapter implements RuntimeProviderAdapter {
  readonly provider = ELEVENLABS_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "ai.speak" && operation === "synthesize"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<SynthesizeResultData>> {
    // 1. Translate (validates; bad caller input → normalized 422-class error).
    const translated = toElevenLabsRequest(request.request.input, request)

    // 2. Call ElevenLabs (network failures → normalized ProviderExecutionError).
    const { bytes, latencyMs } = await executeTextToSpeech({
      voiceId: translated.voiceId,
      body: translated.body,
      requestId: request.requestId,
    })

    // 3. Normalize to the provider-neutral result (base64 audio + usage).
    const result = toSynthesizeResult(bytes, translated.voiceId, translated.body.model_id, translated.characters)

    logger.info("runtime.elevenlabs", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      voiceId: translated.voiceId,
      model: translated.body.model_id,
      characters: translated.characters,
      audioBytes: bytes.byteLength,
      latencyMs,
    })

    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const elevenLabsAdapter = new ElevenLabsAdapter()
