"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight, Brain, Code2, TrendingUp, Search, DollarSign,
  Lightbulb, Rocket, BarChart3, Building2, Users, Shield,
  Globe2, Database, Server, Zap, Star, Check,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Fade-in on scroll ────────────────────────────────────────────────────────

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TEAM = [
  { icon: Brain, name: "AI Co-Founder", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", body: "Your strategic partner throughout the journey. Helps you think through the business model, product strategy, competitive landscape, priorities and next steps." },
  { icon: Code2, name: "Product & Engineering", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", body: "Turns your vision into a working product. Full-stack development, UI & UX, authentication, database, APIs, infrastructure and deployment." },
  { icon: TrendingUp, name: "Growth Team", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", body: "Helps you move beyond simply having a product. Launch strategy, SEO, content, customer acquisition, analytics, and growth experiments." },
  { icon: Search, name: "Research & Strategy", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", body: "Helps you understand the market you're entering. Market research, competitor analysis, customer research, product opportunities, and business strategy." },
  { icon: DollarSign, name: "Funding Support", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", body: "As your business becomes ready for external capital, Atai can help prepare for fundraising and connect eligible businesses with relevant funding opportunities where available." },
]

const PRINCIPLES = [
  { icon: Rocket, title: "Speed", body: "Dramatically reduce the time between an idea and a real, working business." },
  { icon: Building2, title: "Completeness", body: "Go beyond generating an attractive interface. Build toward a complete product with the team and infrastructure required." },
  { icon: Zap, title: "Autonomy", body: "Minimise unnecessary back-and-forth. The platform executes as much of the business-building workflow as possible from the original intent." },
  { icon: Brain, title: "Intelligence", body: "Combine advanced AI capabilities with structured business understanding so the system reasons about what needs to be built before building it." },
  { icon: Users, title: "Leverage", body: "Give founders more time to focus on customers, product decisions, marketing, strategy and growth." },
]

const CAPABILITIES = [
  { icon: Globe2, title: "Frontend", copy: "Routes, components, layouts, responsive design, and meaningful application states." },
  { icon: Server, title: "Backend", copy: "API layers, server logic, and the operations that make the interface more than a static screen." },
  { icon: Shield, title: "Authentication", copy: "Registration, login, email verification, sessions, and account-aware experiences." },
  { icon: Database, title: "Database", copy: "Structured data, models, relationships, and the persistence layer your product needs." },
  { icon: Users, title: "User Management", copy: "Accounts, roles, and application-level user functionality built into the foundation." },
  { icon: BarChart3, title: "Infrastructure", copy: "Deployment configuration, usage monitoring, and backend services your application depends on." },
]

const FAQ = [
  { q: "What is Atai?", a: "Atai is the AI business-building platform that gives founders an AI co-founder, specialist teams, technology and infrastructure to turn ideas into real businesses — then build, launch, operate and scale them from one platform." },
  { q: "Who is Atai for?", a: "Atai is built for ambitious founders who want to move from an idea to a real business without first having to assemble an entire company around themselves. It's for people who aren't thinking small." },
  { q: "Do I need technical knowledge?", a: "No. Atai is designed so that non-technical founders can describe what they want to build in plain language. The platform handles the technical architecture, authentication, database, and deployment automatically." },
  { q: "What does Atai actually build?", a: "Atai generates working full-stack application foundations including frontend, backend, authentication, database, API layers, user management, storage, deployment configuration, and the application logic your product needs." },
  { q: "Can I use the code outside of Atai?", a: "Yes. You own the output. Download it, edit it, deploy it anywhere. There is no vendor lock-in and no proprietary runtime." },
  { q: "What is ATAI Enterprises?", a: "ATAI — Advanced Technologies and AI Enterprises — is the company behind Atai. ATAI focuses on building practical AI-powered technology that transforms complex technical workflows into accessible, automated experiences." },
  { q: "Is Atai currently in early access?", a: "Yes. The current hosted version of Atai represents an early-access stage of the platform. This gives the team real-world feedback, product validation, and the opportunity to continuously improve the system." },
  { q: "How does Atai differ from AI coding tools?", a: "Most AI coding tools generate isolated pieces of code based on individual prompts. Atai is a business-building platform that understands the full context — planning and structuring the entire business and product before generation — so the output is a complete foundation rather than disconnected code fragments." },
]

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        {q}
        <span className={`shrink-0 transition-transform duration-200 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && (
        <p className="pb-5 text-sm leading-7 text-muted-foreground">{a}</p>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AboutContent() {
  return (
    <>
      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center lg:px-10 lg:pt-24">
        <FadeIn>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-xs text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            The AI Business-Building Platform
          </div>
          <h1 className="text-balance text-5xl font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            You bring the vision.
            <br />
            <span className="text-muted-foreground font-light">We bring the team.</span>
          </h1>
          <p className="mt-7 mx-auto max-w-2xl text-pretty text-xl leading-8 text-muted-foreground">
            Atai is the AI-powered business-building platform designed to give ambitious founders
            the team, technology, infrastructure and resources they need to take an idea from conception
            to a real, growing business.
          </p>
          <p className="mt-5 mx-auto max-w-xl text-base leading-7 text-muted-foreground">
            You focus on the vision, customers and decisions.{" "}
            <span className="font-semibold text-foreground">Atai helps handle the rest.</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2 h-12 px-7")}>
              Start building your business <ArrowRight className="size-4" />
            </Link>
            <a href="#how-it-works" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-7")}>
              See how it works
            </a>
          </div>
        </FadeIn>

        {/* Micro-signals */}
        <FadeIn delay={200}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-xs text-muted-foreground">
            {["AI co-founder", "Full-stack engineering", "Growth team", "Research & strategy", "Funding support"].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" /> {t}
              </span>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── THE CORE PROMISE ────────────────────────────────── */}
      <section className="border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <FadeIn>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">Why we built Atai</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Building a business is hard.
                <br />
                <span className="text-muted-foreground font-light">Doing it alone is harder.</span>
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                Finding the right people is hard. Building the product is hard. Understanding
                technology is hard. Marketing is hard. Getting customers is hard.
              </p>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                But the biggest problem isn't that building a business is hard. The biggest problem
                is that founders have to assemble an entire company around themselves before they
                can even start building the business.
              </p>
              <p className="mt-6 text-lg font-bold text-foreground">
                Atai changes that.
              </p>
            </FadeIn>
            <FadeIn delay={150}>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary/70 mb-5">The Atai promise</p>
                <div className="space-y-4">
                  {[
                    "You don't need to find a developer.",
                    "You don't need to assemble a design team.",
                    "You don't need to hire an AI engineer.",
                    "You don't need to figure out infrastructure.",
                    "You don't need to know how to launch a product.",
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-foreground">{line}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-primary/20 pt-5">
                  <p className="text-sm font-bold text-primary">
                    Atai gives you the AI co-founder, specialist agents, technology, infrastructure,
                    and resources you need — from idea to launch and from launch to growth.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── THE TEAM ────────────────────────────────────────── */}
      <section className="py-24" id="how-it-works">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">Your team</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                You don&apos;t need a team to start.
              </h2>
              <p className="mt-2 text-2xl font-bold text-primary">Atai is your team.</p>
              <p className="mt-5 max-w-xl mx-auto text-muted-foreground leading-7">
                An AI co-founder. Specialist agents. Product builders. Engineers. Researchers. Growth
                specialists. Infrastructure. Technology. All working together around your business.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member, i) => (
              <FadeIn key={member.name} delay={i * 80}>
                <div className={`rounded-2xl border ${member.border} ${member.bg} p-6 h-full`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex size-9 items-center justify-center rounded-xl ${member.bg} border ${member.border}`}>
                      <member.icon className={`size-4 ${member.color}`} />
                    </div>
                    <p className={`font-bold text-sm ${member.color}`}>{member.name}</p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{member.body}</p>
                </div>
              </FadeIn>
            ))}

            {/* One founder card */}
            <FadeIn delay={500}>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center sm:col-span-2 lg:col-span-1">
                <p className="text-base font-semibold">One founder.</p>
                <p className="text-base font-semibold">One platform.</p>
                <p className="text-2xl font-black text-primary mt-1">One team.</p>
                <p className="mt-3 text-xs text-muted-foreground max-w-[200px]">
                  Built for founders who aren&apos;t thinking small.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FIVE PRINCIPLES ─────────────────────────────────── */}
      <section className="border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">Our philosophy</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Five principles behind Atai</h2>
            </div>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <FadeIn key={p.title} delay={i * 80}>
                <div className="group flex flex-col gap-4 rounded-2xl border border-border/50 bg-card p-6 hover:border-primary/30 transition-all">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <p.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground">{p.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{p.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT ATAI BUILDS ─────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">The technology</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Everything your business needs — built and wired together.
              </h2>
            </div>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap, i) => (
              <FadeIn key={cap.title} delay={i * 70}>
                <div className="group flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-6 hover:border-primary/30 transition-all h-full">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <cap.icon className="size-4 text-primary" />
                  </div>
                  <p className="font-bold text-sm text-foreground">{cap.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{cap.copy}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE MILESTONE AMBITION ───────────────────────────── */}
      <section className="border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-10">
          <FadeIn>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">Built for ambition</p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              From $0 to your next milestone.
            </h2>
            <p className="mt-5 max-w-xl mx-auto text-muted-foreground leading-7">
              The technology you need changes as your business grows. Your team changes.
              Your customers change. Your infrastructure changes.
            </p>
            <p className="mt-2 text-foreground font-semibold">Your platform should evolve with you.</p>
            <div className="mt-10 inline-flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-8 py-5">
              <Star className="size-5 text-primary shrink-0" />
              <p className="text-base font-bold text-foreground">
                We don&apos;t decide how big your dream can become.
                <span className="text-primary"> We give you the machinery to pursue it.</span>
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── ABOUT ATAI / ATAI ENTERPRISES ───────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <FadeIn>
            <div className="mb-10">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">The company</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">About ATAI Enterprises</h2>
            </div>
            <div className="space-y-5 text-base leading-8 text-muted-foreground">
              <p>
                ATAI — Advanced Technologies and AI Enterprises — is the company behind Atai. ATAI focuses on building
                practical AI-powered technology that transforms complex technical workflows into accessible, automated
                experiences.
              </p>
              <p>
                Atai began around a simple but ambitious idea: that founders shouldn&apos;t have to spend their time
                assembling a company before they can build their business. The technology to help non-technical founders
                move from an idea to a real product already exists. The missing piece was a platform that brought it
                all together around the business — not just the code.
              </p>
              <p>
                The current hosted version of Atai represents an early-access stage of the platform. This gives the
                team real-world feedback, product validation, and the opportunity to continuously improve the system
                based on how real founders actually build.
              </p>
              <p className="text-foreground font-semibold">
                We&apos;re building Atai with real users — because the best way to build a business-building platform
                is to be used by people who are actually building businesses.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <FadeIn>
            <div className="mb-12">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">Questions</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Frequently asked</h2>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="rounded-2xl border border-border bg-card px-6">
              {FAQ.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <FadeIn>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
              You bring the business.
              <br />
              <span className="text-primary">Atai brings the team.</span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">From idea → business → growth.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "gap-2 h-13 px-8")}>
                Start building free <ArrowRight className="size-4" />
              </Link>
              <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-13 px-8")}>
                See pricing
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
