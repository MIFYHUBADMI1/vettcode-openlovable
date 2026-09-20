/**
 * Curated model catalog shown in the founder Control Center.
 *
 * These are OpenRouter model ids the owner may pin as default / allowlist.
 * Presence here is NOT a live-availability promise — the provider call still
 * decides. Pricing is Atai runtime billing, never a fabricated $/1K table.
 */

export interface RuntimeModelCatalogEntry {
  id: string
  label: string
  family: string
}

export const RUNTIME_MODEL_CATALOG: readonly RuntimeModelCatalogEntry[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", family: "OpenAI" },
  { id: "openai/gpt-4o", label: "GPT-4o", family: "OpenAI" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", family: "OpenAI" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", family: "Anthropic" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", family: "Anthropic" },
  { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash", family: "Google" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", family: "Google" },
]

const CATALOG_IDS = new Set(RUNTIME_MODEL_CATALOG.map((m) => m.id))

/** Valid OpenRouter-style model identifier (matches the chat input contract). */
export const MODEL_ID_PATTERN = /^[\w./:-]+$/

export function isValidModelId(id: string): boolean {
  return id.length >= 1 && id.length <= 200 && MODEL_ID_PATTERN.test(id)
}

export function isKnownCatalogModel(id: string): boolean {
  return CATALOG_IDS.has(id)
}

/**
 * Catalog plus the platform default when it is not already listed, so the
 * founder can always see (and pin) whatever OPENROUTER_DEFAULT_MODEL is.
 */
export function visibleModelCatalog(platformDefault?: string): RuntimeModelCatalogEntry[] {
  const list = [...RUNTIME_MODEL_CATALOG]
  if (platformDefault && isValidModelId(platformDefault) && !CATALOG_IDS.has(platformDefault)) {
    list.unshift({
      id: platformDefault,
      label: platformDefault,
      family: "Platform default",
    })
  }
  return list
}
