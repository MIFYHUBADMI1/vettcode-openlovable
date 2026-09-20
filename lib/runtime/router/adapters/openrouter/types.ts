/**
 * Atai Runtime — OpenRouter wire types (server-only, adapter-internal).
 *
 * Request/response shapes taken from the official OpenRouter API reference
 * (verified for Phase 6; see module docs in client.ts). Provider-specific
 * knowledge is confined to the adapter (Phase 6 §75). Response fields are
 * `unknown` where external — validated before use (§69/§70/§71).
 *
 * @module lib/runtime/router/adapters/openrouter/types
 */

/** Official endpoint: POST {base}/chat/completions. */
export const OPENROUTER_CHAT_COMPLETIONS_PATH = "/chat/completions"

// ─── Request ───────────────────────────────────────────────────────────────

export interface OpenRouterMessage {
  role: "user" | "assistant" | "system"
  content: string
}

/** Body built by the mapper — only fields the Atai contract supports (§92). */
export interface OpenRouterChatRequest {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string | string[]
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
  /** OpenRouter `models` fallback list — NOT exposed in Phase 6 (§23). */
}

// ─── Response ──────────────────────────────────────────────────────────────

/** OpenRouter normalizes usage across providers; token counts are native. */
export interface OpenRouterUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost?: number
}

export interface OpenRouterNonStreamingChoice {
  finish_reason: string | null
  message: {
    role: string
    content: string | null
  }
}

/**
 * Normalized completion response. `model` is the model OpenRouter ACTUALLY
 * used after its internal routing/fallback (§46/§47) — preserve it verbatim.
 */
export interface OpenRouterChatResponse {
  id: string
  model: string
  choices: OpenRouterNonStreamingChoice[]
  usage?: OpenRouterUsage
  created?: number
}

// ─── Errors ────────────────────────────────────────────────────────────────

/**
 * Official error envelope: { error: { code, message, metadata? } }. On a 200
 * "mid-generation failure" the body holds ONLY the error object — no choices
 * (§103). `error_type` lives in error.metadata when a provider error
 * interrupts generation.
 */
export interface OpenRouterErrorBody {
  error?: {
    code?: number
    message?: string
    metadata?: Record<string, unknown>
  }
}
