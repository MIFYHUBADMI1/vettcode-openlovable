"use client"

import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  Check,
  Database,
  GitBranch,
  Globe2,
  Lightbulb,
  Link2,
  Rocket,
  Server,
  Shield,
  Users,
  Zap,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FadeIn } from "@/components/landing/fade-in"
import { ProductShot } from "@/components/landing/product-shot"
import { AuthTrigger } from "@/components/auth/auth-trigger"
import { useSession } from "@/lib/client/api"

const LIFECYCLE = [
  { id: "idea", title: "Idea", body: "Share your business vision." },
  { id: "plan", title: "Plan", body: "Collaborate with your AI co-founder." },
  { id: "build", title: "Build", body: "Create your application with AI agents." },
  { id: "launch", title: "Launch", body: "Deploy and configure everything you need." },
  { id: "manage", title: "Manage", body: "Run your application and business from one place." },
  { id: "grow", title: "Grow", body: "Use analytics, iteration, and product tools to scale." },
]

const START_CARDS = [
  { href: "/new/idea", icon: Lightbulb, title: "Your Idea", body: "Describe what you want to build." },
  { href: "/new/website", icon: Globe2, title: "A Website", body: "Use a website as a reference." },
  { href: "/new/website", icon: Link2, title: "A URL", body: "Give Atai a web address to analyze." },
  { href: "/new/github", icon: GitBranch, title: "GitHub", body: "Bring an existing repository." },
]

const PIPELINE = ["Plan", "AI Agents", "Build", "Test", "Security", "Deploy", "Live"]

const INFRA = [
  { icon: Database, title: "Database", body: "Structured data models and records from day one." },
  { icon: Shield, title: "Authentication", body: "Sign-up, login, sessions, and account flows included." },
  { icon: Server, title: "Hosting", body: "Deploy to a live environment with HTTPS and CDN." },
  { icon: Globe2, title: "Domains", body: "Publish on a subdomain or connect your own domain." },
  { icon: Zap, title: "AI", body: "AI capabilities can be wired into the product you ship." },
  { icon: BarChart3, title: "Infrastructure", body: "Storage, usage, and project limits without assembling DevOps." },
]

const AUDIENCE = [
  { icon: Lightbulb, title: "Founders", body: "Turn an idea into a real product." },
  { icon: Building2, title: "Entrepreneurs", body: "Launch digital businesses without assembling a large technical team." },
  { icon: Rocket, title: "Startups", body: "Build and iterate faster." },
  { icon: Users, title: "Small businesses", body: "Create and manage digital products." },
  { icon: Brain, title: "Co-founders", body: "Work alongside AI to plan and execute." },
]

