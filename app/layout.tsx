import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { SITE_URL } from "@/lib/env"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MirrorSite AI | Automated Application & Site Builder",
    template: "%s | MirrorSite AI",
  },
  description:
    "Instant full-stack code and web generation powered by ATAI Enterprises. Turn websites and ideas into working applications with AI-powered planning, generation, and infrastructure.",
  applicationName: "MirrorSite AI",
  generator: "v0.app",
  keywords: ["AI website builder", "AI application builder", "full-stack app builder", "AI code generator", "website to app", "design to code", "rapid application development", "MVP builder", "AI-powered development"],
  verification: { google: "fVuc4AOfzEAxCg2a5vgQ967z_AGcs2MbUn6QUjl70b4" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "MirrorSite AI",
    title: "MirrorSite AI | Automated Application & Site Builder",
    description: "Instant full-stack code and web generation powered by ATAI Enterprises.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI — Automated application and site builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI | Automated Application & Site Builder",
    description: "Instant full-stack code and web generation powered by ATAI Enterprises.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI — Automated application and site builder" }],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  authors: [{ name: "ATAI Enterprises", url: "https://atai.ink" }],
  creator: "ATAI Enterprises",
  publisher: "ATAI Enterprises",
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.98 0.008 70)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.19 0.016 42)" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html suppressHydrationWarning lang="en" className={`dark bg-background ${jakarta.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                name: "MirrorSite AI",
                applicationCategory: "DeveloperApplication",
                operatingSystem: "Web",
                url: SITE_URL,
                description: "Instant full-stack code and web generation powered by ATAI Enterprises.",
                image: `${SITE_URL}/og-image.png`,
                brand: {
                  "@type": "Organization",
                  name: "ATAI Enterprises",
                  url: "https://atai.ink",
                },
                author: {
                  "@type": "Organization",
                  name: "ATAI Enterprises",
                  url: "https://atai.ink",
                },
                publisher: {
                  "@type": "Organization",
                  name: "ATAI Enterprises",
                  url: "https://atai.ink",
                  logo: `${SITE_URL}/favicon.png`,
                },
              }),
            }}
          />
          {children}
          <Toaster />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
