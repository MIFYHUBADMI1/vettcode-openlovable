/**
 * Campaign UTM link conventions (Phase 6 — W5).
 *
 * A PURE helper: it only builds and validates tracking-link strings from a
 * founder-supplied base URL. It performs NO network request, writes NOTHING to
 * the database, and does NOT touch the checkout or webhook payloads — the
 * attribution branch is money-gated and deferred (see the Phase-6 report). The
 * output is just a URL a founder can copy and use themselves.
 */

/** Channels → a conventional `utm_medium`. Label only; nothing sends on them. */
const CHANNEL_UTM_MEDIUM: Record<string, string> = {
  email: "email",
  social: "social",
  content: "content",
  seo: "organic",
  referral: "referral",
  other: "other",
}

export function channelToUtmMedium(channel: string): string {
  return CHANNEL_UTM_MEDIUM[channel] ?? "other"
}

/**
 * Turn a campaign name into a stable, URL-safe `utm_campaign` slug. Lower-cases,
 * collapses runs of non-alphanumerics into single hyphens, and trims edge
 * hyphens. Returns "" for input with no usable characters.
 */
export function slugify(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

export interface TrackedLinkParams {
  utmSource: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
}

export interface TrackedLinkResult {
  /** The built URL, or null when the base URL is not a usable absolute http(s) URL. */
  url: string | null
  /** Present only when `url` is null — a short, non-sensitive reason for the UI. */
  reason?: string
}

/**
 * Append UTM params to an absolute http(s) base URL. Existing query params and
 * the fragment are preserved; a param supplied empty/undefined is omitted.
 * Never throws — invalid bases return `{ url: null, reason }` so callers can
 * show an honest "not a usable link" state rather than a fabricated URL.
 */
export function buildTrackedUrl(baseUrl: string, params: TrackedLinkParams): TrackedLinkResult {
  let parsed: URL
  try {
    parsed = new URL((baseUrl ?? "").trim())
  } catch {
    return { url: null, reason: "Base URL is not valid" }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: null, reason: "Base URL must be http(s)" }
  }

  const entries: Array<[string, string | undefined]> = [
    ["utm_source", params.utmSource],
    ["utm_medium", params.utmMedium],
    ["utm_campaign", params.utmCampaign],
    ["utm_term", params.utmTerm],
    ["utm_content", params.utmContent],
  ]
  for (const [key, value] of entries) {
    const trimmed = typeof value === "string" ? value.trim() : ""
    if (trimmed) parsed.searchParams.set(key, trimmed)
  }

  return { url: parsed.toString() }
}
