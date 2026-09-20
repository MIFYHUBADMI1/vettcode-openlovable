import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ResourcesHub } from "@/components/resources/hub"
import { AuthTrigger } from "@/components/auth/auth-trigger"
import { buttonVariants } from "@/components/ui/button"
import { SITE_URL } from "@/lib/env"
import { allSummaries, featuredResource, summarize } from "@/lib/resources"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Atai Resources | Guides, playbooks, and templates for founders",
  description:
    "Practical guides, playbooks, templates, and Atai product education for turning ideas into real products and businesses.",
  alternates: { canonical: "/resources" },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Atai Resources",
    description: "Practical knowledge for founders, builders, and people using Atai to create and grow products.",
    url: `${SITE_URL}/resources`,
    siteName: "Atai",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai resources" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atai Resources",
    description: "Guides, playbooks, and templates for building, launching, and growing a product.",
    images: ["/og-image.png"],
  },
}

export default function ResourcesPage() {
  const resources = allSummaries()
  const featured = summarize(featuredResource())
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Atai Resources",
    description: metadata.description,
    url: `${SITE_URL}/resources`,
    isPartOf: { "@type": "WebSite", name: "Atai", url: SITE_URL },
    hasPart: resources.map((resource) => ({
      "@type": "TechArticle",
      headline: resource.title,
      url: `${SITE_URL}${resource.href}`,
      datePublished: resource.publishedAt,
      dateModified: resource.updatedAt,
    })),
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader activePage="/resources" />
      <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8 lg:px-10">
        <header className="max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Resources</p>
          <h1 className="mt-3 text-balance text-3xl font-black tracking-tight sm:text-5xl">
            Build smarter. Launch faster. Grow with clarity.
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Practical guides, playbooks, templates, and product education for turning ideas into real products — including how to use Atai.
          </p>
        </header>

        <div className="mt-10">
          <ResourcesHub resources={resources} featured={featured} />
        </div>

        <section className="mt-16 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Can&apos;t find what you&apos;re looking for?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Search the library, pick a category, or start a project in Atai and learn by doing.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/docs" className={cn(buttonVariants({ variant: "outline" }))}>Read the docs</Link>
            <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants())}>
              Try Atai
            </AuthTrigger>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
