export type StartMode = "idea" | "website" | "url" | "github"

export type StartHref = "/new/idea" | "/new/website" | "/new/github"

export const START_HREF: Record<StartMode, StartHref> = {
  idea: "/new/idea",
  website: "/new/website",
  url: "/new/website",
  github: "/new/github",
}

const GITHUB_IN_TEXT =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?(?=[/?#\s]|$)/i
const URL_IN_TEXT = /(?:https?:\/\/|www\.)[^\s<>"']+/i

export function extractGithubRepo(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  const urlMatch = text.match(GITHUB_IN_TEXT)
  if (urlMatch) return `https://github.com/${urlMatch[1]}/${urlMatch[2]}`
  const short = text.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (short) return `${short[1]}/${short[2]}`
  return null
}

export function extractWebsiteUrl(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  const match = text.match(URL_IN_TEXT)
  if (!match) return null
  const raw = match[0].replace(/[),.;]+$/, "")
  if (/github\.com\//i.test(raw)) return null
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes(".")) return null
    return url.toString()
  } catch {
    return null
  }
}

export function detectStartMode(value: string): StartMode | null {
  const text = value.trim()
  if (!text) return null
  if (extractGithubRepo(text) && (/github\.com\//i.test(text) || /^[\w.-]+\/[\w.-]+$/.test(text))) {
    return "github"
  }
  if (extractWebsiteUrl(text)) return "url"
  return null
}

export type SplitLinkPrompt = { url: string; notes: string }

/**
 * Split a free-text start prompt into its link and the instruction around it,
 * for the two-field composer (URL input + instructions textarea). The composer
 * recombines as `url notes`, so downstream extraction stays unchanged.
 */
export function splitLinkPrompt(mode: StartMode, value: string): SplitLinkPrompt {
  const text = value.trim()
  if (!text) return { url: "", notes: "" }
  let match: RegExpMatchArray | null = null
  if (mode === "github") {
    match = text.match(GITHUB_IN_TEXT)
    if (!match) {
      const short = text.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)(?=\s|$)/)
      if (short) return { url: short[1], notes: text.slice(short[0].length).replace(/\s+/g, " ").trim() }
      return { url: "", notes: text }
    }
  } else if (mode === "website" || mode === "url") {
    match = text.match(URL_IN_TEXT)
    if (!match) return { url: "", notes: text }
  } else {
    return { url: "", notes: text }
  }
  const index = match.index ?? 0
  const url = /^https?:\/\//i.test(match[0]) ? match[0] : `https://${match[0]}`
  const notes = (text.slice(0, index) + " " + text.slice(index + match[0].length))
    .replace(/^\s*[—–:\-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
  return { url, notes }
}

export function combineLinkPrompt(url: string, notes: string): string {
  const u = url.trim()
  const n = notes.trim()
  if (!u) return n
  return n ? `${u} ${n}` : u
}

export function promptForStart(mode: StartMode, value: string): string {
  return value.trim()
}

export type IntentChip = {
  id: string
  label: string
}

export function detectIntentChips(value: string, mode: StartMode): IntentChip[] {
  const text = value.trim()
  if (!text) return []
  const chips: IntentChip[] = []
  const github = extractGithubRepo(text)
  const website = extractWebsiteUrl(text)

  if (github) chips.push({ id: "github", label: "GitHub repository detected" })
  else if (website) chips.push({ id: "url", label: "Website detected" })

  if (/\b(research|competitor|market)\b/i.test(text)) chips.push({ id: "research", label: "Research" })
  if (/\b(mvp|build|scaffold|create)\b/i.test(text)) chips.push({ id: "build", label: "Build" })
  if (/\b(analy[sz]e|understand|audit)\b/i.test(text)) chips.push({ id: "analyze", label: "Analyze" })
  if (mode === "idea" && /\b(marketplace|saas|booking|portal)\b/i.test(text)) {
    chips.push({ id: "product", label: "Product" })
  }

  const seen = new Set<string>()
  return chips.filter((chip) => {
    if (seen.has(chip.id)) return false
    seen.add(chip.id)
    return true
  }).slice(0, 3)
}

export function validateStartInput(mode: StartMode, value: string): string | null {
  const text = value.trim()
  if (!text) return "Tell Atai what you'd like to build first."
  if (mode === "github" && !extractGithubRepo(text)) {
    return "That doesn't look like a valid GitHub repository URL. Check the link and try again."
  }
  if ((mode === "website" || mode === "url") && !extractWebsiteUrl(text)) {
    return "Please enter a valid website URL."
  }
  if (mode === "idea" && text.length < 8) {
    return "Add a little more detail so Atai can understand the idea."
  }
  return null
}

/**
 * Draft a project title from the typed intent (first few meaningful words).
 * Only a starting point — the composer requires the user to confirm or edit
 * it before the request can be sent, so no project is ever silently named
 * from a sentence fragment.
 */
export function suggestProjectTitle(mode: StartMode, value: string): string {
  const text = value.trim()
  if (!text) return ""
  if (mode === "github") {
    const repo = extractGithubRepo(text)
    if (repo) {
      const name = repo
        .replace(/^https:\/\/github\.com\//, "")
        .split("/")
        .filter(Boolean)[1]
      if (name) return name.replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase())
    }
  }
  const base = text.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim()
  if (!base) return ""
  const words = base.split(" ").slice(0, 6).join(" ")
  const titled = words.replace(/\b\w/g, (c) => c.toUpperCase())
  return titled.length > 60 ? `${titled.slice(0, 57)}…` : titled
}

export const MIN_PROJECT_TITLE_LENGTH = 3
export const MAX_PROJECT_TITLE_LENGTH = 80

/** Shared gate: the user-confirmed project title before anything is stored. */
export function validateProjectTitle(title: string): string | null {
  const t = title.trim()
  if (!t) return "Give your project a name first — it becomes your workspace title."
  if (t.length < MIN_PROJECT_TITLE_LENGTH) return "That name is a bit short — use at least 3 characters."
  if (t.length > MAX_PROJECT_TITLE_LENGTH) return `Keep the name under ${MAX_PROJECT_TITLE_LENGTH} characters.`
  return null
}
