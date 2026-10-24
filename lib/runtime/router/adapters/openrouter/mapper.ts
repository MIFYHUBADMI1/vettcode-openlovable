import "server-only"
import { z } from "zod"
import type { ProviderExecutionRequest, ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import {
  resolveChatModel,
  UNRESTRICTED_MODEL_POLICY,
  type ChatModelPolicy,
} from "@/lib/runtime/control/model-policy"
import type { OpenRouterChatRequest, OpenRouterChatResponse, OpenRouterUsage } from "./types"

/**
 * Atai Runtime — OpenRouter request/response mapper (server-only).
 *
 * Owns the two translations (Phase 6 §15/§18/§92/§94):
 *
 *   Atai input (validated, allowlisted) → OpenRouter chat-completions body
 *   OpenRouter response (validated)     → provider-neutral Atai data
 *
 * The OpenRouter request is built DELIBERATELY field by field — the caller's
 * `input` is never forwarded wholesale (§92/§94). Unknown fields fail
 * validation with a normalized 422-class error instead of reaching the
 * provider. OpenRouter-specific features (models fallback, provider routing,
 * plugins) are deliberately NOT exposed in Phase 6 (§22/§23).
 *
 * @module lib/runtime/router/adapters/openrouter/mapper
 */

// ─── Atai chat input contract (provider-neutral vocabulary) ────────────────

/**
 * The Atai chat operation input. Text content only — multimodal input is not
 * part of the established Phase 5/6 contract (§19). Strict: unexpected fields
 * are rejected, never silently forwarded.
 */
export const ChatInputSchema = z
  .object({
    /** Optional caller-selected OpenRouter model (e.g. "openai/gpt-5.2"). */
    model: z.string().min(1).max(200).regex(/^[\w.\/:-]+$/, "Invalid model identifier").optional(),
    /** Conversation in provider-neutral form; translated verbatim (§18/§20). */
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().min(1).max(100_000),
        }),
      )
      .min(1)
      .max(128),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().gt(0).max(1).optional(),
    max_tokens: z.number().int().min(1).max(1_000_000).optional(),
    stop: z.union([z.string().max(100), z.array(z.string().max(100)).max(4)]).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    seed: z.number().int().optional(),
  })
  .strict()

export type ChatInput = z.infer<typeof ChatInputSchema>

/**
 * The Atai completion operation input — a single-shot prompt (Phase 10:
 * "completion" joined the provider-neutral vocabulary alongside "chat").
 * Strict: unexpected fields are rejected, never silently forwarded.
 */
export const CompletionInputSchema = z
  .object({
    prompt: z.string().min(1).max(100_000),
    model: z.string().min(1).max(200).regex(/^[\w.\/:-]+$/, "Invalid model identifier").optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().gt(0).max(1).optional(),
    max_tokens: z.number().int().min(1).max(1_000_000).optional(),
    stop: z.union([z.string().max(100), z.array(z.string().max(100)).max(4)]).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    seed: z.number().int().optional(),
  })
  .strict()

export type CompletionInput = z.infer<typeof CompletionInputSchema>

/**
 * Platform-recommended default when the caller does not select a model and
 * OPENROUTER_DEFAULT_MODEL is not configured. A constant (not a required env
 * var) so chat always resolves — first calls from unconfigured projects and
 * the developer-portal playground work out of the box.
 */
export const RECOMMENDED_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"

/**
 * Server-side default when the caller does not select a model (§16). Read
 * lazily at request time (module-load capture would freeze the value before
 * tests set the environment). Env override wins; otherwise the recommended
 * default applies.
 */
function defaultModel(): string {
  return process.env.OPENROUTER_DEFAULT_MODEL || RECOMMENDED_DEFAULT_MODEL
}


/** Shared model resolution: caller selection → project policy → platform default. */
function resolveModelOrThrow(model: string | undefined, operation: string, policy?: ChatModelPolicy | null): string {
  const resolved = resolveChatModel(
    model,
    policy ?? UNRESTRICTED_MODEL_POLICY,
    defaultModel(),
  )
  if (!resolved.ok) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      resolved.error === "model_not_allowed"
        ? "The requested model is not allowed for this project."
        : "The request body is invalid for this capability.",
      resolved.error === "model_not_allowed"
        ? `model not in project allowlist (operation "${operation}")`
        : `no model could be resolved (caller, project policy, and platform default) (operation "${operation}")`,
    )
  }
  return resolved.model
}

