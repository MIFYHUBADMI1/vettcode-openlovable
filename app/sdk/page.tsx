import type { Metadata } from "next"
import { SITE_URL } from "@/lib/env"
import { SdkDocsContent } from "@/components/sdk-docs-content"

export const metadata: Metadata = {
  title: "Atai SDK & Runtime API Documentation | @atai/sdk",
  description:
    "Complete reference for the @atai/sdk and the Atai Runtime API: installation, API key setup and rotation, every capability and endpoint, error codes, rate limits, and security best practices for generated applications.",
  alternates: { canonical: "/sdk" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/sdk`,
    siteName: "Atai",
    title: "Atai SDK & Runtime API Documentation | @atai/sdk",
    description:
      "Complete reference for the @atai/sdk and the Atai Runtime API: installation, API keys, capabilities, endpoints, errors, and limits.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai SDK Documentation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atai SDK & Runtime API Documentation | @atai/sdk",
    description: "Complete reference for the @atai/sdk and the Atai Runtime API.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai SDK Documentation" }],
  },
}

export default function SdkDocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SdkDocsContent />
    </main>
  )
}
