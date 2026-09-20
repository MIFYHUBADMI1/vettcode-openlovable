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
  "@type": "SoftwareApplication",
  name: "Atai",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: "Plan, build, launch, manage, and grow your digital business with Atai.ink. Powered by ATAI Enterprises.",
  image: `${SITE_URL}/og-image.png`,
  brand: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
  author: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
  publisher: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink", logo: `${SITE_URL}/favicon.png` },
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
        {/*
          Theme init — must run synchronously before first paint to avoid flash.
          strategy="beforeInteractive" injects as a blocking <script> in <head>,
          which is the only correct way in Next.js 16 App Router.
          AC 9: no hardcoded class on <html>. AC 10: suppressHydrationWarning above.
        */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />

        <ThemeProvider>
          {/* Schema.org structured data */}
          <Script
            id="structured-data"
            type="application/ld+json"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }}
          />
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
