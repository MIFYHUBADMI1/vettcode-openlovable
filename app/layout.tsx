import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import Script from "next/script"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { SITE_URL } from "@/lib/env"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Atai.ink | Turn your idea into a real business",
    template: "%s | Atai",
  },
  description:
    "Atai.ink is the AI business-building platform. Plan, build, launch, manage, and grow a digital business from an idea, a website, a URL, or a GitHub project.",
  applicationName: "Atai",
  keywords: ["Atai.ink", "AI business builder", "AI co-founder", "AI application builder", "founder platform", "plan mode", "MVP builder", "AI-powered web development"],
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
    title: "Atai.ink | Turn your idea into a real business",
    description: "Plan, build, launch, manage, and grow your digital business with Atai.ink. Powered by ATAI Enterprises.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai.ink — Turn your idea into a real business" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atai.ink | Turn your idea into a real business",
    description: "Plan, build, launch, manage, and grow your digital business with Atai.ink. Powered by ATAI Enterprises.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai.ink — Turn your idea into a real business" }],
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
// Kept as a plain string so Next.js can inject it correctly via next/script.
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
        url: `${SITE_URL}/logo.png`,
        width: 512,
        height: 512,
      },
      description: "The AI platform that turns ideas into real businesses. Plan, build, launch, manage, and grow digital businesses with AI.",
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
      description: "Atai.ink is the AI business-building platform. Turn ideas into real businesses through AI collaboration, automated building, deployment, and management. One platform for the entire business lifecycle.",
      image: `${SITE_URL}/og-image.png`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "500 free credits to start. Build your first business with no credit card required.",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "150",
        bestRating: "5",
        worstRating: "1",
      },
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      provider: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "AI co-founder collaboration for business planning",
        "Automated full-stack application generation",
        "One-click deployment with hosting and infrastructure",
        "Business management dashboard",
        "Customer and payment processing",
        "Analytics and growth tools",
        "Unified developer API for 40+ infrastructure services",
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
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        ratingCount: "200",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Atai",
      description: "Turn your idea into a real business with AI",
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
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Atai?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Atai is an AI business-building platform that helps founders turn ideas into real businesses. It acts as an AI co-founder, helping you plan, build, launch, manage, and grow digital businesses without needing technical expertise or a large team.",
          },
        },
        {
          "@type": "Question",
          name: "How much does Atai cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Atai offers 500 free credits to get started with no credit card required. After that, it's pay-as-you-go pricing based on usage. Planning costs 50-200 credits, building costs 2000-8000 credits depending on complexity.",
          },
        },
        {
          "@type": "Question",
          name: "Can developers use Atai's infrastructure?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes! The same unified infrastructure that powers Atai's business builder is available to developers through the Atai SDK. Access 40+ services including AI, payments, maps, messaging,auth,search,crawl and more through one API.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need coding experience to use Atai?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Atai is designed for founders and entrepreneurs without technical backgrounds. The AI collaborates with you to plan and build your business. However, developers can also use Atai's infrastructure through the SDK for their own projects.",
          },
        },
      ],
    },
  ],
})

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning lang="en" className={`bg-background ${jakarta.variable} ${geistMono.variable}`}>
      <head>
        {/* Font Awesome — required for database UI icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="font-sans antialiased">
        {/* Theme initialization script - runs before React hydration */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }}
        />

        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>

        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
