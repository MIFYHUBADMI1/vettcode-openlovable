import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  metadataBase: new URL("https://mirrorsiteai.vercel.app"),
  title: {
    default: "MirrorSite AI — Turn Websites & Ideas Into Working Apps",
    template: "%s | MirrorSite AI",
  },
  description:
    "Turn a website or idea into a working application with MirrorSite AI. Analyze structure, generate an editable build plan, and create a full-stack project you can continue developing.",
  applicationName: "MirrorSite AI",
  generator: "v0.app",
  keywords: ["AI website builder", "website to app", "design to code", "AI application builder"],
  verification: { google: "bbkrXgFBFqHI_aNH3QKoMBn22EHoa4kBZxmFRObvCIQ" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_UG",
    url: "https://mirrorsiteai.vercel.app",
    siteName: "MirrorSite AI",
    title: "MirrorSite AI — Turn Websites & Ideas Into Working Apps",
    description: "Turn a website or idea into a working full-stack application you can continue developing.",
    images: [{ url: "/hero/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI website-to-application workflow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI — Turn Websites & Ideas Into Working Apps",
    description: "Analyze a website or idea, create an editable build plan, and start with a working full-stack foundation.",
    images: ["/hero/og-image.png"],
  },
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
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
