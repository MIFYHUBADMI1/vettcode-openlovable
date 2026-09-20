import type { StartMode } from "@/lib/start/detect-input"

export const COMPOSER_PREFS_KEY = "atai:landing-composer"

export type ComposerAttachment = {
  id: string
  name: string
  size: number
}

export type ComposerPrefs = {
  prompt: string
  mode: StartMode
  agents: string[]
  tool: string | null
  auto: string
  files: ComposerAttachment[]
}

export const DEFAULT_COMPOSER_PREFS: ComposerPrefs = {
  prompt: "",
  mode: "idea",
  agents: ["atai"],
  tool: null,
  auto: "auto",
  files: [],
}

export function loadComposerPrefs(): ComposerPrefs {
  if (typeof window === "undefined") return DEFAULT_COMPOSER_PREFS
  try {
    const raw = sessionStorage.getItem(COMPOSER_PREFS_KEY)
    if (!raw) return DEFAULT_COMPOSER_PREFS
    const parsed = JSON.parse(raw) as Partial<ComposerPrefs>
    return {
      ...DEFAULT_COMPOSER_PREFS,
      ...parsed,
      agents: Array.isArray(parsed.agents) && parsed.agents.length > 0 ? parsed.agents : ["atai"],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    }
  } catch {
    return DEFAULT_COMPOSER_PREFS
  }
}

export function saveComposerPrefs(prefs: ComposerPrefs) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(COMPOSER_PREFS_KEY, JSON.stringify(prefs))
}
