/**
 * Atai SDK — Voice capability.
 *
 * The provider-neutral surface for Atai's voice capability. The application
 * thinks in Atai operations (`atai.voice.synthesize(...)`), never in
 * providers. Audio arrives base64-encoded inside the runtime JSON envelope —
 * the SDK never receives provider credentials or wire formats.
 *
 * @module capabilities/voice
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type { AtaiRequestOptions, VoiceSynthesizeInput, VoiceSynthesizeResult } from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateSynthesizeInput(input: VoiceSynthesizeInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Voice synthesis input must be an object with a `text` string.")
  }
  if (typeof input.text !== "string" || input.text.length === 0 || input.text.length > 5_000) {
    throw new AtaiError("atai_invalid_request", "Voice synthesis requires `text` between 1 and 5,000 characters.")
  }
  if (input.voiceId !== undefined && (typeof input.voiceId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(input.voiceId))) {
    throw new AtaiError("atai_invalid_request", "`voiceId` must be a valid voice identifier when provided.")
  }
  if (input.model !== undefined && (typeof input.model !== "string" || input.model.length === 0)) {
    throw new AtaiError("atai_invalid_request", "`model` must be a non-empty string when provided.")
  }
}

/** The Atai voice capability. Exposed as `atai.voice` on the client. */
export class VoiceCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Run one provider-neutral text-to-speech operation (`ai.speak`/`synthesize`). */
  async synthesize(input: VoiceSynthesizeInput, options?: AtaiRequestOptions): Promise<VoiceSynthesizeResult> {
    validateSynthesizeInput(input)

    const body = {
      capability: "ai.speak",
      operation: "synthesize",
      input: {
        text: input.text,
        ...(input.voiceId !== undefined ? { voiceId: input.voiceId } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
      },
    }

    const { envelope } = await execute<typeof body, VoiceSynthesizeResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertSynthesizeResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertSynthesizeResult(payload: unknown): VoiceSynthesizeResult {
  if (typeof payload !== "object" || payload === null) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  const p = payload as Record<string, unknown>
  const valid =
    typeof p.audioBase64 === "string" &&
    typeof p.mimeType === "string" &&
    typeof p.voiceId === "string" &&
    typeof p.modelId === "string" &&
    typeof p.characters === "number"
  if (!valid) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as VoiceSynthesizeResult
}
