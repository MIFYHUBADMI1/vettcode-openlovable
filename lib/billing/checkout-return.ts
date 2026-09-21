import { getAppUrl } from "@/lib/env"

const ALLOWED_RETURN_PATHS = new Set(["/settings/billing", "/start", "/dashboard"])

export function checkoutReturnPath(value?: string | null): string {
  const fallback = "/settings/billing"
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.includes("://")) {
    return fallback
  }
  const path = value.split("?")[0]?.split("#")[0] ?? fallback
  return ALLOWED_RETURN_PATHS.has(path) ? path : fallback
}

export function checkoutReturnUrl(value?: string | null): string {
  return `${getAppUrl()}${checkoutReturnPath(value)}`
}
