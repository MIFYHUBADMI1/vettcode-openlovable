import type { Metadata } from "next";
import localFont from "next/font/local";
import SessionProvider from "@/components/providers/SessionProvider";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/Inter-Latin.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/Inter-LatinExt.woff2", style: "normal", weight: "100 900" },
  ],
  variable: "--font-inter",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const robotoMono = localFont({
  src: [
    { path: "./fonts/RobotoMono-Latin.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/RobotoMono-LatinExt.woff2", style: "normal", weight: "100 900" },
  ],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mirrorsiteai.vercel.app'),
  title: {
    default: "MirrorSite AI - Clone Any Website with AI | Website Builder",
    template: "%s | MirrorSite AI"
  },
  description: "Transform any website into your own with AI-powered design cloning. Clone websites, generate production-ready code, and customize designs in seconds. Built by ATAI Enterprises.",
  keywords: [
    "website cloning",
    "AI web design", 
    "code generation",
    "website builder",
    "web development",
    "AI website generator",
    "clone website",
    "website scraper",
    "design to code",
    "Uganda tech",
    "VettCode",
    "MirrorSite AI",
    "automated web development",
    "React code generator",
    "Next.js builder"
  ],
  authors: [{ name: "ATAI Enterprises" }, { name: "VettCode" }],
  creator: "ATAI Enterprises",
  publisher: "VettCode",
  category: "Technology",
  manifest: "/manifest.json",
  openGraph: {
    title: "MirrorSite AI - Clone Any Website with AI",
    description: "Transform any website into production-ready code with AI-powered design cloning. Fast, accurate, and customizable.",
    type: "website",
    locale: "en_UG",
    url: 'https://mirrorsiteai.vercel.app',
    siteName: "MirrorSite AI",
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'MirrorSite AI - AI-Powered Website Cloning'
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI - Clone Any Website with AI",
    description: "Transform any website into production-ready code with AI-powered design cloning.",
    images: ['/logo.png'],
    creator: "@vettcode"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://mirrorsiteai.vercel.app',
  },
  verification: {
    google: 'bbkrXgFBFqHI_aNH3QKoMBn22EHoa4kBZxmFRObvCIQ',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "MirrorSite AI",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web",
              "url": "https://mirrorsiteai.vercel.app",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "UGX",
                "availability": "https://schema.org/InStock",
                "priceSpecification": {
                  "@type": "UnitPriceSpecification",
                  "price": "1",
                  "priceCurrency": "UGX",
                  "referenceQuantity": {
                    "@type": "QuantitativeValue",
                    "value": "1",
                    "unitText": "token"
                  }
                }
              },
              "description": "AI-powered website cloning and code generation platform. Transform any website into production-ready code with advanced AI technology.",
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "1000"
              },
              "author": {
                "@type": "Organization",
                "name": "ATAI Enterprises",
                "url": "https://mirrorsiteai.vercel.app"
              },
              "publisher": {
                "@type": "Organization",
                "name": "VettCode",
                "url": "https://mirrorsiteai.vercel.app"
              }
            })
          }}
        />
      </head>
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} font-sans`}>
        <SessionProvider>
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
