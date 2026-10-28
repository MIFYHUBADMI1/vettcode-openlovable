import { getAppUrl } from "@/lib/env"

const ALLOWED_RETURN_PATHS = new Set([
  "/settings/billing",
  "/start",
  "/dashboard",
  "/projects",
  "/account",
  "/pricing",
])

/** A founder top-ups credits in the middle of a build, an edit or a studio run,
 * so the return leg has to land back on the page they left — never on billing.
 * Project pages are matched by shape rather than added one by one: same origin,
 * no query, no hash, no `..`, no admin. */
const ALLOWED_PROJECT_RETURN =
  /^\/project\/[A-Za-z0-9][A-Za-z0-9_-]{0,119}(?:\/(?:collaborate|edit|plan|progress|studio|market|resources|finances|hosting|runtime|ads|campaigns|tasks|database|competition|intelligence|lessons|source|repo-code|readme|env|tree))?$/

export function checkoutReturnPath(value?: string | null): string {
  const fallback = "/settings/billing"
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.includes("://")) {
    return fallback
  }
  const path = value.split("?")[0]?.split("#")[0] ?? fallback
  if (path.includes("..")) return fallback
  if (ALLOWED_RETURN_PATHS.has(path)) return path
  return ALLOWED_PROJECT_RETURN.test(path) ? path : fallback
}

export function checkoutReturnUrl(value?: string | null): string {
  return `${getAppUrl()}${checkoutReturnPath(value)}`
}
