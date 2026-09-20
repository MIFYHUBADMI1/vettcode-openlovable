import type { StartMode } from "@/lib/start/detect-input"

export const FIRST_MISSION_DRAFT_KEY = "atai:first-mission-draft"

export type OnboardingSource =
  | "landing_idea"
  | "landing_mirror"
  | "landing_url"
  | "landing_github"
  | "dashboard_start"
  | "dashboard_idea"
  | "dashboard_mirror"
  | "dashboard_url"
  | "dashboard_github"
  | "direct_project_creation"

export type FirstMissionSurface = "hide" | "redirect-pending" | "mission" | "empty-cta"

export function sourceForMode(mode: StartMode, origin: "landing" | "dashboard" | "direct"): OnboardingSource {
  if (origin === "direct") return "direct_project_creation"
  const prefix = origin === "landing" ? "landing" : "dashboard"
  if (mode === "github") return `${prefix}_github`
  if (mode === "website") return `${prefix}_mirror`
  if (mode === "url") return `${prefix}_url`
  return `${prefix}_idea`
}

export function signalForMode(mode: StartMode): "url" | "idea" {
  return mode === "idea" ? "idea" : "url"
}

export function composeVision(vision: string, followUp?: string) {
  const main = vision.trim()
  const extra = followUp?.trim()
  if (!extra) return main
  return `${main}\n\nAdditional context: ${extra}`
}

export function needsFollowUp(mode: StartMode, vision: string): boolean {
  const text = vision.trim()
  if (!text) return false
  if (mode === "website" || mode === "url") {
    return /^https?:\/\//i.test(text) && text.split(/\s+/).length < 4
  }
  if (mode === "github") {
    return (/github\.com\//i.test(text) || /^[\w.-]+\/[\w.-]+$/.test(text)) && text.split(/\s+/).length < 4
  }
  if (/\b(for|restaurants?|founders?|students?|teachers?|clinics?|teams?|smb|small businesses?|freelancers?|parents?|shop(?:s|owners?)?)\b/i.test(text)) {
    return false
  }
  // Vague idea — one extra question. Enough detail → start.
  return text.length > 0 && text.length < 40
}

export function followUpPrompt(mode: StartMode): string {
  if (mode === "website" || mode === "url") return "What do you want this to become?"
  if (mode === "github") return "What are you trying to build or change?"
  return "Who are you building this for?"
}

export function resolveFirstMissionSurface(input: {
  isReady: boolean
  projectCount: number
  completedAt?: number
  dismissedAt?: number
  hasPendingStart: boolean
  forceMission?: boolean
}): FirstMissionSurface {
  if (!input.isReady) return "hide"
  if (input.projectCount > 0 || input.completedAt) return "hide"
  if (input.hasPendingStart) return "redirect-pending"
  if (input.forceMission) return "mission"
  if (input.dismissedAt) return "empty-cta"
  return "mission"
}
