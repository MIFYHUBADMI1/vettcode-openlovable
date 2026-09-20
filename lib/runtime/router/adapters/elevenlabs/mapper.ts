import "server-only"
import { z } from "zod"
import type { ProviderExecutionRequest, ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getElevenLabsDefaultModel, getElevenLabsDefaultVoiceId } from "./config"

/**
 * Atai Runtime — ElevenLabs request/response mapper (server-only).
 *
 * Owns both translations: validated provider-neutral input → ElevenLabs
 * text-to-speech body, and the binary audio response → provider-neutral
 * base64 data. Strict schema: unknown fields are rejected, never forwarded.
 * Voice/model defaults come from trusted server configuration — the caller
 * can never influence authentication or the endpoint (§9/§53).
 *
 * @module lib/runtime/router/adapters/elevenlabs/mapper
 */

/**
 * Supported model allowlist (§52): only documented, stable ElevenLabs
 * speech models are exposed. Unknown model IDs never reach the provider.
 */
export const ELEVENLABS_ALLOWED_MODELS = [
  "eleven_multilingual_v2",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
] as const

/**
 * Input text cap. Voice synthesis is billed per character and returns a
 * binary payload — the cap bounds both provider cost and the base64 response
 * carried through the runtime JSON envelope (§43/§48).
 */
export const MAX_SYNTHESIZE_CHARS = 5_000

export const SynthesizeInputSchema = z
  .object({
    /** Text to synthesize (1..5,000 chars). */
    text: z.string().min(1).max(MAX_SYNTHESIZE_CHARS),
    /** ElevenLabs voice ID (validated shape; default from server config). */
    voiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/, "Invalid voice ID format").optional(),
    /** Model from the allowlist (default from server config). */
    model: z.enum(ELEVENLABS_ALLOWED_MODELS).optional(),
  })
  .strict()

export type SynthesizeInput = z.infer<typeof SynthesizeInputSchema>

/** Provider-neutral success payload (what the generated application sees). */
export interface SynthesizeResultData {
  /** MPEG audio, base64-encoded (JSON-envelope transport, §48). */
  audioBase64: string
  mimeType: "audio/mpeg"
  /** The voice actually used. */
  voiceId: string
  /** The model actually used. */
  modelId: string
  /** Characters billed (provider usage unit for voice). */
  characters: number
}

export interface TranslatedSynthesizeRequest {
  voiceId: string
  body: { text: string; model_id: string }
  characters: number
}

/**
 * Translate validated Atai input into an ElevenLabs text-to-speech call.
 * Throws ProviderExecutionError("unsupported_operation") — normalized to
 * runtime_invalid_request (422) by the router — for schema violations or
 * missing voice/model configuration, so bad input never reaches the provider.
 */
export function toElevenLabsRequest(
  input: unknown,
  request: ProviderExecutionRequest,
): TranslatedSynthesizeRequest {
  void request
  const parsed = SynthesizeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `synthesize input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }

  const model = parsed.data.model ?? getElevenLabsDefaultModel()
  if (!model || !(ELEVENLABS_ALLOWED_MODELS as readonly string[]).includes(model)) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      "no model specified and no ELEVENLABS_DEFAULT_MODEL configured",
    )
  }

  const voiceId = parsed.data.voiceId ?? getElevenLabsDefaultVoiceId()
  if (!voiceId) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      "no voiceId provided and no ELEVENLABS_DEFAULT_VOICE_ID configured",
    )
  }

  return { voiceId, body: { text: parsed.data.text, model_id: model }, characters: parsed.data.text.length }
}

/**
 * Normalize a successful binary audio response into the provider-neutral
 * result. Characters are reported as provider usage metadata (§55) — the
 * provider's own billable unit for voice; monetary cost is unknown (§56).
 */
export function toSynthesizeResult(
  bytes: ArrayBuffer,
  voiceId: string,
  modelId: string,
  characters: number,
): ProviderExecutionResponse<SynthesizeResultData> {
  if (bytes.byteLength === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The voice provider returned an error.",
      "empty audio payload",
    )
  }
  return {
    provider: "elevenlabs",
    data: {
      audioBase64: Buffer.from(bytes).toString("base64"),
      mimeType: "audio/mpeg",
      voiceId,
      modelId,
      characters,
    },
    usage: { inputTokens: 0, outputTokens: 0, metadata: { characters } },
  }
}
