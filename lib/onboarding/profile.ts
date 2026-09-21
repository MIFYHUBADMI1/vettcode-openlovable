export const ONBOARDING_SOURCES = [
  { id: "reddit", label: "Reddit" },
  { id: "friend", label: "Friend or colleague" },
  { id: "twitter", label: "X / Twitter" },
  { id: "youtube", label: "YouTube" },
  { id: "google", label: "Google search" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "producthunt", label: "Product Hunt" },
  { id: "other", label: "Somewhere else" },
] as const

export const ONBOARDING_ROLES = [
  { id: "founder", label: "Founder" },
  { id: "developer", label: "Developer" },
  { id: "designer", label: "Designer" },
  { id: "marketer", label: "Marketer / growth" },
  { id: "operator", label: "Operator / ops" },
  { id: "student", label: "Student" },
  { id: "other", label: "Something else" },
] as const

export const ONBOARDING_BUILDING = [
  { id: "url", label: "Website mirroring", hint: "Start from a live site or product you already know." },
  { id: "idea", label: "From scratch", hint: "Start from an idea, problem, or business in your own words." },
] as const

export const ONBOARDING_REVENUE_TARGETS = [
  { id: "exploring", label: "Just exploring", hint: "I'm here to learn and try Atai." },
  { id: "under_10k", label: "First $10k", hint: "Prove it can pay for itself." },
  { id: "10k_50k", label: "$10k–$50k / year", hint: "A serious side business." },
  { id: "50k_250k", label: "$50k–$250k / year", hint: "This should replace a salary." },
  { id: "250k_1m", label: "$250k–$1M / year", hint: "A real company, not a project." },
  { id: "1m_plus", label: "$1M+", hint: "I'm building to scale." },
  { id: "not_revenue", label: "Not about revenue", hint: "Impact, a tool, or something else." },
] as const

export const ONBOARDING_USER_TARGETS = [
  { id: "just_me", label: "Just me", hint: "A personal tool or first prototype." },
  { id: "under_100", label: "First 100 users", hint: "Friends, testers, early believers." },
  { id: "100_1k", label: "100–1,000", hint: "A small community that comes back." },
  { id: "1k_10k", label: "1,000–10,000", hint: "A product people actually depend on." },
  { id: "10k_100k", label: "10,000–100,000", hint: "A growing market." },
  { id: "100k_plus", label: "100,000+", hint: "A large audience." },
] as const

export const ONBOARDING_PACE = [
  { id: "light", label: "Nights and weekends", hint: "About an hour when I can.", effortScale: 3, hoursPerDay: "1" },
  { id: "steady", label: "A few hours most days", hint: "This is a real side project.", effortScale: 6, hoursPerDay: "2-3" },
  { id: "serious", label: "This is my main work", hint: "I'm putting founder hours into it.", effortScale: 9, hoursPerDay: "7-8" },
] as const

export const ONBOARDING_HOURS = [
  { id: "1", label: "About 1 hour / day" },
  { id: "2-3", label: "2–3 hours / day" },
  { id: "4-6", label: "4–6 hours / day" },
  { id: "7-8", label: "7–8 hours / day" },
  { id: "9+", label: "9+ hours / day" },
] as const

export const ONBOARDING_INTENTS = [
  { id: "ai_builder_only", label: "Build the product", hint: "I want Atai to generate and ship the app." },
  { id: "full_business_help", label: "Product and business", hint: "Help me with the product and how it should grow." },
] as const

export type OnboardingSourceId = (typeof ONBOARDING_SOURCES)[number]["id"]
export type OnboardingRoleId = (typeof ONBOARDING_ROLES)[number]["id"]
export type OnboardingBuildingId = (typeof ONBOARDING_BUILDING)[number]["id"]
export type OnboardingRevenueId = (typeof ONBOARDING_REVENUE_TARGETS)[number]["id"]
export type OnboardingUserTargetId = (typeof ONBOARDING_USER_TARGETS)[number]["id"]
export type OnboardingHoursId = (typeof ONBOARDING_HOURS)[number]["id"]
export type OnboardingIntentId = (typeof ONBOARDING_INTENTS)[number]["id"]

export type OnboardingProfileInput = {
  source?: string
  role?: string
  signalType?: "url" | "idea"
  businessDescription?: string
  businessGoal?: string
  revenueTarget?: string
  targetUsers?: string
  effortScale?: number
  hoursPerDay?: string
  intent?: string
  selectedPlanId?: string
}

const SOURCE_IDS = new Set(ONBOARDING_SOURCES.map((item) => item.id))
const ROLE_IDS = new Set(ONBOARDING_ROLES.map((item) => item.id))
const BUILDING_IDS = new Set(ONBOARDING_BUILDING.map((item) => item.id))
const REVENUE_IDS = new Set(ONBOARDING_REVENUE_TARGETS.map((item) => item.id))
const USER_TARGET_IDS = new Set(ONBOARDING_USER_TARGETS.map((item) => item.id))
const HOURS_IDS = new Set(ONBOARDING_HOURS.map((item) => item.id))
const INTENT_IDS = new Set(ONBOARDING_INTENTS.map((item) => item.id))

function pickId(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== "string") return undefined
  const id = value.trim()
  return allowed.has(id) ? id : undefined
}

export function parseOnboardingProfile(body: OnboardingProfileInput): OnboardingProfileInput {
  const effortRaw = typeof body.effortScale === "number" ? body.effortScale : Number(body.effortScale)
  const effortScale =
    Number.isInteger(effortRaw) && effortRaw >= 1 && effortRaw <= 10 ? effortRaw : undefined

  const businessGoal =
    typeof body.businessGoal === "string" ? body.businessGoal.trim().slice(0, 500) : undefined
  const businessDescription =
    typeof body.businessDescription === "string" ? body.businessDescription.trim().slice(0, 2000) : undefined
  const selectedPlanId =
    typeof body.selectedPlanId === "string" ? body.selectedPlanId.trim().slice(0, 64) : undefined

  return {
    source: pickId(body.source, SOURCE_IDS) ?? (typeof body.source === "string" ? body.source.trim().slice(0, 64) : undefined),
    role: pickId(body.role, ROLE_IDS),
    signalType: pickId(body.signalType, BUILDING_IDS) as "url" | "idea" | undefined,
    businessDescription: businessDescription || undefined,
    businessGoal: businessGoal || undefined,
    revenueTarget: pickId(body.revenueTarget, REVENUE_IDS),
    targetUsers: pickId(body.targetUsers, USER_TARGET_IDS),
    effortScale,
    hoursPerDay: pickId(body.hoursPerDay, HOURS_IDS),
    intent: pickId(body.intent, INTENT_IDS),
    selectedPlanId: selectedPlanId || undefined,
  }
}

export function labelFor(list: readonly { id: string; label: string }[], id?: string) {
  return list.find((item) => item.id === id)?.label ?? id ?? "—"
}
