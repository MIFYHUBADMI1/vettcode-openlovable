/**
 * Atai SDK — Voice capability.
 *
 * The provider-neutral surface for Atai's voice capability. The application
 * thinks in Atai operations (`atai.voice.synthesize(...)`), never in
 * providers. Audio arrives base64-encoded inside the runtime JSON envelope;
 * `toDataUrl(result)` turns it into a playable/downloadable URL — the SDK
 * never receives provider credentials or wire formats.
 *
 * @module capabilities/voice
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, VoiceSynthesizeInput, VoiceSynthesizeResult } from "../types.js";
/** The Atai voice capability. Exposed as `atai.voice` on the client. */
export declare class VoiceCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Run one provider-neutral text-to-speech operation (`ai.speak`/`synthesize`). */
    synthesize(input: VoiceSynthesizeInput, options?: AtaiRequestOptions): Promise<VoiceSynthesizeResult>;
    /**
     * Convert a synthesis result into a playable/downloadable data URL
     * (`data:audio/…;base64,…`). Works in browsers (`<audio src>`, download
     * links) and Node (for further processing).
     */
    toDataUrl(result: VoiceSynthesizeResult): string;
}
//# sourceMappingURL=voice.d.ts.map