export function LandingTrust() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-12">
      <div className="mx-auto max-w-6xl px-6 text-center lg:px-10">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
          Everything you need to go from idea to business
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {["Plan with AI", "Build the product", "Deploy live", "Manage operations", "Keep iterating"].map((item) => (
            <span key={item} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingLifecycle() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">More than an AI app builder.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Atai helps you go from an idea to a fully managed digital business — all in one platform.
            </p>
          </div>
        </FadeIn>

        <div className="lp-lifecycle mt-14">
          {LIFECYCLE.map((step, index) => (
            <FadeIn key={step.id} delay={index * 70} className="lp-lifecycle-step">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-indigo-500">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-lg font-bold">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingStart() {
  return (
    <section id="start" className="border-y border-border/60 bg-card/20 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <FadeIn>
          <div className="max-w-2xl">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Start with what you have.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Whether you have an idea, a website, a URL, or an existing GitHub project, Atai gives you a path forward.
            </p>
          </div>
        </FadeIn>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {START_CARDS.map((card, index) => (
            <FadeIn key={`${card.title}-${index}`} delay={index * 80}>
              <Link
                href={card.href}
                className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <card.icon className="size-5 text-indigo-500" />
                <p className="mt-5 text-lg font-bold">{card.title}</p>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{card.body}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-300">
                  Continue <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingPlan() {
  return (
    <section id="plan" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FadeIn>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Plan · AI collaboration</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Turn your idea into a plan.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Don&apos;t jump straight into code. Work with AI to refine your business, product, users, features, pricing, and requirements before you build.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              {[
                "Your vision is understood before anything is generated.",
                "AI suggests improvements you can accept, reject, or refine.",
                "The plan becomes the source of truth Atai builds from.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  {item}
                </li>
              ))}
            </ul>
          </FadeIn>
          <FadeIn delay={120}>
            <ProductShot
              src="/landing-images/atai-workspace.png"
              alt="Atai workspace showing founder overview, team activity, and AI collaboration"
              width={1672}
              height={941}
            />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

export function LandingBuild() {
  return (
    <section id="build" className="border-y border-border/60 bg-card/20 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FadeIn className="lg:order-2">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">From plan to working product.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Once your plan is ready, Atai turns it into a working application with the infrastructure your product needs.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {PIPELINE.map((step, index) => (
                <span key={step} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                  {step}
                  {index < PIPELINE.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                </span>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Atai is built for engineering rigor — not impossible guarantees. You still review, refine, and own the result.
            </p>
          </FadeIn>
          <FadeIn delay={100} className="lg:order-1">
            <ProductShot
              src="/landing-images/atai-product.png"
              alt="Atai application editor showing pages, content, and live product analytics"
              width={1671}
              height={941}
            />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

export function LandingInfra() {
  return (
    <section id="infrastructure" className="py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <FadeIn>
          <div className="max-w-2xl">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Your business. Our infrastructure.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Atai handles the technical foundation so you can focus on building your business.
            </p>
          </div>
        </FadeIn>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INFRA.map((item, index) => (
            <FadeIn key={item.title} delay={index * 60}>
              <article className="h-full rounded-2xl border border-border/70 bg-card p-6">
                <item.icon className="size-5 text-indigo-500" />
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingManage() {
  return (
    <section id="manage" className="border-y border-border/60 bg-card/20 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FadeIn>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Launch · Manage</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Your product is only the beginning.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Launch without the technical maze. Manage the application and everything around it from one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Overview", "Applications", "Customers", "Payments", "Database", "AI", "Analytics", "Domains", "Deployment"].map((item) => (
                <span key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {item}
                </span>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <ProductShot
              src="/landing-images/atai-growth.png"
              alt="Atai business operations view with analytics, payments, team, and deployment"
              width={1672}
              height={941}
            />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

export function LandingGrow() {
  return (
    <section id="grow" className="py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <FadeIn>
          <div className="max-w-2xl">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Build it. Launch it. Grow it.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Launch is not the finish line. Keep improving the product, understanding usage, and iterating with AI after you ship.
            </p>
          </div>
        </FadeIn>
        <div className="mt-12 grid gap-4 sm:grid-cols-5">
          {["Launch", "Understand", "Improve", "Acquire", "Scale"].map((step, index) => (
            <FadeIn key={step} delay={index * 70}>
              <div className="rounded-2xl border border-border/70 bg-card p-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-500">{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-2 font-bold">{step}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingAudience() {
  return (
    <section id="audience" className="border-y border-border/60 bg-card/20 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <FadeIn>
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Built for people building something.</h2>
        </FadeIn>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {AUDIENCE.map((item, index) => (
            <FadeIn key={item.title} delay={index * 60}>
              <article className="h-full rounded-2xl border border-border/70 bg-card p-5">
                <item.icon className="size-5 text-indigo-500" />
                <h3 className="mt-4 font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingFinalCta({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string
  ctaLabel: string
}) {
  const { session } = useSession()
  return (
    <section className="relative overflow-hidden bg-[#0B1220] py-28 text-white">
      <div className="lp-cta-finale" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-10">
        <FadeIn>
          <h2 className="text-4xl font-black tracking-tight sm:text-6xl">Your idea is only the beginning.</h2>
          <p className="mt-5 text-lg leading-8 text-white/70">
            Build the product. Launch the business. Grow what comes next.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {session ? (
              <Link href={ctaHref} className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 font-semibold")}>
                {ctaLabel}
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 font-semibold")}>
                {ctaLabel}
                <ArrowRight className="size-4" />
              </AuthTrigger>
            )}
            <a
              href="#how-it-works"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white")}
            >
              See how Atai works
            </a>
          </div>
          <p className="mt-6 text-sm text-white/50">Free to start — 500 credits after verification. No credit card required.</p>
        </FadeIn>
      </div>
    </section>
  )
}


