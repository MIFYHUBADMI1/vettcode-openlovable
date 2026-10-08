import { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/env"

/**
 * Robots for search engines and AI crawlers.
 * Public marketing, docs, and developer pages are crawlable.
 * Authenticated product surfaces stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  const publicAllow = [
    "/",
    "/about",
    "/pricing",
    "/docs",
    "/developers",
    "/sdk",
    "/start",
    "/explore",
    "/resources",
    "/modes-comparison",
    "/feature-requests",
    "/new",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/database-terms",
    "/login",
    "/register",
    "/llms.txt",
  ]

  const privateDisallow = [
    "/api/",
    "/admin/",
    "/settings/",
    "/account",
    "/dashboard",
    "/projects",
    "/workspace",
    "/project/",
    "/billing/",
    "/finances",
    "/hosting",
    "/ads",
    "/market",
    "/competition",
    "/lessons",
    "/_next/",
  ]

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicAllow,
        disallow: privateDisallow,
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Claude-Web",
          "anthropic-ai",
          "Applebot-Extended",
          "PerplexityBot",
          "Bytespider",
          "Google-Extended",
          "CCBot",
        ],
        allow: publicAllow,
        disallow: privateDisallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
