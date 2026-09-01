import type { MetadataRoute } from "next"

const baseUrl = "https://mirrorsiteai.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/about", "/resources", "/privacy", "/terms"].map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }))
}
