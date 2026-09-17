import type { Metadata } from "next"
import { SITE_URL } from "@/lib/env"
import { DocsContent } from "@/components/docs-content"

export const metadata: Metadata = {
  title: "Atai Documentation | Guides, Tutorials & Help",
  description:
    "Complete guide to Atai. Learn how to turn websites and ideas into working applications, manage projects, publish to custom domains, and get the most out of every feature.",
  alternates: { canonical: "/docs" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/docs`,
    siteName: "Atai",
    title: "Atai Documentation | Guides, Tutorials & Help",
    description:
      "Complete guide to Atai. Learn how to turn websites and ideas into working applications.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai Documentation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atai Documentation | Guides, Tutorials & Help",
    description: "Complete guide to Atai — tutorials, guides, and help.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai Documentation" }],
  },
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <DocsContent />
    </main>
  )
}
