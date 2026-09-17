"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import {
  ArrowRight, Check, ChevronRight, ExternalLink,
  Brain, Code2, Rocket, TrendingUp, Search, DollarSign,
  Users, Zap, Globe2, Database, Shield, Server, BarChart3,
  Lightbulb, Target, Building2, Star,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useSession } from "@/lib/client/api"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

// ─── Typewriter ───────────────────────────────────────────────────────────────

const HERO_PHRASES = [
  "your team.",
  "your co-founder.",
  "your engineers.",
  "your product builders.",
  "your growth team.",
  "your infrastructure.",
]

function TypewriterText() {
  const [text, setText] = useState("")
  const [cursorOn, setCursorOn] = useState(true)
  const state = useRef({ phraseIdx: 0, charIdx: 0, erasing: false, timer: null as ReturnType<typeof setTimeout> | null })

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const s = state.current
    function step() {
      const phrase = HERO_PHRASES[s.phraseIdx]
      if (!s.erasing) {
        s.charIdx++
        setText(phrase.slice(0, s.charIdx))
        if (s.charIdx === phrase.length) {
          s.timer = setTimeout(() => { s.erasing = true; step() }, 3000)
        } else {
          s.timer = setTimeout(step, 80 + Math.random() * 40)
        }
      } else {
        s.charIdx--
        setText(phrase.slice(0, s.charIdx))
        if (s.charIdx === 0) {
          s.erasing = false
          s.phraseIdx = (s.phraseIdx + 1) % HERO_PHRASES.length
          s.timer = setTimeout(step, 400)
        } else {
          s.timer = setTimeout(step, 40)
        }
      }
    }
    s.timer = setTimeout(step, 800)
    return () => { if (s.timer) clearTimeout(s.timer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span>
      <span className="lp-gradient-text">{text}</span>
      <span className="lp-cursor" aria-hidden style={{ opacity: cursorOn ? 1 : 0 }}>|</span>
    </span>
  )
}

// ─── Counter animation ────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const duration = 1800
      const start = Date.now()
      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        setCount(Math.floor(ease * target))
        if (progress < 1) requestAnimationFrame(tick)
        else setCount(target)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ─── Fade-in on scroll ────────────────────────────────────────────────────────

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.12 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TEAM_MEMBERS = [
  {
    icon: Brain,
    name: "AI Co-Founder",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    tagline: "Your strategic partner throughout the journey",
    skills: ["Business model", "Product strategy", "Competitive analysis", "Priorities", "Growth opportunities", "Next steps"],
  },
  {
    icon: Code2,
    name: "Product & Engineering",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    tagline: "Turns your vision into a working product",
    skills: ["Full-stack development", "UI & UX", "Authentication", "Database & APIs", "Infrastructure", "Deployment"],
  },
  {
    icon: TrendingUp,
    name: "Growth Team",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    tagline: "Helps you move beyond having a product",
    skills: ["Launch strategy", "SEO & content", "Customer acquisition", "Analytics", "Growth experiments", "Positioning"],
  },
  {
    icon: Search,
    name: "Research & Strategy",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    tagline: "Understand the market you're entering",
    skills: ["Market research", "Competitor analysis", "Customer research", "Product opportunities", "Business strategy"],
  },
  {
    icon: DollarSign,
    name: "Funding Support",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    tagline: "Prepare for external capital when ready",
    skills: ["Pitch preparation", "Investor readiness", "Financial modelling", "Funding opportunities", "Network connections"],
  },
]

const JOURNEY_STEPS = [
  { n: "01", icon: Lightbulb, title: "Imagine", body: "Tell Atai what you want to build. No technical knowledge required." },
  { n: "02", icon: Brain, title: "Plan", body: "Your AI co-founder turns your idea into a detailed business and product plan." },
  { n: "03", icon: Users, title: "Collaborate", body: "Work with Atai to refine the strategy, features, and business model until it's exactly right." },
  { n: "04", icon: Code2, title: "Build", body: "Your AI development team turns the approved plan into the actual working product." },
  { n: "05", icon: Rocket, title: "Launch", body: "Infrastructure, deployment, authentication, database, and payments — all brought together." },
  { n: "06", icon: BarChart3, title: "Operate", body: "Manage your customers, product, data, payments and business from one platform." },
  { n: "07", icon: TrendingUp, title: "Grow", body: "Improve the product, acquire customers, experiment, and keep building." },
  { n: "08", icon: Building2, title: "Scale", body: "As your business grows, Atai's technology and capabilities grow with it." },
]

const MILESTONES = [
  { value: "$0", label: "The idea", desc: "Every business starts here." },
  { value: "$1", label: "First customer", desc: "Proof it works." },
  { value: "$10K", label: "Early traction", desc: "Something is clicking." },
  { value: "$100K", label: "Growing business", desc: "Real momentum now." },
  { value: "$1M+", label: "Scaled company", desc: "The engine is running." },
  { value: "$10M+", label: "Expansion", desc: "Time to go bigger." },
  { value: "$100M+", label: "Serious scale", desc: "Category leader." },
  { value: "$1B+", label: "The ambition", desc: "Built for founders thinking this big." },
]

const WHAT_YOU_DONT_NEED = [
  "A technical co-founder before starting",
  "A huge engineering team",
  "A perfect product on day one",
  "A massive budget",
  "Years of technical experience",
  "A complicated technology stack",
  "Months of preparation",
]

const OLD_FOUNDER_STACK = [
  "Founder", "Developer", "Designer", "Product Manager",
  "AI Engineer", "Marketer", "Growth Specialist", "DevOps",
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const { session } = useSession()
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveStep((v) => (v + 1) % 8), 3500)
    return () => clearInterval(id)
  }, [])

  const ctaHref = session ? "/dashboard" : "/register"
  const ctaLabel = session ? "Open dashboard →" : "Start building your business →"

  return (
    <main className="lp-root min-h-svh overflow-x-hidden bg-background text-foreground">
      {/* Ambient background */}
      <div className="lp-ambient" aria-hidden />
      <div className="lp-grid" aria-hidden />

      <SiteHeader />

      {/* ══════════════════════════════════════════════════════════
          HERO — split view: left messaging / right at-a-glance
      ══════════════════════════════════════════════════════════ */}
      <section className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-16 lg:px-10 lg:pt-24">

        {/* ── Floating background icons ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { icon: Globe2, x: "8%", y: "12%", size: 28, delay: 0, dur: 7 },
            { icon: Database, x: "88%", y: "18%", size: 22, delay: 0.8, dur: 9 },
            { icon: Shield, x: "5%", y: "62%", size: 20, delay: 1.4, dur: 8 },
            { icon: Code2, x: "92%", y: "55%", size: 26, delay: 0.4, dur: 10 },
            { icon: Brain, x: "15%", y: "82%", size: 24, delay: 1.8, dur: 7.5 },
            { icon: TrendingUp, x: "80%", y: "80%", size: 20, delay: 0.6, dur: 9.5 },
            { icon: DollarSign, x: "50%", y: "5%", size: 18, delay: 2.1, dur: 8.5 },
            { icon: Rocket, x: "72%", y: "8%", size: 22, delay: 1.1, dur: 6.5 },
            { icon: Users, x: "25%", y: "6%", size: 18, delay: 2.5, dur: 11 },
            { icon: Zap, x: "95%", y: "38%", size: 16, delay: 0.2, dur: 7 },
            { icon: Search, x: "3%", y: "35%", size: 16, delay: 1.6, dur: 8 },
            { icon: BarChart3, x: "58%", y: "90%", size: 20, delay: 0.9, dur: 9 },
          ].map(({ icon: Icon, x, y, size, delay, dur }, i) => (
            <div
              key={i}
              className="absolute opacity-[0.06] dark:opacity-[0.08]"
              style={{
                left: x, top: y,
                animation: `heroFloat ${dur}s ease-in-out ${delay}s infinite`,
              }}
            >
              <Icon style={{ width: size, height: size }} className="text-primary" />
            </div>
          ))}
        </div>

        {/* ── Split grid ── */}
        <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">

          {/* LEFT — messaging */}
          <div className="flex flex-col items-start">

            {/* Eyebrow */}
            <div className="lp-badge mb-7 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 backdrop-blur-sm">
              <span className="lp-live-dot size-1.5 rounded-full bg-primary" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                The AI Business-Building Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="lp-h1 text-balance text-5xl font-black leading-[1.03] tracking-[-0.04em] sm:text-6xl xl:text-[4.5rem]">
              Build the business.
              <br />
              <span className="text-muted-foreground font-light">Not the burden.</span>
            </h1>

            {/* Typewriter */}
            <p className="lp-copy mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
              Your idea deserves a team.{" "}
              Atai gives you <TypewriterText />
            </p>

            {/* Body */}
            <p className="mt-5 text-base leading-8 text-muted-foreground max-w-lg">
              From your first idea to your first customer — and from your first customer to your next
              stage of growth — Atai brings together an AI co-founder, specialist agents, product
              development, technology, infrastructure and business resources to help you build,
              launch and grow.
            </p>

            {/* Big statement */}
            <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">
                You don&apos;t need to build the team first.
              </p>
              <p className="mt-0.5 text-primary font-bold text-lg">
                The team is already here.
              </p>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={ctaHref}
                className={cn(buttonVariants({ size: "lg" }), "lp-cta-primary h-13 gap-2 px-7 text-base font-bold")}
              >
                {ctaLabel}
                <ArrowRight className="size-5" />
              </Link>
              <a
                href="#how-it-works"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-13 gap-2 px-7 text-base")}
              >
                See the journey
              </a>
            </div>

            {/* Proof chips */}
            <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs text-muted-foreground">
              {["No hiring required", "No coding needed", "Built for founders thinking big"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-3 py-1.5">
                  <span className="size-1.5 rounded-full bg-primary/60" />{t}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-3 w-full sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                { n: 2400, s: "+", label: "Founders building" },
                { n: 14, s: "×", label: "Faster to launch" },
                { n: 8, s: "", label: "Journey stages" },
                { n: 500, s: "", label: "Free credits" },
              ].map(({ n, s, label }) => (
                <div key={label} className="flex flex-col items-center gap-0.5 rounded-xl border border-border/40 bg-card/40 px-3 py-3 backdrop-blur-sm">
                  <p className="text-xl font-black text-foreground tabular-nums">
                    <AnimatedCounter target={n} suffix={s} />
                  </p>
                  <p className="text-[10px] text-muted-foreground text-center">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — at-a-glance what Atai does */}
          <div className="flex flex-col gap-4">

            {/* Header */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-center">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-1">
                Everything out of the box
              </p>
              <p className="text-sm font-bold text-foreground">
                Idea or URL in.{" "}
                <span className="text-primary">Complete running business out.</span>
              </p>
            </div>

            {/* Step 1 — Input */}
            <div className="rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <Lightbulb className="size-3.5 text-violet-400" />
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-violet-400">01 — Bring your signal</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: "💡", label: "Your idea", desc: "Plain language" },
                  { icon: "🌐", label: "Competitor URL", desc: "We rebuild it" },
                  { icon: "📂", label: "GitHub repo", desc: "Clone or extend" },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-background/50 px-2 py-3 text-center">
                    <span className="text-xl">{icon}</span>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 — Build */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15">
                  <Code2 className="size-3.5 text-primary" />
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">02 — Atai builds your product</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { icon: Globe2, label: "Frontend" },
                  { icon: Server, label: "Backend" },
                  { icon: Database, label: "Database" },
                  { icon: Shield, label: "Auth" },
                  { icon: DollarSign, label: "Payments" },
                  { icon: Users, label: "User Mgmt" },
                  { icon: Zap, label: "AI" },
                  { icon: BarChart3, label: "Infra" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 rounded-lg border border-primary/15 bg-primary/5 px-1.5 py-2">
                    <Icon className="size-3.5 text-primary" />
                    <p className="text-[9px] font-medium text-muted-foreground text-center leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 — Launch & Grow */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Rocket className="size-3.5 text-emerald-400" />
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">03 — Launch, market &amp; scale</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "🚀", label: "One-click deploy" },
                  { icon: "📣", label: "Marketing & launch" },
                  { icon: "📊", label: "Operate from 1 place" },
                  { icon: "📈", label: "Grow & scale" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-background/40 px-3 py-2.5">
                    <span className="text-base">{icon}</span>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom summary */}
            <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 text-center">
              <p className="font-mono text-[10px] text-muted-foreground">
                No coding · No hiring · No waiting ·{" "}
                <span className="text-primary font-semibold">Everything configured from day one</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          EMOTIONAL SECTION
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-border/60 bg-card/20 py-28">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-10">
          <FadeIn>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">
              The truth about building a business
            </p>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
              Someone told you building a{" "}
              <span className="lp-gradient-text">million-dollar business</span>{" "}
              would be hard.
            </h2>
            <p className="mt-4 text-xl text-muted-foreground font-medium">They weren&apos;t wrong.</p>
          </FadeIn>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Finding the right people is hard.",
              "Building the product is hard.",
              "Understanding technology is hard.",
              "Marketing is hard.",
              "Getting customers is hard.",
              "Managing infrastructure is hard.",
              "Finding funding is hard.",
              "Doing all of it alone is harder.",
            ].map((line, i) => (
              <FadeIn key={line} delay={i * 80}>
                <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm">
                  {line}
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={400}>
            <div className="mt-14">
              <p className="text-2xl font-bold text-foreground">
                But you shouldn&apos;t have to do all of it alone.
              </p>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-8">
                Atai is designed to give ambitious founders the team and technology they need to move
                from an idea to a real business — without first having to build an entire company
                around themselves.
              </p>
              <div className="mt-8 inline-block rounded-2xl border border-primary/30 bg-primary/5 px-8 py-5">
                <p className="text-lg font-semibold">Your job is to lead the vision.</p>
                <p className="mt-1 text-primary font-bold text-xl">Atai helps you execute it.</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          THE TEAM
      ══════════════════════════════════════════════════════════ */}
      <section className="py-28" id="team">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                Meet the team behind your business
              </p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                You don&apos;t need a team to start.
              </h2>
              <p className="mt-3 text-3xl font-bold text-primary">Atai is your team.</p>
              <p className="mt-5 max-w-2xl mx-auto text-lg text-muted-foreground leading-8">
                An AI co-founder. Specialist agents. Product builders. Engineers. Researchers.
                Growth specialists. Infrastructure. Technology. All working together around your business.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM_MEMBERS.map((member, i) => (
              <FadeIn key={member.name} delay={i * 100}>
                <div className={`flex flex-col gap-4 rounded-2xl border ${member.border} ${member.bg} p-6 backdrop-blur-sm h-full`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${member.bg} border ${member.border}`}>
                      <member.icon className={`size-5 ${member.color}`} />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${member.color}`}>{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.tagline}</p>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {member.skills.map((skill) => (
                      <li key={skill} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={`size-1 rounded-full shrink-0 ${member.color.replace("text-", "bg-")}`} />
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}

            {/* Tagline card */}
            <FadeIn delay={500}>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center sm:col-span-2 lg:col-span-1">
                <p className="text-lg font-semibold text-foreground">One founder.</p>
                <p className="text-lg font-semibold text-foreground">One platform.</p>
                <p className="text-2xl font-black text-primary mt-1">One team.</p>
                <Link href={ctaHref} className={cn(buttonVariants({ size: "sm" }), "mt-6 gap-1.5")}>
                  Meet your team <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          OLD WAY vs ATAI
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-border/60 bg-card/20 py-28">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                The old way vs Atai
              </p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                You don&apos;t need to build a company
                <br />
                <span className="text-muted-foreground font-light">before you can build your business.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid gap-12 lg:grid-cols-2">
            {/* Old way */}
            <FadeIn>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-destructive/70 mb-5">
                  The old way
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Normally a founder has to assemble an entire company before they can build their business:
                </p>
                <div className="flex flex-wrap gap-2">
                  {OLD_FOUNDER_STACK.map((role, i) => (
                    <span key={role} className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {role}
                      {i < OLD_FOUNDER_STACK.length - 1 && <span className="ml-2 text-destructive/40">→</span>}
                    </span>
                  ))}
                </div>
                <p className="mt-6 text-sm font-medium text-muted-foreground">
                  And suddenly the person who had the idea is spending their entire life trying to assemble a company.
                </p>
              </div>
            </FadeIn>

            {/* Atai way */}
            <FadeIn delay={150}>
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary mb-5">
                  The Atai way
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  You start with the vision. Atai provides the technology, AI agents, specialist capabilities and infrastructure around it.
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "You", desc: "Lead the vision & make decisions", highlight: true },
                    { label: "Atai", desc: "Brings the team, technology & infrastructure", highlight: false },
                  ].map(({ label, desc, highlight }) => (
                    <div key={label} className={`flex items-center gap-3 rounded-xl border p-4 ${highlight ? "border-primary/40 bg-primary/10" : "border-border/50 bg-card/60"}`}>
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-sm ${highlight ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {label[0]}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm font-bold text-primary">
                  One founder. One platform. One team. →
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          JOURNEY — 8 STEPS
      ══════════════════════════════════════════════════════════ */}
      <section className="py-28" id="how-it-works">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                The journey
              </p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                From idea to empire —
                <br />
                <span className="text-muted-foreground font-light">one step at a time.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY_STEPS.map((step, i) => (
              <FadeIn key={step.n} delay={i * 80}>
                <div
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border p-6 cursor-default transition-all duration-300",
                    activeStep === i
                      ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/50 bg-card/40 hover:border-primary/20 hover:bg-card/60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-primary/50">{step.n}</span>
                    <step.icon className={cn("size-4 transition-colors", activeStep === i ? "text-primary" : "text-muted-foreground group-hover:text-primary/60")} />
                  </div>
                  <p className="font-bold text-foreground">{step.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{step.body}</p>
                  {activeStep === i && (
                    <span className="absolute right-3 top-3 flex size-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={300}>
            <div className="mt-10 text-center">
              <Link href={ctaHref} className={cn(buttonVariants({ size: "lg" }), "lp-cta-primary gap-2")}>
                Start your journey <ArrowRight className="size-4" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          MILESTONE LADDER
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-border/60 bg-card/20 py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                Built for ambition
              </p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                From $0 to your next milestone.
              </h2>
              <p className="mt-5 max-w-xl mx-auto text-muted-foreground leading-8">
                Atai is built to stay with you through the journey. The technology you need changes as your business grows.
                <span className="text-foreground font-semibold"> Your platform should evolve with you.</span>
              </p>
            </div>
          </FadeIn>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[2.25rem] top-4 bottom-4 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent hidden sm:block" />

            <div className="flex flex-col gap-2">
              {MILESTONES.map((m, i) => (
                <FadeIn key={m.value} delay={i * 60}>
                  <div className="flex items-center gap-5 rounded-xl border border-border/40 bg-card/50 px-5 py-4 backdrop-blur-sm hover:border-primary/30 hover:bg-card/70 transition-all group">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-black text-primary text-sm relative z-10">
                      {i + 1}
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="font-black text-xl text-foreground group-hover:text-primary transition-colors">{m.value}</span>
                        <span className="ml-3 text-sm font-semibold text-foreground/80">{m.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    {i === MILESTONES.length - 1 && (
                      <Star className="size-4 text-primary shrink-0" />
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          <FadeIn delay={400}>
            <p className="mt-10 text-center text-sm text-muted-foreground italic">
              We don&apos;t decide how big your dream can become. We give you the machinery to pursue it.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          WHAT YOU DON'T NEED
      ══════════════════════════════════════════════════════════ */}
      <section className="py-28">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-10">
          <FadeIn>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">
              Stop waiting until you&apos;re ready
            </p>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
              What if you stopped waiting?
            </h2>
          </FadeIn>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {WHAT_YOU_DONT_NEED.map((item, i) => (
              <FadeIn key={item} delay={i * 60}>
                <div className="flex items-center gap-3 rounded-xl border border-destructive/15 bg-destructive/5 px-5 py-3 text-left">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive text-xs font-bold">✕</span>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={300}>
            <div className="mt-14 space-y-4">
              {[
                { text: "You need a problem worth solving.", highlight: false },
                { text: "You need the courage to start.", highlight: false },
                { text: "And you need the right people and technology around you.", highlight: true },
              ].map(({ text, highlight }) => (
                <p key={text} className={`text-xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
                  {text}
                </p>
              ))}
              <p className="mt-4 text-muted-foreground">That&apos;s what Atai is building.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TECHNOLOGY CAPABILITIES (kept from original)
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-border/60 bg-card/20 py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                The technology
              </p>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
                Everything your business needs.
                <br />
                <span className="text-muted-foreground font-light">Built and wired together.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Globe2, label: "Frontend", title: "Production-ready UI", body: "Routes, layouts, components, and responsive design. A real interface you own and can extend immediately." },
              { icon: Database, label: "Database", title: "Structured data from day one", body: "Real data models, relationships, and persistence. Not a mockup — a working database from the moment your build completes." },
              { icon: Shield, label: "Authentication", title: "Auth included", body: "Sign-up, login, email verification, sessions, password reset, and role-based access — all wired and working." },
              { icon: Server, label: "Backend", title: "APIs that actually work", body: "Typed API routes connected to real data. Your UI talks to a real backend from the moment the build completes." },
              { icon: Zap, label: "AI Integration", title: "AI built in", body: "AI capabilities, agents, and models integrated directly into your product — not bolted on afterwards." },
              { icon: BarChart3, label: "Infrastructure", title: "Managed infrastructure", body: "Database, storage, usage tracking, and project limits — all provisioned and managed. Zero DevOps required." },
            ].map((cap, i) => (
              <FadeIn key={cap.label} delay={i * 80}>
                <div className="group flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm hover:border-primary/30 transition-all h-full">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <cap.icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary/60">{cap.label}</span>
                    <p className="mt-1 font-bold text-foreground">{cap.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{cap.body}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-32 overflow-hidden">
        {/* Background glow */}
        <div className="lp-cta-bg" aria-hidden />

        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-10">
          <FadeIn>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">
              Built for founders who aren&apos;t thinking small
            </p>
            <h2 className="text-5xl font-black tracking-[-0.04em] leading-[1.02] sm:text-6xl xl:text-7xl">
              You bring the business.
              <br />
              <span className="lp-gradient-text">Atai brings the team.</span>
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-muted-foreground leading-8">
              Whether you&apos;re aiming for your first $1, your first $1M, or something much bigger —
              Atai gives you the technology and team infrastructure to build toward it.
            </p>
            <p className="mt-3 font-mono text-sm text-primary font-semibold">
              From idea → business → growth.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={ctaHref}
                className={cn(buttonVariants({ size: "lg" }), "lp-cta-primary h-14 gap-2 px-10 text-base font-bold")}
              >
                {ctaLabel}
                <ArrowRight className="size-5" />
              </Link>
              <Link
                href="/about"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-14 gap-2 px-8 text-base")}
              >
                Learn more about Atai
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 font-mono text-xs text-muted-foreground">
              {["Free to start — 500 credits included", "No credit card required", "Cancel any time"].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <Check className="size-3 text-primary" />{t}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
