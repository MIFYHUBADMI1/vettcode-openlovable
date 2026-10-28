import { PrivacyAnalytics } from "@/components/privacy-analytics"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import Script from "next/script"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { CreditGateProvider } from "@/components/billing/credit-gate-provider"
import { Toaster } from "@/components/ui/sonner"
import { SITE_URL } from "@/lib/env"
import "./globals.css"

// Local fonts keep compilation independent of Google Fonts availability.
const jakarta = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
})
const geistMono = localFont({
  src: "../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Atai | Start, Run & Grow Your Own Business with AI Teams",
    template: "%s | Atai",
  },
  description:
    "Start, run, and grow your own online business with Atai's specialized AI teams. Get help with planning, hosting, daily operations, marketing, and reaching customers.",
  applicationName: "Atai",
  keywords: ["Atai", "Atai.ink", "AI business builder", "AI business teams", "start an online business", "business management", "ATAI Enterprises"],
  verification: {
    google: "fVuc4AOfzEAxCg2a5vgQ967z_AGcs2MbUn6QUjl70b4",
    other: { "pressplaced-verification": "fc52a89ec5ab0207" },
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Atai",
    title: "Atai | Start, Run & Grow Your Own Business with AI Teams",
    description: "Your business. Your AI teams. Get help with planning, your website or product, hosting, daily operations, and reaching customers.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai — AI teams for your business" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atai | Start, Run & Grow Your Own Business with AI Teams",
    description: "Your business. Your AI teams. Get help with planning, your website or product, hosting, daily operations, and reaching customers.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai — AI teams for your business" }],
  },
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
  authors: [{ name: "ATAI Enterprises", url: "https://atai.ink" }],
  creator: "ATAI Enterprises",
  publisher: "ATAI Enterprises",
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#252525" },
  ],
}

// Theme initialisation script — runs before first paint to avoid FOUC.
// Uses next/script with strategy="beforeInteractive" to ensure the script
// executes before React hydration. In React 19, raw <script> tags inside
// components trigger a warning and may not execute reliably during hydration.
const THEME_INIT_SCRIPT = `(function(){try{
var T=["system","dark","light","light-blue","glass"];
var s=localStorage.getItem("atai:theme");
var t=(s&&T.indexOf(s)!==-1)?s:"system";
var d=window.matchMedia("(prefers-color-scheme: dark)").matches;
var r=document.documentElement;
r.classList.remove("dark","theme-glass","theme-light-blue");
if(t==="dark"||(t==="system"&&d)){r.classList.add("dark")}
else if(t==="light-blue"){r.classList.add("theme-light-blue")}
else if(t==="glass"){r.classList.add("theme-glass")}
}catch(e){}})();`

const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "ATAI Enterprises",
      legalName: "ATAI Enterprises",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.png`,
        width: 1280,
        height: 1280,
      },
      description: "The company behind Atai, helping more people start, run, and grow online businesses with specialized AI teams.",
      founder: {
        "@type": "Person",
        "@id": `${SITE_URL}/founder#person`,
        name: "Masereka Adorable Kimulya",
        url: `${SITE_URL}/founder`,
      },
      email: "support@atai.ink",
      telephone: "+256761819885",
      sameAs: [
        "https://www.youtube.com/@mirrorsiteai",
        "https://github.com/atai-group",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+256761819885",
        contactType: "Customer Support",
        email: "support@atai.ink",
        availableLanguage: ["English"],
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Atai",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "AI Business Builder",
      operatingSystem: "Web",
      url: SITE_URL,
      description: "Atai helps people start, run, manage, and grow online businesses with specialized AI teams. Plan an offer, create and host the website or product it needs, manage daily operations, and work on marketing and reaching customers.",
      image: `${SITE_URL}/og-image.png`,
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      provider: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "Business planning with an AI co-founder",
        "Market research and offer development",
        "Websites and digital products for your business",
        "Hosting, customer accounts, and databases",
        "Daily business management",
        "Customer and payment tools",
        "Marketing, analytics, and growth support",
      ],
    },
    {
      "@type": "Product",
      "@id": `${SITE_URL}/#product`,
      name: "Atai SDK",
      description: "The unified developer SDK that powers Atai's business-building platform. Access 40+ infrastructure services through one API: AI, payments, maps, messaging, and more.",
      brand: { "@id": `${SITE_URL}/#organization` },
      manufacturer: { "@id": `${SITE_URL}/#organization` },
      category: "Software Development Kit",
      offers: {
        "@type": "Offer",
        url: `${SITE_URL}/developers`,
        priceCurrency: "USD",
        price: "0",
        availability: "https://schema.org/InStock",
        seller: { "@id": `${SITE_URL}/#organization` },
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Atai",
      description: "Start, run, and grow your own online business with specialized AI teams.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/docs?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
}).replace(/</g, "\\u003c")

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning lang="en" className={`bg-background ${jakarta.variable} ${geistMono.variable}`}>
      <head>
        {/* Theme initialization script - runs before first paint to avoid FOUC */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }}
        />
        {/* Font Awesome — required for database UI icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <CreditGateProvider>
              {children}
              <Toaster />
            </CreditGateProvider>
          </AuthProvider>
        </ThemeProvider>

        {process.env.NODE_ENV === "production" && <PrivacyAnalytics />}
      </body>
    </html>
  )
}
