"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Code2, GitBranch, Globe2, Layers3, Play, Sparkles, TerminalSquare, Zap } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

const steps = [
  { icon: Globe2, title: "Bring the signal", copy: "Paste a URL, upload a design, or start from a thought." },
  { icon: Layers3, title: "Get understood", copy: "MirrorSite maps the intent, structure, and product logic underneath." },
  { icon: Code2, title: "Ship the real thing", copy: "A working full-stack foundation you can edit, own, and deploy." },
]

export default function Page() {
  const [pulse, setPulse] = useState(0)
  const [activeStep, setActiveStep] = useState(1)

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
          <Link href="/login" className="text-foreground transition-colors hover:text-primary">Sign in</Link>
          <Link href="/register" className={buttonVariants({ size: "sm" })}>Start building <ArrowRight className="size-4" /></Link>
        </nav>
        <Link href="/register" className={buttonVariants({ size: "sm" }) + " md:hidden"}>Start</Link>
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
            <Link href="/register" className={buttonVariants({ size: "lg" }) + " h-12 px-5"}>Build from a starting point <ArrowRight className="size-4" /></Link>
            <a href="#demo" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-5"}><Play className="size-4" /> See how it works</a>
          </div>
          <p className="mt-5 font-mono text-xs text-muted-foreground">No blank canvas. No magic prompt. Just a clearer way forward.</p>
        </div>

        <div id="demo" className="hero-console relative rounded-xl border border-border bg-card p-3 shadow-2xl shadow-primary/5">
          <div className="scanline" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-border px-3 pb-3 font-mono text-[11px] text-muted-foreground"><span>mirrorsite / build-session</span><span className="flex items-center gap-1.5"><span className="live-dot size-1.5 rounded-full bg-primary" /> live / {String(pulse).padStart(2, "0")}%</span></div>
          <div className="grid gap-3 p-3 sm:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-background p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Source</p><div className="mt-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-accent text-primary"><Globe2 className="size-4" /></span><div><p className="text-sm font-medium">your-inspiration.com</p><p className="font-mono text-[10px] text-muted-foreground">crawled just now</p></div></div></div>
              <div className="rounded-lg border border-border bg-background p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Understanding</p><div className="mt-4 space-y-3 text-xs"><p className="flex items-center gap-2"><Check className="size-3 text-primary" /> visual language mapped</p><p className="flex items-center gap-2"><Check className="size-3 text-primary" /> product intent found</p><p className="flex items-center gap-2"><Check className="size-3 text-primary" /> build plan ready</p></div></div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your foundation</p><Sparkles className="size-4 text-primary" /></div><div className="mt-4 space-y-2"><div className="telemetry-bar h-3 w-3/4 rounded bg-muted" /><div className="telemetry-bar telemetry-bar-delay h-3 w-full rounded bg-muted" /><div className="telemetry-bar telemetry-bar-delay-2 h-3 w-2/3 rounded bg-muted" /></div><div className="mt-8 rounded-lg border border-primary/40 bg-accent/40 p-4 transition-colors duration-700"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-primary">Build agent</p><Zap className="size-3 text-primary" /></div><p className="mt-3 text-sm font-medium">A product, not a screenshot.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Auth, data, states, and the details that make the idea usable.</p></div><div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><TerminalSquare className="size-3" /> ready to extend</div></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-card/40"><div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The process</p><h2 className="mt-4 max-w-sm text-balance text-3xl font-semibold tracking-tight sm:text-4xl">The shortest distance to a first version.</h2></div><div className="grid gap-8 sm:grid-cols-3">{steps.map(({ icon: Icon, title, copy }) => <div key={title} className="border-t border-border pt-5"><Icon className="size-5 text-primary" /><h3 className="mt-7 font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></div>)}</div></div></section>

      <section id="principles" className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:px-10"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Built for the in-between</p><h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Your idea is already more specific than a prompt.</h2></div><div className="space-y-7 text-muted-foreground"><p className="text-lg leading-8">MirrorSite is for solo builders, designers, and teams who can see the product clearly—but need a better bridge from reference to reality.</p><div className="grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2"><p><span className="mb-2 block font-mono text-xs text-foreground">01 / CONTEXT</span>Understand the why, not just the pixels.</p><p><span className="mb-2 block font-mono text-xs text-foreground">02 / OWNERSHIP</span>Start with code you can take further.</p></div></div></section>

      <footer className="border-t border-border"><div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10"><span className="font-mono text-xs">© 2026 MirrorSite AI</span><div className="flex flex-wrap gap-x-5 gap-y-2"><a href="#how-it-works" className="hover:text-foreground">How it works</a><Link href="/resources" className="hover:text-foreground">Resources</Link><Link href="/about" className="hover:text-foreground">About</Link><Link href="/privacy" className="hover:text-foreground">Privacy</Link><Link href="/terms" className="hover:text-foreground">Terms</Link><Link href="/login" className="hover:text-foreground">Sign in</Link></div></div></footer>
      </main>
    </>
  )
}
