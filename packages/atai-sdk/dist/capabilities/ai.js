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
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/**
 * Lightweight client-side validation (developer experience only). The
 * server-side schema remains authoritative — the SDK does not duplicate it.
 */
function validateChatInput(input) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
        throw new AtaiError("atai_invalid_request", "AI chat input must be an object with a `messages` array.");
    }
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
        throw new AtaiError("atai_invalid_request", "AI chat input requires at least one message.");
    }
    for (const message of input.messages) {
        if (message === null ||
            typeof message !== "object" ||
            typeof message.content !== "string" ||
            message.content.length === 0 ||
            (message.role !== "user" && message.role !== "assistant" && message.role !== "system")) {
            throw new AtaiError("atai_invalid_request", "Each AI message requires a role (`user`, `assistant`, or `system`) and non-empty string content.");
        }
    }
    if (input.model !== undefined && (typeof input.model !== "string" || input.model.length === 0)) {
        throw new AtaiError("atai_invalid_request", "`model` must be a non-empty string when provided.");
    }
}
/**
 * The Atai AI capability. Exposed as `atai.ai` on the client. Future
 * capabilities (voice, web, email…) follow the same pattern without
 * breaking this surface — but none are implemented ahead of their runtime
 * support.
 */
export class AiCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Run one provider-neutral AI chat operation against the Atai Runtime
     * API (`capability: "ai.text"`, `operation: "chat"`).
     */
    async chat(input, options) {
        validateChatInput(input);
        // Runtime envelope for the chat operation. Field-for-field identical to
        // the established contract — no baseUrl, headers, or credentials are
        // accepted (or possible) here.
        const body = {
            capability: "ai.text",
            operation: "chat",
            input: {
                messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
                ...(input.model !== undefined ? { model: input.model } : {}),
                ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
                ...(input.top_p !== undefined ? { top_p: input.top_p } : {}),
                ...(input.max_tokens !== undefined ? { max_tokens: input.max_tokens } : {}),
                ...(input.stop !== undefined ? { stop: input.stop } : {}),
                ...(input.frequency_penalty !== undefined ? { frequency_penalty: input.frequency_penalty } : {}),
                ...(input.presence_penalty !== undefined ? { presence_penalty: input.presence_penalty } : {}),
                ...(input.seed !== undefined ? { seed: input.seed } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertChatResult(envelope.data.data);
    }
}
/**
 * Narrow runtime check on the returned payload (§53 — server responses are
 * never trusted blindly). Structural, cheap, and capability-specific; the
 * server remains authoritative for semantics.
 */
function assertChatResult(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    const p = payload;
    const valid = typeof p.id === "string" &&
        typeof p.model === "string" &&
        typeof p.content === "string" &&
        (p.finishReason === null || typeof p.finishReason === "string") &&
        (p.usage === undefined ||
            (typeof p.usage === "object" &&
                p.usage !== null &&
                typeof p.usage.promptTokens === "number" &&
                typeof p.usage.completionTokens === "number" &&
                typeof p.usage.totalTokens === "number"));
    if (!valid) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=ai.js.map