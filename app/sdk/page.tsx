import type { Metadata } from "next"
import { SITE_URL } from "@/lib/env"
import { SdkDocsContent } from "@/components/sdk-docs-content"

export const metadata: Metadata = {
  title: "Atai SDK & API Reference | @atai-group/sdk",
  description:
    "Complete SDK and Runtime API reference for Atai. One API key for AI, payments, maps, messaging, auth, and 40+ infrastructure services that power the Atai business-building platform.",
  keywords: [
    "Atai SDK",
    "@atai-group/sdk",
    "Atai Runtime API",
    "unified API",
    "AI API",
    "developer SDK",
    "infrastructure API",
    "TypeScript SDK",
  ],
  alternates: { canonical: "/sdk" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/sdk`,
    siteName: "Atai",
    title: "Atai SDK & API Reference | @atai-group/sdk",
    description:
      "One typed client, one API key, every capability your application needs — AI, messaging, payments, maps, and more. Part of the Atai business-building platform.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai SDK & API Reference" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atai SDK & API Reference",
    description: "One API key for everything your application needs.",
    images: [{ url: "/og-image.png" }],
  },
}

export default function SDKPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SdkDocsContent />
    </main>
  )
}
