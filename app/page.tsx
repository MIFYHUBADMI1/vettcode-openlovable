"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import {
  ArrowRight, Check, Code2, GitBranch, Globe2, Layers3,
  Sparkles, TerminalSquare, Zap, Database, Shield, Server,
  HardDrive, BarChart3, Lock, GitMerge, Boxes, Cpu, MousePointerClick,
  Timer, Package, Rocket, ChevronRight,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useSession, usePublicStats } from "@/lib/client/api"
import { HeroPreviewCard } from "@/components/hero-preview-card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

// ─── Data ────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    number: "01",
    icon: Globe2,
    title: "Give it a signal",
    copy: "Drop a URL, paste a screenshot, describe an idea — MirrorSite reads the intent behind whatever you bring.",
  },
  {
    number: "02",
    icon: Cpu,
    title: "Watch it think",
    copy: "AI agents map the structure, product logic, data models, and user flows your application actually needs.",
  },
  {
    number: "03",
    icon: Code2,
    title: "Own what ships",
    copy: "A real Next.js codebase with auth, database, backend, and infrastructure — ready to edit, deploy, and scale.",
  },
]

const CAPABILITIES = [
  {
    icon: Globe2,
    label: "Frontend",
    title: "Production-ready UI",
    description: "Routes, layouts, components, and responsive design. Not a mockup — a real interface you can extend immediately.",
    preview: (
      <div className="mt-4 space-y-1.5 rounded-lg border border-border/40 bg-background/60 p-3 font-mono text-[10px]">
        {["/dashboard", "/settings", "/profile", "/api/users"].map((r) => (
          <div key={r} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
            {r}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Database,
    label: "Database",
    title: "Structured data from day one",
    description: "Real data models, relationships, and persistence built from the structure MirrorSite extracts from your reference.",
    preview: (
      <div className="mt-4 rounded-lg border border-border/40 bg-background/60 p-3 font-mono text-[10px]">
        <div className="mb-2 text-muted-foreground/60">users collection</div>
        {[["Alex Chen", "active", "admin"], ["Sarah Kim", "active", "user"], ["David R.", "pending", "user"]].map(([name, status, role]) => (
          <div key={name} className="flex justify-between gap-2 py-0.5 text-muted-foreground">
            <span>{name}</span>
            <span className={status === "active" ? "text-emerald-400" : "text-amber-400"}>{status}</span>
            <span className="text-primary/70">{role}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Shield,
    label: "Auth",
    title: "Authentication included",
    description: "Sign-up, login, email verification, sessions, password reset, and role-based access — all wired up and working.",
    preview: (
      <div className="mt-4 space-y-2 rounded-lg border border-border/40 bg-background/60 p-3">
        {[{ icon: Lock, label: "Email / password login" }, { icon: Shield, label: "OAuth — Google, GitHub" }, { icon: Check, label: "Sessions + JWT" }].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <Icon className="size-3 text-primary/80 shrink-0" />
            {label}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Server,
    label: "Backend",
    title: "API routes that actually work",
    description: "Typed API routes wired to real data. Your UI talks to a real backend from the moment the build completes.",
    preview: (
      <div className="mt-4 rounded-lg border border-border/40 bg-background/60 p-3 font-mono text-[10px] text-muted-foreground">
        <div className="mb-1.5 text-muted-foreground/60">API layer</div>
        <div className="flex items-center gap-2">
          <span className="text-primary">UI</span>
          <ChevronRight className="size-2.5" />
          <span>API Routes</span>
          <ChevronRight className="size-2.5" />
          <span>MongoDB</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-emerald-400">POST</span>
          <span>/api/users/create</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-400">GET</span>
          <span>/api/dashboard/data</span>
        </div>
      </div>
    ),
  },
  {
    icon: HardDrive,
    label: "Storage",
    title: "File storage, sorted",
    description: "Upload and serve images, documents, and assets through managed infrastructure built into your project.",
    preview: (
      <div className="mt-4 rounded-lg border border-border/40 bg-background/60 p-3 font-mono text-[10px]">
        {[["Images", "42 files", "128 MB"], ["Documents", "18 files", "56 MB"], ["Assets", "73 files", "212 MB"]].map(([type, count, size]) => (
          <div key={type} className="flex items-center justify-between py-0.5 text-muted-foreground">
            <span>{type}</span><span className="text-muted-foreground/60">{count}</span><span className="text-primary/70">{size}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: BarChart3,
    label: "Infrastructure",
    title: "Managed infrastructure",
    description: "Database, storage, usage tracking, and project limits — all provisioned and managed, no DevOps required.",
    preview: (
      <div className="mt-4 space-y-2.5 rounded-lg border border-border/40 bg-background/60 p-3">
        {[{ label: "Storage", pct: 65 }, { label: "Requests", pct: 38 }, { label: "CPU", pct: 22 }].map(({ label, pct }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>{label}</span><span className="text-primary/80">{pct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border/60">
              <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

const BENTO = [
  {
    size: "lg",
    icon: Rocket,
    eyebrow: "Zero to shipped",
    title: "From first signal to working app in minutes",
    body: "Not a boilerplate. Not a wizard. MirrorSite reads what you're building and generates a codebase that's already wired together — frontend, backend, data, and auth.",
    accent: true,
  },
  {
    size: "sm",
    icon: Code2,
    eyebrow: "Real code",
    title: "You own the output",
    body: "Download it. Edit it. Deploy it anywhere. No vendor lock-in, no proprietary runtime.",
  },
  {
    size: "sm",
    icon: GitBranch,
    eyebrow: "Built to iterate",
    title: "Keep going after the build",
    body: "Use the built-in editor, push to GitHub, or bring your own tools. MirrorSite is the starting point, not the ceiling.",
  },
  {
    size: "sm",
    icon: Boxes,
    eyebrow: "Full stack",
    title: "Every layer, covered",
    body: "Routes, components, data models, auth flows, API routes, storage, infrastructure. The whole thing.",
  },
  {
    size: "sm",
    icon: Timer,
    eyebrow: "Speed",
    title: "Build what used to take weeks",
    body: "Early users are shipping full-stack MVPs in the time it used to take to set up a database.",
  },
]

const WHAT_YOU_GET = [
  "Working Next.js codebase",
  "Routes & page components",
  "Authentication flows",
  "Application database",
  "Typed data models",
  "Backend & API routes",
  "File storage layer",
  "Project infrastructure",
  "Usage monitoring",
  "Role-based access",
  "Editor & visual tools",
  "GitHub sync",
]

const TECH_STACK = ["React", "Next.js", "TypeScript", "MongoDB", "Node.js", "Tailwind CSS"]

// ─── Typewriter headline ──────────────────────────────────────────────────────

const PHRASES = [
  "working app without the grind.",
  "full-stack app in minutes.",
  "real product, not a mockup.",
  "something shippable today.",
]

function TypewriterHeadline() {
  // Single rendered string + cursor visibility
  const [text, setText] = useState("")
  const [cursorOn, setCursorOn] = useState(true)

  // All mutable loop state lives in a ref — never causes re-trigger bugs
  const state = useRef({
    phraseIdx: 0,
    charIdx: 0,
    erasing: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  // Cursor blink — completely independent interval
  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const s = state.current

    function step() {
      const phrase = PHRASES[s.phraseIdx]

      if (!s.erasing) {
        // ── Type one character ──
        s.charIdx++
        setText(phrase.slice(0, s.charIdx))

        if (s.charIdx === phrase.length) {
          // Fully typed — hold for 3.5 seconds so the user can read it
          s.timer = setTimeout(() => {
            s.erasing = true
            step()
          }, 3500)
        } else {
          // Comfortable reading pace with slight human variation
          const delay = 90 + Math.random() * 40
          s.timer = setTimeout(step, delay)
        }
      } else {
        // ── Erase one character ──
        s.charIdx--
        setText(phrase.slice(0, s.charIdx))

        if (s.charIdx === 0) {
          // Fully erased — pause before next phrase
          s.erasing = false
          s.phraseIdx = (s.phraseIdx + 1) % PHRASES.length
          s.timer = setTimeout(step, 500)
        } else {
          s.timer = setTimeout(step, 45)
        }
      }
    }

    // Kick off with a short delay so the page renders first
    s.timer = setTimeout(step, 600)

    return () => {
      if (s.timer) clearTimeout(s.timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <span className="lp-typewriter-wrap">
      <span className="lp-gradient-text">{text}</span>
      <span
        className="lp-cursor"
        aria-hidden="true"
        style={{ opacity: cursorOn ? 1 : 0 }}
      >|</span>
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [activeStep, setActiveStep] = useState(0)
  const { session } = useSession()
  const builders = usePublicStats()

  useEffect(() => {
    const t = setInterval(() => setActiveStep((v) => (v + 1) % 3), 3000)
    return () => clearInterval(t)
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
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "12",
        highPrice: "499",
        priceCurrency: "USD",
        offerCount: 5,
      },
      author: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "MirrorSite AI",
      url: baseUrl,
    },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <main className="lp-root min-h-svh overflow-x-hidden bg-background text-foreground">

        {/* ── Ambient background ──────────────────────────────────── */}
        <div className="lp-ambient" aria-hidden="true" />
        <div className="lp-grid" aria-hidden="true" />

        <SiteHeader />

        {/* ══════════════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="relative mx-auto grid w-full max-w-7xl gap-16 px-6 pb-24 pt-12 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-20">

          <div className="relative z-10 max-w-2xl">

            {/* Eyebrow badge */}
            <div className="lp-badge mb-8 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 backdrop-blur-sm">
              <span className="lp-live-dot size-1.5 rounded-full bg-primary" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-primary">
                AI Application Builder
              </span>
            </div>

            {/* Headline */}
            <h1 className="lp-h1 text-balance text-5xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-6xl xl:text-7xl">
              Go from idea to{" "}
              <TypewriterHeadline />
            </h1>

            {/* Sub-copy */}
            <p className="lp-copy mt-6 max-w-xl text-pretty text-lg leading-[1.75] text-muted-foreground">
              MirrorSite AI reads your signal — a URL, a design, an idea — and generates a complete full-stack foundation with authentication, database, backend, storage, and infrastructure already wired together.
            </p>

            {/* Proof points */}
            <ul className="mt-7 space-y-2.5">
              {[
                "Full-stack Next.js codebase, not a screenshot",
                "Auth, database, and backend included — not sold separately",
                "Edit, deploy, and own the code with zero lock-in",
              ].map((pt) => (
                <li key={pt} className="flex items-center gap-3 text-sm font-medium">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Check className="size-3 text-primary" />
                  </span>
                  {pt}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={session ? "/dashboard" : "/register"}
                className={cn(buttonVariants({ size: "lg" }), "lp-cta-primary h-12 gap-2 px-6")}
              >
                {session ? "Open dashboard" : "Start building free"}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 gap-2 px-6")}
              >
                See how it works
              </a>
            </div>

            {/* Live status */}
            <p className="mt-6 flex items-center gap-2.5 font-mono text-xs text-muted-foreground">
              <span className="lp-live-dot size-1.5 rounded-full bg-emerald-400" />
              No blank canvas. No magic prompt.{" "}
              <span className="text-primary transition-all duration-500">
                {["signal detected →", "structure forming →", "app ready →"][activeStep]}
              </span>
            </p>

            {/* Tech badges */}
            <div className="mt-6 flex flex-wrap gap-2">
              {TECH_STACK.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* Social proof */}
            {builders > 0 && (
              <div className="mt-6 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="inline-block size-7 rounded-full border-2 border-background bg-gradient-to-br from-primary/30 to-primary/10"
                      style={{ zIndex: 4 - i }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{builders.toLocaleString()}+</span> builders already shipping
                </p>
              </div>
            )}
          </div>

          {/* Hero card */}
          <div className="relative z-10">
            <HeroPreviewCard />
          </div>
        </section>

        {/* ── Marquee divider ── */}
        <div className="lp-marquee-wrap overflow-hidden border-y border-border/60 bg-card/40 py-4">
          <div className="lp-marquee flex gap-12 whitespace-nowrap">
            {Array.from({ length: 3 }).flatMap(() =>
              ["Authentication", "Database", "API Routes", "File Storage", "Infrastructure", "Next.js", "TypeScript", "MongoDB", "Full-Stack", "No Lock-In", "Edit & Deploy"].map((t) => (
                <span key={t + Math.random()} className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
                  {t} <span className="mx-3 text-primary/30">·</span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-28 lg:px-10">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">The process</p>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps. One real application.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-base leading-7 text-muted-foreground">
              From signal to full-stack — faster than setting up a boilerplate.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ number, icon: Icon, title, copy }, i) => (
              <div
                key={title}
                className={cn(
                  "group relative flex flex-col gap-5 bg-card p-8 transition-colors hover:bg-accent/30",
                  "lp-how-item",
                )}
                style={{ "--lp-delay": `${i * 100}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <span className="font-mono text-4xl font-bold text-muted-foreground/15 select-none">{number}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            BENTO GRID — Why MirrorSite
        ══════════════════════════════════════════════════════════ */}
        <section id="principles" className="border-y border-border/60 bg-card/20 py-28">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
            <div className="mb-16 text-center">
              <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">Why MirrorSite</p>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Built for people who actually ship.
              </h2>
            </div>

            <div className="lp-bento grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Large card — spans 2 cols on lg */}
              <div className="lp-bento-card lp-bento-accent group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 lg:col-span-2">
                <div className="lp-bento-glow" />
                <div className="relative z-10">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/20">
                    <Rocket className="size-6 text-primary" />
                  </div>
                  <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-primary/80">Zero to shipped</p>
                  <h3 className="text-2xl font-bold tracking-tight">From first signal to working app in minutes</h3>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    Not a boilerplate. Not a wizard. MirrorSite reads what you're building and generates a codebase that's already wired together — frontend, backend, data, and auth. You show up with an idea, you leave with momentum.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Full-stack", "Auth included", "Real DB", "Editable code"].map((tag) => (
                      <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-[10px] text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Small card */}
              <div className="lp-bento-card group rounded-2xl border border-border/60 bg-card p-7 transition-colors hover:border-primary/30 hover:bg-accent/20">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Code2 className="size-5 text-primary" />
                </div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-primary/70">Real code</p>
                <h3 className="text-lg font-bold tracking-tight">You own the output</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Download it. Edit it. Deploy it anywhere. No vendor lock-in, no proprietary runtime, no hostage situation.</p>
              </div>

              <div className="lp-bento-card group rounded-2xl border border-border/60 bg-card p-7 transition-colors hover:border-primary/30 hover:bg-accent/20">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <GitBranch className="size-5 text-primary" />
                </div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-primary/70">Built to iterate</p>
                <h3 className="text-lg font-bold tracking-tight">Keep going after the build</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Built-in editor, GitHub sync, AI code fixes. MirrorSite is the starting point, not the ceiling.</p>
              </div>

              <div className="lp-bento-card group rounded-2xl border border-border/60 bg-card p-7 transition-colors hover:border-primary/30 hover:bg-accent/20">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Boxes className="size-5 text-primary" />
                </div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-primary/70">Full stack</p>
                <h3 className="text-lg font-bold tracking-tight">Every layer, covered</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Routes, components, data models, auth flows, API routes, storage, and infrastructure. The entire stack, assembled.</p>
              </div>

              {/* Wide card — spans full row on lg */}
              <div className="lp-bento-card group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-7 transition-colors hover:border-primary/30 sm:col-span-2 lg:col-span-1">
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Timer className="size-5 text-primary" />
                </div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-primary/70">Speed</p>
                <h3 className="text-lg font-bold tracking-tight">What used to take weeks</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Early users are shipping full-stack MVPs in the time it used to take to set up a database and configure auth.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            CAPABILITIES GRID
        ══════════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-28 lg:px-10">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">Capabilities</p>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your app needs to keep moving.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-muted-foreground">
              MirrorSite doesn't just generate the interface. Your project gets a connected full-stack foundation with every building block needed to turn an idea into a real, usable application.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, label, title, description, preview }, i) => (
              <div
                key={label}
                className="lp-cap-card group rounded-2xl border border-border/60 bg-card p-7 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                style={{ "--lp-delay": `${i * 60}ms` } as React.CSSProperties}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <Icon className="size-5 text-primary" />
                </div>
                <p className="mt-1.5 font-mono text-[9px] font-medium uppercase tracking-widest text-primary/60">{label}</p>
                <h3 className="mt-3 font-semibold text-base leading-snug">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                {preview}
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            WHAT YOU GET — checklist
        ══════════════════════════════════════════════════════════ */}
        <section className="border-y border-border/60 bg-card/30">
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
            <div className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">

              <div>
                <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">What you actually get</p>
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  Not a template.<br />A working application.
                </h2>
                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  Every build outputs a real codebase — with every layer connected. You're not customizing a theme or filling in a wizard. You're starting from a working product.
                </p>
                <Link
                  href={session ? "/dashboard" : "/register"}
                  className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2")}
                >
                  {session ? "Open dashboard" : "Start building free"}
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {WHAT_YOU_GET.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-4 py-3.5 text-sm transition-colors hover:border-primary/30"
                  >
                    <Check className="size-4 shrink-0 text-primary" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            FINAL CTA
        ══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          <div className="lp-cta-bg" aria-hidden="true" />
          <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 lg:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
                <Sparkles className="size-3.5 text-primary" />
                <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-primary">
                  For people who ship
                </span>
              </div>
              <h2 className="text-balance text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
                Bring the reference.<br />
                <span className="lp-gradient-text">Leave with momentum.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-pretty text-base leading-7 text-muted-foreground">
                Stop spending your first week fighting config files and auth boilerplate. Start with a working foundation and build the parts that actually matter.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href={session ? "/dashboard" : "/register"}
                  className={cn(buttonVariants({ size: "lg" }), "lp-cta-primary h-13 gap-2 px-8 text-base")}
                >
                  {session ? "Back to your dashboard" : "Start building — it's free"}
                  <ArrowRight className="size-5" />
                </Link>
                <Link
                  href="/pricing"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-13 gap-2 px-8 text-base")}
                >
                  See pricing
                </Link>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Free plan includes 500 credits on email verification. No credit card required.
              </p>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  )
}
