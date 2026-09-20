import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/env"
import { RESOURCE_CATEGORIES, allResources, resourceHref } from "@/lib/resources"

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.9 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/resources", changeFrequency: "weekly", priority: 0.8 },
    { path: "/database-terms", changeFrequency: "monthly", priority: 0.4 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.5 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.5 },
    { path: "/refund-policy", changeFrequency: "yearly", priority: 0.4 },
    ...RESOURCE_CATEGORIES.map((category) => ({
      path: `/resources/${category}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...allResources().map((resource) => ({
      path: resourceHref(resource),
      changeFrequency: "monthly" as const,
      priority: resource.featured ? 0.75 : 0.65,
    })),
  ]

  return pages.map(({ path, changeFrequency, priority }) => {
    const resource = allResources().find((item) => resourceHref(item) === path)
    return {
      url: `${SITE_URL}${path}`,
      changeFrequency,
      priority,
      lastModified: resource ? new Date(`${resource.updatedAt}T00:00:00`) : undefined,
    }
  })
}
