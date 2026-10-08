import type { Metadata } from "next"
import Link from "next/link"
import {
  Code2,
  Zap,
  Shield,
  Sparkles,
  Database,
  Map,
  CreditCard,
  Mail,
  Calendar,
  MessageSquare,
  Lock,
  Search,
  Blocks,
  Globe,
  ArrowRight,
  Check,
  ExternalLink,
  BookOpen,
  Terminal,
  Key,
  Layers,
  Rocket,
  Building2,
} from "lucide-react"
import { AppHeader } from "@/components/app-header"

export const metadata: Metadata = {
  title: "Developers - Build with Atai Infrastructure | Unified API",
  description: "Access the same infrastructure that powers Atai's business-building platform. One unified API for AI, payments, maps, messaging, and 40+ services used to build real businesses.",
  keywords: ["Atai API", "business infrastructure", "unified API", "developer platform", "Atai SDK", "startup infrastructure"],
  openGraph: {
    title: "Build with Atai's Infrastructure",
    description: "Use the same unified infrastructure that powers thousands of AI-built businesses. One API for everything you need.",
    type: "website",
  },
}

const CAPABILITIES = [
  {
    icon: Sparkles,
    category: "AI & Intelligence",
    items: [
      "Text generation & chat",
      "Image generation",
      "Video generation",
      "Speech & transcription",
      "Embeddings & vectors",
      "Vision & analysis",
    ],
  },
  {
    icon: Map,
    category: "Location & Maps",
    items: [
      "Geocoding & reverse geocoding",
      "Routing & directions",
      "Place search",
      "Distance calculations",
      "Map rendering",
      "Location intelligence",
    ],
  },
  {
    icon: CreditCard,
    category: "Payments & Billing",
    items: [
      "Payment processing",
      "Subscription management",
      "Invoicing",
      "Checkout flows",
      "Multi-currency support",
      "Webhook handling",
    ],
  },
  {
    icon: MessageSquare,
    category: "Messaging & Communication",
    items: [
      "SMS messaging",
      "Email delivery",
      "Push notifications",
      "In-app messaging",
      "Chat infrastructure",
      "Real-time presence",
    ],
  },
  {
    icon: Lock,
    category: "Authentication & Security",
    items: [
      "OAuth providers",
      "Magic link auth",
      "Multi-factor authentication",
      "Session management",
      "JWT handling",
      "Role-based access",
    ],
  },
  {
    icon: Database,
    category: "Data & Storage",
    items: [
      "Database operations",
      "File storage",
      "Caching layers",
      "Search indexing",
      "Data pipelines",
      "Backup management",
    ],
  },
  {
    icon: Search,
    category: "Search & Discovery",
    items: [
      "Full-text search",
      "Semantic search",
      "Web scraping",
      "Content extraction",
      "SEO optimization",
      "Site indexing",
    ],
  },
  {
    icon: Calendar,
    category: "Productivity & Tools",
    items: [
      "Calendar sync",
      "Scheduling",
      "Task management",
      "Document processing",
      "PDF generation",
      "Data export",
    ],
  },
]

const CODE_EXAMPLES = {
  ai: `import { Atai } from "@atai-group/sdk"

const atai = new Atai({ apiKey: process.env.ATAI_API_KEY })

// Generate with AI
const response = await atai.ai.chat({
  messages: [{ role: "user", content: "Explain quantum computing" }]
})

// Generate images
const image = await atai.image.generate({
  prompt: "A futuristic city at sunset",
  model: "flux-pro"
})`,

  maps: `// Geocode an address
const location = await atai.maps.geocode({
  query: "1600 Amphitheatre Parkway, Mountain View, CA"
})

// Get directions
const route = await atai.maps.directions({
  origin: "New York, NY",
  destination: "Boston, MA",
  mode: "driving"
})`,

  payments: `// Create a checkout session
const checkout = await atai.payments.createCheckout({
  items: [
    { name: "Pro Plan", amount: 2900, quantity: 1 }
  ],
  successUrl: "https://yourapp.com/success",
  cancelUrl: "https://yourapp.com/cancel"
})

// Handle subscription
const subscription = await atai.payments.createSubscription({
  plan: "pro-monthly",
  customer: customerId
})`,

  messaging: `// Send SMS
await atai.messaging.sendSMS({
  to: "+1234567890",
  message: "Your verification code is: 123456"
})

// Send email
await atai.messaging.sendEmail({
  to: "user@example.com",
  subject: "Welcome to our app!",
  html: "<h1>Welcome!</h1><p>Thanks for signing up.</p>"
})`,
}