/** Optional generation parameters shared by chat and completion bodies. */
function applyGenerationParams(
  body: OpenRouterChatRequest,
  params: Pick<ChatInput, "temperature" | "top_p" | "max_tokens" | "stop" | "frequency_penalty" | "presence_penalty" | "seed">,
): void {
  if (params.temperature !== undefined) body.temperature = params.temperature
  if (params.top_p !== undefined) body.top_p = params.top_p
  if (params.max_tokens !== undefined) body.max_tokens = params.max_tokens
  if (params.stop !== undefined) body.stop = params.stop
  if (params.frequency_penalty !== undefined) body.frequency_penalty = params.frequency_penalty
  if (params.presence_penalty !== undefined) body.presence_penalty = params.presence_penalty
  if (params.seed !== undefined) body.seed = params.seed
}

/**
 * Translate validated Atai input into an OpenRouter chat-completions body.
 * Throws ProviderExecutionError("unsupported_operation") — which the router
 * normalizes to runtime_invalid_request (422) — for schema violations, so a
 * bad caller input never reaches the provider as a 502-style failure.
 */
export function toOpenRouterRequest(
  input: unknown,
  request: ProviderExecutionRequest,
  policy?: ChatModelPolicy | null,
): OpenRouterChatRequest {
  const parsed = ChatInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `chat input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }

  const chat = parsed.data
  const model = resolveModelOrThrow(chat.model, "chat", policy)

  // Deliberate allowlist translation — only contract-supported parameters.
  const body: OpenRouterChatRequest = {
    model,
    messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
  }
  applyGenerationParams(body, chat)

  return body
}

// ─── Completion (ai.text/completion — single-shot prompt) ───────────────

/**
 * Translate validated Atai completion input into an OpenRouter
 * chat-completions body: the prompt becomes one user message. Validation
 * and model resolution follow exactly the chat contract (§ shared policy).
 */
export function toOpenRouterCompletionRequest(
  input: unknown,
  request: ProviderExecutionRequest,
  policy?: ChatModelPolicy | null,
): OpenRouterChatRequest {
  void request
  const parsed = CompletionInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `completion input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }

  const completion = parsed.data
  const model = resolveModelOrThrow(completion.model, "completion", policy)

  const body: OpenRouterChatRequest = {
    model,
    messages: [{ role: "user", content: completion.prompt }],
  }
  applyGenerationParams(body, completion)

  return body
}

// ─── Response normalization ────────────────────────────────────────────────

/** Provider-neutral success payload (what the generated application sees). */
export interface ChatResultData {
  /** OpenRouter generation id — safe, non-secret correlation (§46). */
  id: string
  /** The model OpenRouter ACTUALLY used after routing/fallback (§47). */
  model: string
  /** Assistant text content. */
  content: string
  /** Normalized finish reason (stop | length | content_filter | tool_calls | error). */
  finishReason: string | null
  /** Token usage, preserved for metering (§85/§86) — not persisted here. */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    /** Provider-reported cost in USD, when present (Phase 9.5 §24/§33 —
     * internal analytics only, NEVER the Atai customer charge). */
    cost?: number
  }
}

/** Structural + value guard on usage (external data — never trusted blindly). */
function normalizeUsage(raw: unknown): ChatResultData["usage"] | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const u = raw as Partial<OpenRouterUsage>
  const p = typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined
  const c = typeof u.completion_tokens === "number" ? u.completion_tokens : undefined
  const t = typeof u.total_tokens === "number" ? u.total_tokens : undefined
  if (p === undefined || c === undefined || t === undefined) return undefined
  return {
    promptTokens: p,
    completionTokens: c,
    totalTokens: t,
    ...(typeof u.cost === "number" ? { cost: u.cost } : {}),
  }
}

/**
 * Normalize a validated OpenRouter completion response into the
 * provider-neutral result. Failures (no choices, missing message/content)
 * become normalized provider errors — never fake success (§105).
 */
export function toChatResult(
  response: OpenRouterChatResponse,
  request: ProviderExecutionRequest,
): ProviderExecutionResponse<ChatResultData> {
  const choice = response.choices[0]
  const content = choice?.message?.content

  if (typeof content !== "string") {
    // Empty choices / missing message / null content — a failed generation.
    throw new ProviderExecutionError(
      "provider_error",
      "The AI provider returned an error.",
      `completion produced no content (finish_reason: ${String(choice?.finish_reason ?? "unknown")})`,
    )
  }

  return {
    provider: "openrouter",
    data: {
      id: response.id,
      // Preserve the ACTUAL model — OpenRouter may route/fallback internally
      // and reports the model ultimately used (§46/§47/§87).
      model: response.model,
      content,
      finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
      usage: normalizeUsage(response.usage),
    },
  }
}
