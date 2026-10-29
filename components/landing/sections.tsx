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
  { id: "idea", title: "Idea", body: "Start with your skills, an idea, or a problem you want to solve." },
  { id: "plan", title: "Plan", body: "Define your customers, your offer, and how the business could earn." },
  { id: "build", title: "Build", body: "Create the website or digital product your business needs." },
  { id: "launch", title: "Launch", body: "Get online with hosting, a database, and the tools to serve customers." },
  { id: "manage", title: "Manage", body: "Keep track of customers, payments, and daily operations in one place." },
  { id: "grow", title: "Grow", body: "Work on marketing, learn what brings customers, and improve your offer." },
]

const START_CARDS = [
  { href: "/new/idea", icon: Lightbulb, title: "A business idea", body: "Tell Atai what you could offer and who you want to help." },
  { href: "/new/website", icon: Globe2, title: "Some inspiration", body: "Learn from a business you admire and shape your own approach." },
  { href: "/new/website", icon: Link2, title: "A website", body: "Share a website to explore its customers, offer, and market." },
  { href: "/new/github", icon: GitBranch, title: "An existing product", body: "Bring a GitHub codebase and plan the business around it." },
]

const PIPELINE = ["Business plan", "AI teams", "Create", "Try it out", "Security checks", "Publish", "Go live"]

const INFRA = [
  { icon: Database, title: "Business records", body: "Keep the information your website or product needs in a database." },
  { icon: Shield, title: "Customer accounts", body: "Let customers sign up and log in to their accounts." },
  { icon: Server, title: "Hosting", body: "Put your website or product online with a secure web connection." },
  { icon: Globe2, title: "Your web address", body: "Use an Atai subdomain or connect your own domain so people can find you." },
  { icon: Zap, title: "AI features", body: "Add AI features where they support what your business offers." },
  { icon: BarChart3, title: "Usage and limits", body: "See storage, usage, and limits for your website or product." },
]

const AUDIENCE = [
  { icon: Lightbulb, title: "First-time owners", body: "Take your first steps toward a business, even if you have never run one." },
  { icon: Building2, title: "Small businesses", body: "Bring your business online and make day-to-day work easier to manage." },
  { icon: Rocket, title: "Entrepreneurs", body: "Develop a new offer, learn from customers, and find ways to grow." },
  { icon: Users, title: "Creators and freelancers", body: "Explore how your skills or knowledge could become a paid offer." },
  { icon: Brain, title: "Small teams", body: "Work with specialized AI teams while staying in charge of your business." },
]

const DIFFERENTIATION = [
  {
    icon: Users,
    title: "Instead of hiring a full team",
    tradeoff: "Salaries, hiring, and management come before anything reaches customers.",
    atai: "Specialized AI teams start from your plan and cover building, operations, and marketing in one place.",
  },
  {
    icon: Link2,
    title: "Instead of stitching separate tools",
    tradeoff: "A site builder, automations, and marketing tools each need setup and do not share context.",
    atai: "Your plan, website or product, daily operations, and marketing stay connected to the same business.",
  },
  {
    icon: Rocket,
    title: "Instead of putting it off",
    tradeoff: "Waiting until you can afford help or feel ready leaves the idea on hold.",
    atai: "Start with a skill, an idea, a website, or a codebase — and stay in charge as the business grows.",
  },
]

export function LandingTrust() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-12">
      <div className="mx-auto max-w-6xl px-6 text-center lg:px-10">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
          A business to own. AI teams to help you run it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {["Plan your business", "Build and host", "Manage operations", "Reach customers", "Work toward sales"].map((item) => (
            <span key={item} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingDifferentiation() {
  return (
    <section id="why-atai" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Why founders choose Atai over hiring or stitching tools</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Starting a business means weighing real trade-offs. Atai is built so one person can run the work that usually needs a team or a stack of disconnected tools — while staying in charge of the business.
            </p>
          </div>
        </FadeIn>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {DIFFERENTIATION.map((item, index) => (
            <FadeIn key={item.title} delay={index * 70}>
              <article className="h-full rounded-2xl border border-border/70 bg-card p-6">
                <item.icon className="size-5 text-indigo-500" />
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.tradeoff}</p>
                <p className="mt-4 flex gap-2 text-sm leading-6">
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  <span>{item.atai}</span>
                </p>
              </article>
            </FadeIn>
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
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">A team for every stage of your business.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Starting is one step. Atai’s specialized AI teams help with the work of running a business, serving customers, and finding ways to grow. You stay in charge.
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
              A skill, an idea, or a problem worth solving is enough to begin. If you already have a website or product, bring it along. The goal is a business you can run and grow.
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
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Plan · Your business first</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Start with customers and an offer.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Who could you help, what could you offer, and what would you charge? Work with your AI team to shape a business plan before deciding what website or digital product you need.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              {[
                "Define your customers, their needs, and the value you could offer.",
                "Explore pricing and refine AI suggestions to fit your goals.",
                "Use the plan to guide what you build and how you serve customers.",
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
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Build what your business needs.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Work with Atai’s AI teams to create the website or digital product that supports your offer. It is a way to reach and serve customers, not the whole business.
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
              Review and test the result before customers use it. You decide what goes live and what needs more work.
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
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">The essentials behind your online business.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Your business needs a place online, a way for customers to sign in, and somewhere to keep its information. Atai brings these technical tools together so you have less to set up separately.
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
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Stay on top of the everyday work.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Going live is the start of running the business. Keep track of customers and payments, review activity, and manage your website and business records from one workspace. Your AI teams help with the work; you make the decisions.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Business overview", "Websites and products", "Customers", "Payments", "Business records", "AI tools", "Performance", "Web addresses", "Publishing"].map((item) => (
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
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Your business needs customers, not just a launch.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Work with your AI growth team on marketing, reaching the right people, and understanding what leads to sales. Use what you learn to improve your offer and keep serving your customers.
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
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Business ownership should be within reach.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            Economic opportunity should not depend on being able to afford a whole team. Atai’s purpose is to reduce the barriers to starting, running, managing, and growing an online business with specialized AI teams. The aim is to help anyone take part, not to promise income or business success.
          </p>
          <Link href="/founder" className="mt-4 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Meet Masereka Adorable Kimulya, Atai’s founder
          </Link>
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
          <h2 className="text-4xl font-black tracking-tight sm:text-6xl">Your own business. You don’t have to do it alone.</h2>
          <p className="mt-5 text-lg leading-8 text-white/70">
            Bring your ambition. Start with a plan, and work with your AI teams to launch, manage, and grow a business of your own.
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


