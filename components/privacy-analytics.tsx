"use client"

import { Analytics } from "@vercel/analytics/next"
import { usePathname } from "next/navigation"

export function PrivacyAnalytics() {
  const pathname = usePathname()
  if (/^\/(reset-password|forgot-password|verify-email|confirm-email-change|api\/auth)(\/|$)/.test(pathname ?? "")) return null
  return <Analytics beforeSend={(event) => {
    const url = new URL(event.url)
    if (/^\/(reset-password|forgot-password|verify-email|confirm-email-change|api\/auth)(\/|$)/.test(url.pathname)) return null
    url.search = ""
    url.hash = ""
    return { ...event, url: url.toString() }
  }} />
}
