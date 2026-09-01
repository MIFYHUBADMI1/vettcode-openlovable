import type { MetadataRoute } from "next"

const baseUrl = "https://mirrorsiteai.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/pricing", "/about", "/resources", "/database-terms", "/privacy", "/terms"], disallow: ["/api/", "/dashboard", "/workspace", "/project/", "/admin", "/account", "/settings", "/login", "/register"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
