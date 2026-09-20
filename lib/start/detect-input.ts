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
