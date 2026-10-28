import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"
import { ABOUT_FAQ, AboutContent } from "./about-content"

const description = "Why Atai exists: helping more people start, run, and grow online businesses with AI teams. Meet founder Masereka Adorable Kimulya from Kasese, Uganda."

export const metadata: Metadata = {
  title: "About Atai: Our Mission, AI Teams & Founder",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/about`,
    siteName: "Atai",
    title: "About Atai: Our Mission, AI Teams & Founder",
    description,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai — AI teams for your business" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Atai: Our Mission, AI Teams & Founder",
    description,
    images: ["/og-image.png"],
  },
}

export default function AboutPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${SITE_URL}/about#webpage`,
        name: "About Atai: Our Mission, AI Teams & Founder",
        description,
        url: `${SITE_URL}/about`,
        inLanguage: "en",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        mentions: { "@id": `${SITE_URL}/founder#person` },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/about#questions`,
        mainEntity: ABOUT_FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <main className="workspace-environment min-h-svh overflow-x-clip bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />
        <SiteHeader activePage="/about" />
        <AboutContent />
        <SiteFooter activePage="/about" />
      </main>
    </>
  )
}
