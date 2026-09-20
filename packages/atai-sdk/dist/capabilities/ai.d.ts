/**
 * Atai SDK — AI capability.
 *
 * The provider-neutral surface for Atai's AI capability. The application
 * thinks in Atai operations (`atai.ai.chat(...)`), never in providers.
 * Serialization maps 1:1 onto the runtime's `ai.text`/`chat` contract —
 * nothing is invented and nothing is forwarded wholesale.
 *
 * @module capabilities/ai
 */
import type { ResolvedConfig } from "../config.js";
import type { AiChatInput, AiChatResult, AtaiRequestOptions } from "../types.js";
/**
 * The Atai AI capability. Exposed as `atai.ai` on the client. Future
 * capabilities (voice, web, email…) follow the same pattern without
 * breaking this surface — but none are implemented ahead of their runtime
 * support.
 */
export declare class AiCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /**
     * Run one provider-neutral AI chat operation against the Atai Runtime
     * API (`capability: "ai.text"`, `operation: "chat"`).
     */
    chat(input: AiChatInput, options?: AtaiRequestOptions): Promise<AiChatResult>;
}
//# sourceMappingURL=ai.d.ts.map