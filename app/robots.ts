import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/env"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/pricing", "/about", "/resources", "/database-terms", "/privacy", "/terms", "/refund-policy"],
        disallow: ["/api/", "/dashboard", "/workspace", "/project/", "/admin", "/account", "/settings", "/login", "/register", "/new/", "/forgot-password", "/verify-email", "/confirm-email-change", "/referrals"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
