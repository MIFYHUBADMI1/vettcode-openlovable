export const FEATURE_REQUEST_CATEGORIES = [
  { id: "ai", label: "AI & Agents" },
  { id: "builder", label: "Builder" },
  { id: "collaboration", label: "Collaboration" },
  { id: "runtime", label: "Runtime" },
  { id: "deployment", label: "Launch" },
  { id: "integrations", label: "Integrations" },
  { id: "data", label: "Data" },
  { id: "billing", label: "Billing" },
  { id: "analytics", label: "Analytics" },
  { id: "ux", label: "UX & Design" },
  { id: "mobile", label: "Mobile" },
  { id: "other", label: "Other" },
] as const

export type FeatureRequestCategory = (typeof FEATURE_REQUEST_CATEGORIES)[number]["id"]

export const FEATURE_REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "declined",
  "duplicate",
] as const

export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number]

export const STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  planned: "Planned",
  in_progress: "We're building this",
  shipped: "Shipped",
  declined: "Declined",
  duplicate: "Already requested",
}

export function isFeatureRequestCategory(value: string): value is FeatureRequestCategory {
  return FEATURE_REQUEST_CATEGORIES.some((c) => c.id === value)
}

export function isFeatureRequestStatus(value: string): value is FeatureRequestStatus {
  return (FEATURE_REQUEST_STATUSES as readonly string[]).includes(value)
}

export function categoryLabel(id: string): string {
  return FEATURE_REQUEST_CATEGORIES.find((c) => c.id === id)?.label ?? "Other"
}

/** Token overlap used for duplicate suggestions (no AI). */
export function similarScore(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap += 1
  return overlap / Math.max(ta.size, tb.size)
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  )
}
