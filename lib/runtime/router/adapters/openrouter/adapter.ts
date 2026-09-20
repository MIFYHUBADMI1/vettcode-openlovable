import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeChatCompletion } from "./client"
import { toChatResult, toOpenRouterRequest } from "./mapper"
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
    return capability === "ai.text" && operation === "chat"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse> {
    const startedAt = Date.now()

    // 1. Translate (validates; bad caller input → normalized 422-class error).
    const projectConfig = await getCachedProjectRuntimeConfig(request.auth.projectId)
    const orRequest = toOpenRouterRequest(
      request.request.input,
      request,
      configToModelPolicy(projectConfig),
    )

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
