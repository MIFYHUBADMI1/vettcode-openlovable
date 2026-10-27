import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeChatCompletion, executeOpenRouterJsonPost, executeOpenRouterSpeech } from "./client"
import { toChatResult, toOpenRouterCompletionRequest, toOpenRouterRequest } from "./mapper"
import {
  toOpenRouterImageRequest,
  toImageResult,
  toOpenRouterVideoRequest,
  VideoPollSchema,
  toVideoResult,
  toOpenRouterSpeechRequest,
  toSpeechResult,
  toOpenRouterTranscriptionRequest,
  toTranscriptionResult,
  toOpenRouterVisionRequest,
  toVisionResult,
} from "./multimodal"
import {
  OPENROUTER_IMAGES_PATH,
  OPENROUTER_VIDEOS_PATH,
  OPENROUTER_AUDIO_TRANSCRIPTIONS_PATH,
} from "./types"
import { getCachedProjectRuntimeConfig } from "@/lib/runtime/control/config-store"
import { configToModelPolicy } from "@/lib/runtime/control/model-policy"

/**
 * Atai Runtime — OpenRouter provider adapter (server-only).
 *
 * The FIRST production adapter behind the Phase 5 provider-neutral Runtime
 * Core (Phase 6). Implements the EXISTING RuntimeProviderAdapter interface —
 * no duplicate router, no duplicate registry (§5/§40/§44). The adapter knows
 * OpenRouter; nothing else in the runtime does (§75).
 *
 * Responsibilities (§41): translate the validated provider-neutral request →
 * OpenRouter HTTP, call it, validate + normalize the response, normalize
 * failures. NOT responsible for: customer authentication, ownership, scope
 * authorization, billing, usage persistence, provisioning (§41/§42/§43).
 *
 * Customer auth (Atai API key → Phase 4) and provider auth (Atai server →
 * OPENROUTER_API_KEY → OpenRouter) remain completely separate (§43).
 *
 * @module lib/runtime/router/adapters/openrouter/adapter
 */

export const OPENROUTER_PROVIDER_ID = "openrouter"

class OpenRouterAdapter implements RuntimeProviderAdapter {
  readonly provider = OPENROUTER_PROVIDER_ID

