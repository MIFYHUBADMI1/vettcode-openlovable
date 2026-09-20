import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ArticleBody } from "@/components/resources/article-body"
import { ResourceCard } from "@/components/resources/resource-card"
import { AuthTrigger } from "@/components/auth/auth-trigger"
import { buttonVariants } from "@/components/ui/button"
import { SITE_URL } from "@/lib/env"
import {
  CATEGORY_META,
  TYPE_LABEL,
  allResources,
  getResource,
  relatedResources,
  summarize,
} from "@/lib/resources"
import { cn } from "@/lib/utils"

export function generateStaticParams() {
  return allResources().map((resource) => ({
    category: resource.category,
    slug: resource.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}): Promise<Metadata> {
  const { category, slug } = await params
  const resource = getResource(category, slug)
  if (!resource) return {}
  const url = `/resources/${resource.category}/${resource.slug}`
  return {
    title: `${resource.title} | Atai Resources`,
    description: resource.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: resource.title,
      description: resource.description,
      url: `${SITE_URL}${url}`,
      siteName: "Atai",
      publishedTime: resource.publishedAt,
      modifiedTime: resource.updatedAt,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: resource.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: resource.title,
      description: resource.description,
      images: ["/og-image.png"],
    },
  }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default async function ResourceArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params
  const resource = getResource(category, slug)
  if (!resource) notFound()

  const related = relatedResources(resource).map(summarize)
  const headings = resource.body.filter((block) => block.type === "h2")
  const url = `${SITE_URL}/resources/${resource.category}/${resource.slug}`
  const howToSteps = resource.body.flatMap((block) => (block.type === "ol" ? block.items : []))
  const faqItems = resource.body.flatMap((block) => (block.type === "faq" ? block.items : []))
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: resource.title,
      description: resource.description,
      datePublished: resource.publishedAt,
      dateModified: resource.updatedAt,
      author: { "@type": "Organization", name: "Atai" },
      publisher: { "@type": "Organization", name: "Atai", url: SITE_URL },
      url,
      articleSection: CATEGORY_META[resource.category].label,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Resources", item: `${SITE_URL}/resources` },
        { "@type": "ListItem", position: 2, name: CATEGORY_META[resource.category].label, item: `${SITE_URL}/resources/${resource.category}` },
        { "@type": "ListItem", position: 3, name: resource.title, item: url },
      ],
    },
  ]
  if (howToSteps.length > 0 && (resource.type === "tutorial" || resource.type === "checklist" || resource.title.startsWith("How to"))) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: resource.title,
      description: resource.description,
      step: howToSteps.map((name, position) => ({
        "@type": "HowToStep",
        position: position + 1,
        name,
        text: name,
      })),
    })
  }
  if (faqItems.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    })
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader activePage="/resources" />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:px-10">
        <article>
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <ol className="flex flex-wrap gap-2">
              <li><Link href="/resources" className="hover:text-foreground">Resources</Link></li>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/resources/${resource.category}`} className="hover:text-foreground">
                  {CATEGORY_META[resource.category].label}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-foreground">{resource.title}</li>
            </ol>
          </nav>

          <header className="mt-6 border-b border-border pb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {CATEGORY_META[resource.category].label} · {TYPE_LABEL[resource.type]}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-black tracking-tight sm:text-4xl">{resource.title}</h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground">{resource.description}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {resource.readingMinutes} min read · Written by Atai · Updated {formatDate(resource.updatedAt)}
            </p>
          </header>

          {headings.length > 0 ? (
            <details className="mt-6 rounded-2xl border border-border bg-card p-4 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">On this page</summary>
              <ol className="mt-3 space-y-2 text-sm">
                {headings.map((heading) => (
                  heading.type === "h2" ? (
                    <li key={heading.id}>
                      <a href={`#${heading.id}`} className="text-muted-foreground hover:text-foreground">{heading.text}</a>
                    </li>
                  ) : null
                ))}
              </ol>
            </details>
          ) : null}

          <div className="mt-8 max-w-2xl">
            <ArticleBody blocks={resource.body} />
          </div>

          {related.length > 0 ? (
            <section className="mt-14">
              <h2 className="text-lg font-semibold">Related resources</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {related.map((item) => (
                  <ResourceCard key={item.href} resource={item} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-12 rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Ready to put this into practice?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Atai helps you turn ideas into full-stack products with planning, collaboration, and infrastructure ready to launch.
            </p>
            <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants(), "mt-4")}>
              Try Atai
            </AuthTrigger>
          </section>
        </article>

        {headings.length > 0 ? (
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">On this page</p>
              <ol className="mt-3 space-y-2 text-sm">
                {headings.map((heading) => (
                  heading.type === "h2" ? (
                    <li key={heading.id}>
                      <a href={`#${heading.id}`} className="text-muted-foreground hover:text-foreground">{heading.text}</a>
                    </li>
                  ) : null
                ))}
              </ol>
            </div>
          </aside>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  )
}
