"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Code2, GitBranch, Globe2, Layers3, Play, Sparkles, TerminalSquare, Zap } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { AccountMenu } from "@/components/account-menu"
import { useSession } from "@/lib/client/api"

const steps = [
  { icon: Globe2, title: "Bring the signal", copy: "Paste a URL, upload a design, or start from a thought." },
  { icon: Layers3, title: "Get understood", copy: "MirrorSite maps the intent, structure, and product logic underneath." },
  { icon: Code2, title: "Ship the real thing", copy: "A working full-stack foundation you can edit, own, and deploy." },
]

export default function Page() {
  const [pulse, setPulse] = useState(0)
  const [activeStep, setActiveStep] = useState(1)
  const { session, isLoading: sessionLoading } = useSession()
  const discoveryStates = ["signal detected", "intent emerging", "structure forming"]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((value) => (value + 1) % 100)
      setActiveStep((value) => (value + 1) % 3)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [])

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MirrorSite AI",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: "https://mirrorsiteai.vercel.app",
    description: "Turn websites and ideas into working full-stack applications.",
    publisher: { "@type": "Organization", name: "ATAI Enterprises", url: "https://mirrorsiteai.vercel.app" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
      <span className="workspace-signal" aria-hidden="true" />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">M</span>
          <span>mirrorsite<span className="text-primary">.ai</span></span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#principles" className="transition-colors hover:text-foreground">Why MirrorSite</a>
          {session ? <Link href="/workspace" className="text-foreground transition-colors hover:text-primary">Workspace</Link> : null}
          {session ? <AccountMenu /> : null}
          {!session && !sessionLoading ? <><Link href="/login" className="text-foreground transition-colors hover:text-primary">Sign in</Link><Link href="/register" className={buttonVariants({ size: "sm" })}>Start building <ArrowRight className="size-4" /></Link></> : null}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          {session ? <><Link href="/workspace" className={buttonVariants({ variant: "outline", size: "sm" })}>Workspace</Link><AccountMenu /></> : !sessionLoading ? <Link href="/register" className={buttonVariants({ size: "sm" })}>Start</Link> : null}
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-24">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="eyebrow-letters" aria-label="The missing layer between idea and app">{"THE MISSING LAYER BETWEEN IDEA AND APP".split("").map((letter, index) => <span key={`${letter}-${index}`} style={{ animationDelay: `${index * 24}ms` }}>{letter === " " ? "\u00a0" : letter}</span>)}</span>
          </div>
          <h1 className="hero-title text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-7xl">Make the leap from <span className="word-reveal text-primary">inspiration</span> to something real.</h1>
          <p className="hero-copy mt-7 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">MirrorSite AI understands what you&apos;re trying to build, turns the signal into product structure, and gives you a working full-stack foundation to make your own.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={session ? "/workspace" : "/register"} className={buttonVariants({ size: "lg" }) + " h-12 px-5"}>{session ? "Open your workspace" : "Build from a starting point"} <ArrowRight className="size-4" /></Link>
            <a href="#demo" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-5"}><Play className="size-4" /> See how it works</a>
          </div>
          <div className="mt-5 flex items-center gap-3 font-mono text-xs text-muted-foreground"><span className="live-dot size-1.5 rounded-full bg-primary" /> No blank canvas. No magic prompt. <span className="text-primary transition-all duration-500">{discoveryStates[activeStep]}</span></div>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3" aria-label="MirrorSite AI before and after examples">
            {[{ src: "/hero/before-landing.png", label: "Before / inspiration" }, { src: "/hero/after-landing.png", label: "After / landing page" }, { src: "/hero/before-dashboard.png", label: "Before / dashboard" }, { src: "/hero/after-dashboard.png", label: "After / full-stack app" }, { src: "/hero/before-mobile.png", label: "Before / mobile idea" }, { src: "/hero/after-mobile.png", label: "After / mobile flow" }].map((image) => <figure key={image.src} className="group overflow-hidden rounded-lg border border-border bg-card"><img src={image.src} alt={image.label} className="aspect-[16/10] w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0" /><figcaption className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{image.label}</figcaption></figure>)}
          </div>
        </div>

        <div id="demo" className="hero-console relative rounded-xl border border-border bg-card p-3 shadow-2xl shadow-primary/5">
          <div className="scanline" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-border px-3 pb-3 font-mono text-[11px] text-muted-foreground"><span>mirrorsite / build-session</span><span className="flex items-center gap-1.5"><span className="live-dot size-1.5 rounded-full bg-primary" /> live / {String(pulse).padStart(2, "0")}%</span></div>
          <div className="grid gap-3 p-3 sm:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-background p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Source</p><div className="mt-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-accent text-primary"><Globe2 className="size-4" /></span><div><p className="text-sm font-medium">your-inspiration.com</p><p className="font-mono text-[10px] text-muted-foreground">crawled just now</p></div></div></div>
              <div className="rounded-lg border border-border bg-background p-4"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Understanding</p><span className="font-mono text-[10px] text-primary">{discoveryStates[activeStep]}</span></div><div className="mt-4 space-y-3 text-xs"><p className={`flex items-center gap-2 transition-opacity duration-500 ${activeStep >= 0 ? "opacity-100" : "opacity-40"}`}><Check className="size-3 text-primary" /> visual language mapped</p><p className={`flex items-center gap-2 transition-opacity duration-500 ${activeStep >= 1 ? "opacity-100" : "opacity-40"}`}><Check className="size-3 text-primary" /> product intent found</p><p className={`flex items-center gap-2 transition-opacity duration-500 ${activeStep >= 2 ? "opacity-100" : "opacity-40"}`}><Check className="size-3 text-primary" /> build plan ready</p></div></div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your foundation</p><Sparkles className="size-4 text-primary" /></div><div className="mt-4 space-y-2"><div className="telemetry-bar h-3 w-3/4 rounded bg-muted" /><div className="telemetry-bar telemetry-bar-delay h-3 w-full rounded bg-muted" /><div className="telemetry-bar telemetry-bar-delay-2 h-3 w-2/3 rounded bg-muted" /></div><div className="mt-8 rounded-lg border border-primary/40 bg-accent/40 p-4 transition-colors duration-700"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-primary">Build agent</p><Zap className="size-3 text-primary" /></div><p className="mt-3 text-sm font-medium">A product, not a screenshot.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Auth, data, states, and the details that make the idea usable.</p></div><div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><TerminalSquare className="size-3" /> ready to extend</div></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-card/40"><div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The process</p><h2 className="mt-4 max-w-sm text-balance text-3xl font-semibold tracking-tight sm:text-4xl">The shortest distance to a first version.</h2></div><div className="grid gap-8 sm:grid-cols-3">{steps.map(({ icon: Icon, title, copy }) => <div key={title} className="border-t border-border pt-5"><Icon className="size-5 text-primary" /><h3 className="mt-7 font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></div>)}</div></div></section>

      <section id="principles" className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Built for the in-between</p><h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Your idea is already more specific than a prompt.</h2><p className="mt-6 max-w-md text-lg leading-8 text-muted-foreground">MirrorSite gives that specificity somewhere to go—without flattening it into a template or leaving you alone with a blank canvas.</p></div><div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2"><div className="bg-background p-6"><Code2 className="size-5 text-primary" /><h3 className="mt-8 font-medium">A real foundation</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Start with routes, components, data models, auth, and meaningful states—not a screenshot that only looks finished.</p></div><div className="bg-background p-6"><Layers3 className="size-5 text-primary" /><h3 className="mt-8 font-medium">Structure from signal</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">The visual language, hierarchy, and product intent of your reference become an editable build direction.</p></div><div className="bg-background p-6"><GitBranch className="size-5 text-primary" /><h3 className="mt-8 font-medium">Made to change</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Keep iterating after the first build. Your project is a starting point you own, not a locked result.</p></div><div className="bg-background p-6"><TerminalSquare className="size-5 text-primary" /><h3 className="mt-8 font-medium">Clear next steps</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">See what was understood, what was generated, and where to take the product next.</p></div></div></section>

      <section className="border-y border-border bg-card/40"><div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">For people who ship</p><p className="mt-3 text-xl font-medium">Bring the reference. Leave with momentum.</p></div><Link href="/register" className={buttonVariants({ size: "lg" })}>Start with your idea <ArrowRight className="size-4" /></Link></div></section>

      <footer className="border-t border-border"><div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10"><span className="font-mono text-xs">© 2026 MirrorSite AI</span><div className="flex flex-wrap gap-x-5 gap-y-2"><a href="#how-it-works" className="hover:text-foreground">How it works</a><Link href="/resources" className="hover:text-foreground">Resources</Link><Link href="/about" className="hover:text-foreground">About</Link><Link href="/privacy" className="hover:text-foreground">Privacy</Link><Link href="/terms" className="hover:text-foreground">Terms</Link><Link href={session ? "/workspace" : "/login"} className="hover:text-foreground">{session ? "Workspace" : "Sign in"}</Link></div></div></footer>
      </main>
    </>
  )
}
