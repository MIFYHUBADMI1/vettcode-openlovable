import type { Metadata } from "next"
import Link from "next/link"
import { Code2, Download, BookOpen, Github, ArrowRight, Terminal, Package } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { SITE_URL } from "@/lib/env"

export const metadata: Metadata = {
  title: "Atai SDK | Infrastructure behind the business builder",
  description: "Download the Atai SDK for TypeScript, Python, Go, and more. One unified API key for AI, payments, maps, messaging, authentication, and 40+ infrastructure services.",
  keywords: ["Atai SDK", "unified API", "developer SDK", "API download", "TypeScript SDK", "Python SDK", "infrastructure API"],
  alternates: { canonical: "/sdk" },
  openGraph: {
    title: "Atai SDK | Infrastructure behind the business builder",
    description: "Download the SDK and start building with the unified API that handles all your infrastructure needs.",
    type: "website",
    url: `${SITE_URL}/sdk`,
  },
}

const SDK_PACKAGES = [
  {
    name: "TypeScript / JavaScript",
    package: "@atai-group/sdk",
    install: "npm install @atai-group/sdk",
    status: "Stable",
    version: "1.0.0",
    downloads: "NPM",
    link: "https://www.npmjs.com/package/@atai-group/sdk",
  },
  {
    name: "Python",
    package: "atai",
    install: "pip install atai",
    status: "Stable",
    version: "1.0.0",
    downloads: "PyPI",
    link: "https://pypi.org/project/atai/",
  },
  {
    name: "Go",
    package: "github.com/atai-group/atai-go",
    install: "go get github.com/atai-group/atai-go",
    status: "Beta",
    version: "0.9.0",
    downloads: "Go Modules",
    link: "https://pkg.go.dev/github.com/atai-group/atai-go",
  },
  {
    name: "Ruby",
    package: "atai",
    install: "gem install atai",
    status: "Beta",
    version: "0.9.0",
    downloads: "RubyGems",
    link: "https://rubygems.org/gems/atai",
  },
  {
    name: "PHP",
    package: "atai/sdk",
    install: "composer require atai/sdk",
    status: "Beta",
    version: "0.8.0",
    downloads: "Packagist",
    link: "https://packagist.org/packages/atai/sdk",
  },
  {
    name: "Java",
    package: "com.atai:atai-sdk",
    install: "// Maven or Gradle",
    status: "Coming Soon",
    version: "—",
    downloads: "Maven Central",
    link: "#",
  },
]

const QUICK_START = `// Install
npm install @atai-group/sdk

// Import and initialize
import { Atai } from "@atai-group/sdk"

const atai = new Atai({
  apiKey: process.env.ATAI_API_KEY
})

// Use any capability instantly
const response = await atai.ai.chat({
  messages: [
    { role: "user", content: "Explain quantum computing" }
  ]
})

const location = await atai.maps.geocode({
  query: "1600 Amphitheatre Parkway"
})

const checkout = await atai.payments.createCheckout({
  items: [{ name: "Pro Plan", amount: 2900 }]
})

await atai.messaging.sendSMS({
  to: "+1234567890",
  message: "Your code: 123456"
})`

export default function SDKPage() {
  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            name: "Atai SDK",
            description: "Unified SDK for accessing 40+ infrastructure services through one API key",
            programmingLanguage: ["TypeScript", "Python", "Go", "Ruby", "PHP"],
            codeRepository: "https://github.com/atai-group/sdk",
            author: {
              "@type": "Organization",
              name: "ATAI Enterprises",
              url: SITE_URL,
            },
          }),
        }}
      />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 mb-6">
              <Package className="size-4 text-primary" />
              <span className="text-sm font-medium text-primary">Official SDK</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Atai SDK
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-8">
              One unified API for everything developers need. Available for TypeScript, Python, Go, and more.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/developers"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Code2 className="size-5" /> Get Started
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <BookOpen className="size-5" /> Documentation
              </Link>
              <a
                href="https://github.com/atai-group/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <Github className="size-5" /> GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Quick Start</h2>
            <p className="mt-3 text-muted-foreground">Install, authenticate, and start building in 60 seconds</p>
          </div>

          <div className="rounded-xl border border-border bg-zinc-950 p-6 font-mono text-sm overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400">example.ts</span>
              <Terminal className="size-4 text-zinc-400" />
            </div>
            <pre className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {QUICK_START}
            </pre>
          </div>
        </div>
      </section>

      {/* SDK Packages */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Official SDKs</h2>
            <p className="mt-3 text-muted-foreground">Use Atai in your preferred language</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SDK_PACKAGES.map((sdk) => (
              <div
                key={sdk.name}
                className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{sdk.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground font-mono">{sdk.package}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${sdk.status === "Stable"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : sdk.status === "Beta"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                  >
                    {sdk.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-emerald-400">
                    <span className="text-zinc-500">$</span> {sdk.install}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono text-foreground">{sdk.version}</span>
                  </div>

                  {sdk.link !== "#" && (
                    <a
                      href={sdk.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <Download className="size-4" />
                      View on {sdk.downloads}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Everything You Need</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                40+ infrastructure services accessible through one unified SDK
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "AI models (chat, image, video, speech)",
                  "Maps & geolocation services",
                  "Payment processing & billing",
                  "SMS & email messaging",
                  "Authentication & authorization",
                  "Database operations",
                  "File storage & CDN",
                  "Search & web scraping",
                  "Calendar & scheduling",
                  "And 30+ more capabilities",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <ArrowRight className="size-3 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Type-Safe</h3>
                <p className="text-sm text-muted-foreground">
                  Full TypeScript support with autocomplete and type checking for every API method
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Always Current</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic updates give you access to the latest AI models and infrastructure services
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Production-Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Built for scale with retry logic, rate limiting, and comprehensive error handling
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">One Billing</h3>
                <p className="text-sm text-muted-foreground">
                  Pay for all services through one simple credit-based system
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-10">
          <h2 className="text-3xl font-bold text-foreground">Ready to Get Started?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Install the SDK and get your API key in less than a minute
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Your API Key <ArrowRight className="size-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <BookOpen className="size-5" /> Read Docs
            </Link>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            500 free credits • No credit card required • Production-ready
          </p>
        </div>
      </section>
    </main>
  )
}