  /**
   * The adapter serves the provider-neutral `ai.text` capability established
   * by the Phase 2/5 contracts — the generated application never learns that
   * OpenRouter is behind it (§7/§8).
   */
  supports(capability: string, operation: string): boolean {
    if (capability === "ai.text" && (operation === "chat" || operation === "completion")) return true
    // Multimodal wave — dedicated OpenRouter endpoints.
    if (capability === "ai.image" && operation === "generateImage") return true
    if (capability === "ai.video" && operation === "generateVideo") return true
    if (capability === "ai.speech" && operation === "speak") return true
    if (capability === "ai.transcribe" && operation === "transcribe") return true
    if (capability === "ai.vision" && operation === "visionInput") return true
    return false
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse> {
    const startedAt = Date.now()
    const { capability, operation } = request.request

    // Multimodal dispatch — dedicated OpenRouter endpoints (images, videos,
    // speech, transcriptions) and multimodal chat (vision). Each branch
    // validates caller input first (normalized 422-class on violation).
    if (capability === "ai.image" && operation === "generateImage") {
      // Image resolves its own default — the project chat model cannot output images.
      const body = toOpenRouterImageRequest(request.request.input)
      const { payload } = await executeOpenRouterJsonPost(OPENROUTER_IMAGES_PATH, body)
      return toImageResult(payload as Parameters<typeof toImageResult>[0], body.model)
    }

    if (capability === "ai.video" && operation === "generateVideo") {
      // Async job: first call submits and returns { jobId, status }. A follow-up
      // call with { jobId } polls the job for completion.
      const poll = VideoPollSchema.safeParse(request.request.input)
      if (poll.success) {
        const { payload } = await executeOpenRouterJsonPost(`${OPENROUTER_VIDEOS_PATH}/${poll.data.jobId}`, {})
        return toVideoResult(payload as Parameters<typeof toVideoResult>[0])
      }
      const body = toOpenRouterVideoRequest(request.request.input)
      const { payload } = await executeOpenRouterJsonPost(OPENROUTER_VIDEOS_PATH, body)
      return toVideoResult(payload as Parameters<typeof toVideoResult>[0])
    }

    if (capability === "ai.speech" && operation === "speak") {
      // Speech resolves its own TTS default. Passing the project's CHAT model
      // into /audio/speech is what produced "Model ... does not exist".
      const body = toOpenRouterSpeechRequest(request.request.input)
      const { bytes, contentType, generationId } = await executeOpenRouterSpeech(body)
      return toSpeechResult(bytes, {
        model: body.model,
        contentType,
        generationId,
        voice: body.voice,
        format: body.response_format,
      })
    }

    if (capability === "ai.transcribe" && operation === "transcribe") {
      // The model is pinned server-side — no project default, no caller override.
      const body = toOpenRouterTranscriptionRequest(request.request.input)
      const { payload } = await executeOpenRouterJsonPost(OPENROUTER_AUDIO_TRANSCRIPTIONS_PATH, body)
      return toTranscriptionResult(payload as Parameters<typeof toTranscriptionResult>[0])
    }

    if (capability === "ai.vision" && operation === "visionInput") {
      // The project's defaultModel is a CHAT policy; using it as the vision
      // fallback made every unmodelled image call resolve to a text-only model
      // and fail OpenRouter's image-capability routing filter. Vision resolves
      // caller model → OPENROUTER_VISION_MODEL → image-capable recommended.
      const body = toOpenRouterVisionRequest(request.request.input)
      const { payload } = await executeOpenRouterJsonPost("/chat/completions", body)
      return toVisionResult(payload as Parameters<typeof toVisionResult>[0])
    }

    // Chat (ai.text/chat) and completion (ai.text/completion) share the
    // same OpenRouter endpoint and normalization — only the translation of
    // the provider-neutral input differs.
    // 1. Translate (validates; bad caller input → normalized 422-class error).
    const projectConfig = await getCachedProjectRuntimeConfig(request.auth.projectId)
    const policy = configToModelPolicy(projectConfig)
    const orRequest =
      capability === "ai.text" && operation === "completion"
        ? toOpenRouterCompletionRequest(request.request.input, request, policy)
        : toOpenRouterRequest(request.request.input, request, policy)

    // 2. Call OpenRouter (network failures → normalized ProviderExecutionError).
    const { response, latencyMs } = await executeChatCompletion(orRequest)

    // 3. Normalize to the provider-neutral result (model = the one actually used).
    const result = toChatResult(response, request)

    logger.info("runtime.openrouter", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      model: result.data.model,
      latencyMs,
      totalLatencyMs: Date.now() - startedAt,
      finishReason: result.data.finishReason,
      // Usage preserved for the future metering phase (§85/§86) — logged as
      // safe numeric metadata only, never persisted in Phase 6 (§32/§63).
      usage: result.data.usage
        ? {
            promptTokens: result.data.usage.promptTokens,
            completionTokens: result.data.usage.completionTokens,
            totalTokens: result.data.usage.totalTokens,
          }
        : undefined,
    })

    // Phase 9/9.5: report normalized billable usage on the adapter result —
    // the metering layer consumes ONLY this normalized shape (never raw
    // provider payloads). The adapter does NOT charge credits (§40) and does
    // NOT compute customer pricing. The provider-reported cost (when
    // OpenRouter supplies one) is carried VERBATIM for Atai-side financial
    // analytics — never treated as the customer charge (9.5 §5/§24/§50);
    // absent cost stays absent (recorded as "unavailable", never 0 — §82).
    return {
      ...result,
      ...(result.data.usage
        ? {
            usage: {
              inputTokens: result.data.usage.promptTokens,
              outputTokens: result.data.usage.completionTokens,
              ...(result.data.usage.totalTokens !== undefined
                ? { totalTokens: result.data.usage.totalTokens }
                : {}),
              ...(typeof result.data.usage.cost === "number"
                ? {
                    providerCost: result.data.usage.cost,
                    providerCostCurrency: "USD",
                    providerCostSource: "provider_reported" as const,
                  }
                : {}),
            },
          }
        : {}),
    }
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const openRouterAdapter = new OpenRouterAdapter()
