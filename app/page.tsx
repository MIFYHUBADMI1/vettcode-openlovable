"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Code2, GitBranch, Globe2, Layers3, Play, Sparkles, TerminalSquare, Zap, Database, Shield, Server, HardDrive, BarChart3, Lock, Globe, Users, Briefcase, Smartphone, TrendingUp } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useSession, usePublicStats } from "@/lib/client/api"
import { HeroPreviewCard } from "@/components/hero-preview-card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

const steps = [
  { icon: Globe2, title: "Bring the signal", copy: "Paste a URL, upload a design, or start from a thought." },
  { icon: Layers3, title: "Get understood", copy: "MirrorSite maps the intent, structure, and product logic underneath." },
  { icon: Code2, title: "Ship the real thing", copy: "A working full-stack foundation you can edit, own, and deploy." },
]

export default function Page() {
  const [pulse, setPulse] = useState(0)
  const [activeStep, setActiveStep] = useState(1)
  const { session } = useSession()
  const builders = usePublicStats()
  const discoveryStates = ["signal detected", "intent emerging", "structure forming"]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((value) => (value + 1) % 100)
      setActiveStep((value) => (value + 1) % 3)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [])

  const [baseUrl, setBaseUrl] = useState("")
  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "MirrorSite AI",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: baseUrl,
      description: "Turn websites and ideas into working full-stack applications with authentication, database, backend, and infrastructure included.",
      image: "/og-image.png",
      screenshot: "/hero/after-landing.png",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "12",
        highPrice: "499",
        priceCurrency: "USD",
        offerCount: 5,
        offers: [
          {
            "@type": "Offer",
            name: "Explorer Plan",
            price: "12",
            priceCurrency: "USD",
            description: "$12/month for 50,000 MirrorSite Credits.",
          },
          {
            "@type": "Offer",
            name: "Starter Plan",
            price: "79",
            priceCurrency: "USD",
            description: "$79/month for 300,000 MirrorSite Credits.",
          },
          {
            "@type": "Offer",
            name: "Business Plan",
            price: "139",
            priceCurrency: "USD",
            description: "$139/month for 600,000 MirrorSite Credits.",
          },
        ],
      },
      author: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
      publisher: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "MirrorSite AI",
      url: baseUrl,
      description: "Turn websites and ideas into working full-stack applications.",
      publisher: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/dashboard?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
      <span className="workspace-signal" aria-hidden="true" />
      <SiteHeader />

      <section className="hero-glass-section relative mx-auto grid w-full max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-24">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md px-3 py-1.5 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="eyebrow-letters" aria-label="The missing layer between idea and app">{"THE MISSING LAYER BETWEEN IDEA AND APP".split("").map((letter, index) => <span key={`${letter}-${index}`} style={{ animationDelay: `${index * 24}ms` }}>{letter === " " ? "\u00a0" : letter}</span>)}</span>
          </div>
          <p className="mb-3 font-mono text-sm font-medium tracking-wide text-primary">AI-Powered Application Builder</p>
          <h1 className="hero-title text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-7xl">Make the leap from <span className="word-reveal text-primary">inspiration</span> to something real.</h1>
          <p className="hero-copy mt-7 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">MirrorSite AI understands what you&apos;re trying to build, turns inspiration into product structure, and generates a working full-stack foundation — with the data, authentication, backend, storage, and infrastructure your application needs to become something real.</p>
          <div className="mt-7 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10"><Check className="size-3.5 text-primary" /></span>
              <span className="text-sm font-medium text-foreground">Turn any website into a full-stack app with backend and auth</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10"><Check className="size-3.5 text-primary" /></span>
              <span className="text-sm font-medium text-foreground">Generate your working application foundation in minutes</span>
            </div>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={session ? "/dashboard" : "/register"} className={buttonVariants({ size: "lg" }) + " h-12 px-5"}>{session ? "Open your dashboard" : "Build from a starting point"} <ArrowRight className="size-4" /></Link>
            <a href="#demo" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-5"}><Play className="size-4" /> See how it works</a>
          </div>
          <div className="mt-5 flex items-center gap-3 font-mono text-xs text-muted-foreground"><span className="live-dot size-1.5 rounded-full bg-primary" /> No blank canvas. No magic prompt. <span className="text-primary transition-all duration-500">{discoveryStates[activeStep]}</span></div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {["React", "Next.js", "Node.js", "MongoDB", "TypeScript"].map((tech) => (
              <span key={tech} className="tech-badge rounded-md border border-border/60 bg-card/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground cursor-default">{tech}</span>
            ))}
          </div>
          {builders > 0 && (
            <div className="mt-5 flex items-center gap-2.5">
              <div className="flex -space-x-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="inline-block size-5 rounded-full border-2 border-background bg-primary/20" style={{ zIndex: 3 - i }} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{builders.toLocaleString()}+</span> builders shipping with MirrorSite AI</span>
            </div>
          )}
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3" aria-label="MirrorSite AI before and after examples">
            {[{ src: "/hero/before-landing.png", label: "Before / inspiration" }, { src: "/hero/after-landing.png", label: "After / landing page" }, { src: "/hero/before-dashboard.png", label: "Before / dashboard" }, { src: "/hero/after-dashboard.png", label: "After / full-stack app" }, { src: "/hero/before-mobile.png", label: "Before / mobile idea" }, { src: "/hero/after-mobile.png", label: "After / mobile flow" }].map((image) => <figure key={image.src} className="group overflow-hidden rounded-lg border border-border/50 bg-card/60 backdrop-blur-sm"><img src={image.src} alt={image.label} className="aspect-[16/10] w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0" /><figcaption className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{image.label}</figcaption></figure>)}
          </div>
        </div>

        <div id="demo" className="hero-preview-container">
          <HeroPreviewCard />
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-card/40"><div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The process</p><h2 className="mt-4 max-w-sm text-balance text-3xl font-semibold tracking-tight sm:text-4xl">The shortest distance to a first version.</h2><Link href="/docs" className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">Learn more in the docs <ArrowRight className="size-3.5" /></Link></div><div className="grid gap-8 sm:grid-cols-3">{steps.map(({ icon: Icon, title, copy }) => <div key={title} className="border-t border-border pt-5"><Icon className="size-5 text-primary" /><h3 className="mt-7 font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></div>)}</div></div></section>

      <section id="principles" className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Built for the in-between</p><h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Your idea is already more specific than a prompt.</h2><p className="mt-6 max-w-md text-lg leading-8 text-muted-foreground">MirrorSite gives that specificity somewhere to go—without flattening it into a template or leaving you alone with a blank canvas.</p></div><div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2"><div className="bg-background p-6"><Code2 className="size-5 text-primary" /><h3 className="mt-8 font-medium">A real foundation</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Start with routes, components, data models, auth, and meaningful states—not a screenshot that only looks finished.</p></div><div className="bg-background p-6"><Layers3 className="size-5 text-primary" /><h3 className="mt-8 font-medium">Structure from signal</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">The visual language, hierarchy, and product intent of your reference become an editable build direction.</p></div><div className="bg-background p-6"><GitBranch className="size-5 text-primary" /><h3 className="mt-8 font-medium">Made to change</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Keep iterating after the first build. Your project is a starting point you own, not a locked result.</p></div><div className="bg-background p-6"><TerminalSquare className="size-5 text-primary" /><h3 className="mt-8 font-medium">Clear next steps</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">See what was understood, what was generated, and where to take the product next.</p></div><div className="bg-background p-6"><BarChart3 className="size-5 text-primary" /><h3 className="mt-8 font-medium">Infrastructure included</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Your application doesn&apos;t stop when the interface is generated. MirrorSite provides managed infrastructure for the data, storage, backend operations, and usage management your project needs to keep moving.</p></div></div></section>

      {/* ── Capabilities ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Capabilities</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Everything your application needs to keep moving.</h2>
          <p className="mt-4 mx-auto max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">MirrorSite goes beyond generating the interface. Your project gets a connected full-stack foundation with the core building blocks needed to turn an idea into a usable application.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Frontend */}
          <div className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><Globe2 className="size-5 text-primary" /></div>
            <h3 className="font-medium">A real interface</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Routes, components, layouts, responsive design, and meaningful application states — ready to extend.</p>
            <div className="mt-4 rounded-lg bg-background/50 border border-border/50 p-3">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono"><span className="size-1.5 rounded-full bg-primary" /> /dashboard</div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono"><span className="size-1.5 rounded-full bg-primary" /> /settings</div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono"><span className="size-1.5 rounded-full bg-primary" /> /profile</div>
            </div>
          </div>
          {/* Database */}
          <div className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><Database className="size-5 text-primary" /></div>
            <h3 className="font-medium">Data that belongs to your app</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Structured data, records, relationships, and the backend operations that make the interface more than a static screen.</p>
            <div className="mt-4 rounded-lg bg-background/50 border border-border/50 p-3 font-mono text-[10px]">
              <div className="text-muted-foreground border-b border-border/30 pb-1 mb-1">Users</div>
              <div className="flex justify-between text-muted-foreground"><span>Alex</span><span className="text-green-500">Active</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Sarah</span><span className="text-green-500">Active</span></div>
              <div className="flex justify-between text-muted-foreground"><span>David</span><span className="text-primary">Pending</span></div>
            </div>
          </div>
          {/* Auth */}
          <div className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><Shield className="size-5 text-primary" /></div>
            <h3 className="font-medium">Users, accounts &amp; access</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Authentication flows, email verification, sessions, and account-aware experiences built in.</p>
            <div className="mt-4 rounded-lg bg-background/50 border border-border/50 p-3">
              <div className="flex items-center gap-2"><Lock className="size-3 text-primary" /><span className="text-[10px] text-muted-foreground">Sign in • Register • Verify</span></div>
              <div className="flex items-center gap-2 mt-2"><Shield className="size-3 text-primary" /><span className="text-[10px] text-muted-foreground">Sessions • Password reset</span></div>
            </div>
          </div>
          {/* Backend */}
          <div className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><Server className="size-5 text-primary" /></div>
            <h3 className="font-medium">Connect the product</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Your interface works with real application data and backend operations — not just the frontend.</p>
            <div className="mt-4 rounded-lg bg-background/50 border border-border/50 p-3 font-mono text-[10px]">
              <div className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">UI</span> <ArrowRight className="size-2.5" /> <span>API</span> <ArrowRight className="size-2.5" /> <span>Data</span></div>
            </div>
          </div>
          {/* Storage */}
          <div className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><HardDrive className="size-5 text-primary" /></div>
            <h3 className="font-medium">Store what your app needs</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep application assets and files within your project&apos;s managed infrastructure.</p>
            <div className="mt-4 rounded-lg bg-background/50 border border-border/50 p-3 font-mono text-[10px]">
              <div className="flex justify-between text-muted-foreground"><span>Images</span><span>42</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Documents</span><span>18</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Assets</span><span>73</span></div>
            </div>
          </div>
          {/* Infrastructure */}
          <div className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><BarChart3 className="size-5 text-primary" /></div>
            <h3 className="font-medium">Infrastructure without the setup</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">MirrorSite manages the underlying infrastructure so you can focus on building the product.</p>
            <div className="mt-4 rounded-lg bg-background/50 border border-border/50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: '65%' }} /></div>
                <span className="text-[10px] text-muted-foreground font-mono">65%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Storage: 742 MB / 1 GB</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What You Actually Get ── */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="text-center mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">What you actually get</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Not a template. A working application.</h2>
          </div>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
            {[
              "Working frontend", "Routes & components", "Authentication",
              "Application database", "Application data", "Backend & API capabilities",
              "Managed storage", "Application infrastructure", "Usage monitoring",
              "Project-specific limits", "Editable project foundation",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <Check className="size-4 text-primary shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40"><div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">For people who ship</p><p className="mt-3 text-xl font-medium">Bring the reference. Leave with momentum.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/register" className={buttonVariants({ size: "lg" })}>Start with your idea <ArrowRight className="size-4" /></Link><Link href="/docs" className={buttonVariants({ variant: "outline", size: "lg" })}>Read the docs</Link></div></div></section>

      <SiteFooter />
      </main>
    </>
  )
}
