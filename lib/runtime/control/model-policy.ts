/**
 * Pure model-resolution policy for project-owned Runtime Control Center.
 *
 * Empty `allowedModels` means "no extra restriction" (current platform behavior:
 * any valid OpenRouter model id the caller/default supplies). A non-empty list
 * is enforced server-side — UI checkboxes never authorize a model.
 */

export interface ChatModelPolicy {
  defaultModel?: string
  allowedModels: string[]
  fallbackModels: string[]
  /** Default true: generated apps may pass `input.model`. */
  allowEndUserModelSelection: boolean
}

export const UNRESTRICTED_MODEL_POLICY: ChatModelPolicy = {
  allowedModels: [],
  fallbackModels: [],
  allowEndUserModelSelection: true,
}

export type ResolveChatModelResult =
  | { ok: true; model: string }
  | { ok: false; error: "no_model" | "model_not_allowed" }

function isAllowed(model: string, allowed: string[]): boolean {
  return allowed.length === 0 || allowed.includes(model)
}

/**
 * Resolve the model a chat request will actually send.
 *
 * Order:
 *   1. Caller-selected model, when end-user selection is allowed and the id is permitted
 *   2. Project default → platform default → first permitted fallback
 */
export function resolveChatModel(
  requested: string | undefined,
  policy: ChatModelPolicy,
  platformDefault: string | undefined,
): ResolveChatModelResult {
  const allowed = policy.allowedModels
  const allowEndUser = policy.allowEndUserModelSelection !== false

  if (allowEndUser && requested) {
    if (!isAllowed(requested, allowed)) {
      return { ok: false, error: "model_not_allowed" }
    }
    return { ok: true, model: requested }
  }

  const chain = [
    policy.defaultModel,
    platformDefault,
    ...policy.fallbackModels,
  ].filter((m): m is string => Boolean(m))

  const picked = chain.find((m) => isAllowed(m, allowed))
  if (!picked) {
    return { ok: false, error: chain.length > 0 ? "model_not_allowed" : "no_model" }
  }
  return { ok: true, model: picked }
}

export function configToModelPolicy(config: {
  defaultModel?: string
  allowedModels?: string[]
  fallbackModels?: string[]
  allowEndUserModelSelection?: boolean
} | null | undefined): ChatModelPolicy {
  if (!config) return { ...UNRESTRICTED_MODEL_POLICY }
  return {
    ...(config.defaultModel ? { defaultModel: config.defaultModel } : {}),
    allowedModels: config.allowedModels ?? [],
    fallbackModels: config.fallbackModels ?? [],
    allowEndUserModelSelection: config.allowEndUserModelSelection !== false,
  }
}