export default function DevelopersPage() {
  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 mb-6">
              <Building2 className="size-4 text-primary" />
              <span className="text-sm font-medium text-primary">Atai Infrastructure for Developers</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Build with the Infrastructure
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                That Powers Real Businesses
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-8">
              Atai turns ideas into complete businesses. Now you can use the same unified infrastructure
              that powers thousands of AI-built applications — 40+ services through one API.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Rocket className="size-4" /> See Atai Platform
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-background px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-primary/5"
              >
                <Key className="size-4" /> Get API Access
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <BookOpen className="size-4" /> Documentation
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-emerald-500" />
                <span>Powers Atai business builder</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 text-emerald-500" />
                <span>500 free credits</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 text-emerald-500" />
                <span>Production-ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is Atai */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground">What is Atai?</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Atai is an <strong className="text-foreground">AI business-building platform</strong> that helps founders
                turn ideas into real, production-ready businesses.
              </p>
              <p className="mt-4 text-muted-foreground">
                From idea to plan, build, launch, manage, and grow — Atai handles the entire lifecycle.
                It collaborates with you like an AI co-founder, generates full applications, deploys infrastructure,
                and manages everything needed to run a digital business.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Plan with AI co-founder collaboration",
                  "Build full-stack applications automatically",
                  "Launch with hosting, domains, and CDN",
                  "Manage customers, data, and operations",
                  "Grow with analytics and iteration tools",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="size-3 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  Learn more about Atai Platform <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="size-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">For Founders</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use Atai to build your business without technical expertise
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Code2 className="size-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">For Developers</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use Atai's infrastructure to power your own applications
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Layers className="size-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Unified Infrastructure</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The same API that powers Atai's business builder is available to you
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start Code */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Access Atai Infrastructure</h2>
            <p className="mt-3 text-muted-foreground">Use the Atai SDK to access 40+ infrastructure services</p>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border border-border bg-zinc-950 p-6 font-mono text-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-zinc-400">Terminal</span>
                <Terminal className="size-4 text-zinc-400" />
              </div>
              <div className="space-y-2 text-emerald-400">
                <div><span className="text-zinc-500">$</span> npm install @atai-group/sdk</div>
                <div><span className="text-zinc-500">$</span> export ATAI_API_KEY=<span className="text-purple-400">atai_...</span></div>
              </div>
              <div className="mt-6 text-zinc-300">
                <div className="text-blue-400">import</div> {`{ Atai }`} <div className="text-blue-400 inline">from</div> <span className="text-amber-300">"@atai-group/sdk"</span>
                <br /><br />
                <div className="text-blue-400">const</div> atai = <div className="text-blue-400 inline">new</div> Atai()
                <br />
                <div className="text-blue-400">const</div> result = <div className="text-blue-400 inline">await</div> atai.ai.<span className="text-yellow-300">chat</span>({`{ ... }`})
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">Infrastructure Services</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              The same capabilities Atai uses to build complete businesses
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.category}
                className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <capability.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{capability.category}</h3>
                </div>
                <ul className="space-y-2">
                  {capability.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="size-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Simple, Consistent API</h2>
            <p className="mt-3 text-muted-foreground">Same patterns across all services</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold text-foreground mb-4">
                <Sparkles className="size-5 text-primary" />
                AI & Image Generation
              </h3>
              <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 overflow-x-auto">
                {CODE_EXAMPLES.ai}
              </pre>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold text-foreground mb-4">
                <Map className="size-5 text-primary" />
                Maps & Location
              </h3>
              <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 overflow-x-auto">
                {CODE_EXAMPLES.maps}
              </pre>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold text-foreground mb-4">
                <CreditCard className="size-5 text-primary" />
                Payments & Billing
              </h3>
              <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 overflow-x-auto">
                {CODE_EXAMPLES.payments}
              </pre>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold text-foreground mb-4">
                <MessageSquare className="size-5 text-primary" />
                Messaging & Email
              </h3>
              <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 overflow-x-auto">
                {CODE_EXAMPLES.messaging}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-10">
          <Building2 className="mx-auto size-16 text-primary mb-6" />
          <h2 className="text-3xl font-bold text-foreground">
            Ready to Build?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Whether you're building a business with Atai or using our infrastructure for your own project,
            get started with 500 free credits.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Rocket className="size-5" /> Try Atai Platform
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-background px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:bg-primary/5"
            >
              <Key className="size-5" /> Get API Access
            </Link>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            500 free credits • No credit card required • Production-ready
          </p>
        </div>
      </section>

      {/* Resources */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/docs"
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <BookOpen className="size-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground group-hover:text-primary">Documentation</h3>
              <p className="mt-2 text-sm text-muted-foreground">Complete API reference and guides</p>
            </Link>

            <Link
              href="/sdk"
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <Code2 className="size-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground group-hover:text-primary">SDK Downloads</h3>
              <p className="mt-2 text-sm text-muted-foreground">TypeScript, Python, Go, and more</p>
            </Link>

            <Link
              href="/settings/api-keys"
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <Key className="size-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground group-hover:text-primary">API Keys</h3>
              <p className="mt-2 text-sm text-muted-foreground">Manage your authentication keys</p>
            </Link>

            <a
              href="https://github.com/atai-group/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <ExternalLink className="size-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground group-hover:text-primary">GitHub</h3>
              <p className="mt-2 text-sm text-muted-foreground">Open source examples and tools</p>
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
