import type { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"
import { AboutContent } from "./about-content"

/* ═══════════════════════════════════════════════════════════════
   METADATA
   ═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "About Atai | The AI Business-Building Platform",
  description:
    "Atai gives founders an AI co-founder, specialist teams, technology and infrastructure to turn ideas into real businesses — then build, launch, operate and scale them from one platform.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/about`,
    siteName: "Atai",
    title: "About Atai | The AI Business-Building Platform",
    description:
      "You bring the vision. Atai brings the team. From idea to business to growth.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "About Atai — The AI Business-Building Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Atai | The AI Business-Building Platform",
    description: "You bring the vision. Atai brings the team. From idea to business to growth.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "About Atai — The AI Business-Building Platform" }],
  },
}

/* ═══════════════════════════════════════════════════════════════
   PAGE (server shell — metadata only)
   ═══════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "About Atai",
            description: "Atai is the AI business-building platform that gives founders an AI co-founder, specialist teams, technology and infrastructure to turn ideas into real businesses.",
            url: `${SITE_URL}/about`,
            isPartOf: { "@type": "WebSite", name: "Atai", url: SITE_URL },
            about: {
              "@type": "Organization",
              name: "Atai",
              description: "AI-powered business-building platform for founders.",
              brand: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
            },
          }),
        }}
      />
      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />
        <SiteHeader activePage="/about" />
        <AboutContent />
        <SiteFooter activePage="/about" />
      </main>
    </>
  )
}
