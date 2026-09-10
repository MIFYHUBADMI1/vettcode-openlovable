import type { Metadata } from "next"
import { SITE_URL } from "@/lib/env"
import { DocsContent } from "@/components/docs-content"

export const metadata: Metadata = {
  title: "MirrorSite AI Documentation | Guides, Tutorials & Help",
  description:
    "Complete guide to MirrorSite AI. Learn how to turn websites and ideas into working applications, manage projects, publish to custom domains, and get the most out of every feature.",
  alternates: { canonical: "/docs" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/docs`,
    siteName: "MirrorSite AI",
    title: "MirrorSite AI Documentation | Guides, Tutorials & Help",
    description:
      "Complete guide to MirrorSite AI. Learn how to turn websites and ideas into working applications.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Documentation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI Documentation | Guides, Tutorials & Help",
    description: "Complete guide to MirrorSite AI — tutorials, guides, and help.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Documentation" }],
  },
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <DocsContent />
    </main>
  )
}
