import { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/env"

/**
 * Public sitemap for Atai.ink — business-building platform first.
 * Only include routes that exist and should be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL
  const now = new Date()

  const pages: Array<{
    path: string
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
    priority: number
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/start", changeFrequency: "weekly", priority: 0.95 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/about", changeFrequency: "monthly", priority: 0.85 },
    { path: "/explore", changeFrequency: "daily", priority: 0.8 },
    { path: "/resources", changeFrequency: "weekly", priority: 0.8 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.75 },
    { path: "/developers", changeFrequency: "weekly", priority: 0.7 },
    { path: "/sdk", changeFrequency: "weekly", priority: 0.65 },
    { path: "/modes-comparison", changeFrequency: "monthly", priority: 0.6 },
    { path: "/feature-requests", changeFrequency: "weekly", priority: 0.55 },
    { path: "/new", changeFrequency: "monthly", priority: 0.55 },
    { path: "/login", changeFrequency: "yearly", priority: 0.4 },
    { path: "/register", changeFrequency: "yearly", priority: 0.45 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.4 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.4 },
    { path: "/refund-policy", changeFrequency: "monthly", priority: 0.35 },
    { path: "/database-terms", changeFrequency: "monthly", priority: 0.3 },
  ]

  return pages.map((page) => ({
    url: page.path === "/" ? baseUrl : `${baseUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))
}
