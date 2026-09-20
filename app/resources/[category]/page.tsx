import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ResourceCard } from "@/components/resources/resource-card"
import { SITE_URL } from "@/lib/env"
import {
  CATEGORY_META,
  RESOURCE_CATEGORIES,
  isResourceCategory,
  resourcesByCategory,
  summarize,
} from "@/lib/resources"

export function generateStaticParams() {
  return RESOURCE_CATEGORIES.map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  if (!isResourceCategory(category)) return {}
  const meta = CATEGORY_META[category]
  return {
    title: `${meta.title} | Atai Resources`,
    description: meta.description,
    alternates: { canonical: `/resources/${category}` },
    openGraph: {
      title: `${meta.title} | Atai Resources`,
      description: meta.description,
      url: `${SITE_URL}/resources/${category}`,
      siteName: "Atai",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: meta.title }],
    },
  }
}

export default async function ResourceCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  if (!isResourceCategory(category)) notFound()
  const meta = CATEGORY_META[category]
  const resources = resourcesByCategory(category).map(summarize)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: meta.title,
    description: meta.description,
    url: `${SITE_URL}/resources/${category}`,
    isPartOf: { "@type": "WebSite", name: "Atai", url: SITE_URL },
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader activePage="/resources" />
      <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8 lg:px-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-2">
            <li><Link href="/resources" className="hover:text-foreground">Resources</Link></li>
            <li aria-hidden>/</li>
            <li className="text-foreground">{meta.label}</li>
          </ol>
        </nav>
        <header className="mt-6 max-w-2xl">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{meta.description}</p>
        </header>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <ResourceCard key={resource.href} resource={resource} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </main>
  )
}
