"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Globe, Lightbulb, Users, FolderOpen, Compass, Brain, TrendingUp } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { ProjectList } from "@/components/project-list"
import { OnboardingTour } from "@/components/onboarding-tour"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { useSession } from "@/lib/client/api"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login?next=%2Fdashboard")
    }
  }, [session, isLoading, router])

  // Don't render the page until authenticated
  if (isLoading || !session) return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      {/* Render OnboardingTour outside the auth guard so it can detect new users */}
      <OnboardingTour />
    </main>
  )

  const firstName = session.user.name?.trim().split(/\s+/)[0] || "builder"

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <OnboardingTour />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-6 border-b border-border pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Dashboard</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Good to see you, {firstName}.</h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              Your team is ready. Pick a starting point and Atai handles the build, launch, and everything in between.
            </p>
          </div>
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            <FolderOpen className="size-4" />
            All projects
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* ── Start a new project — three entry points ── */}
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Start a new project
          </p>
          <div className="grid gap-4 md:grid-cols-3">

            {/* Idea mode */}
            <Link
              href="/new/idea"
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <div>
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
                  <Lightbulb className="size-5 text-primary" />
                </div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary mb-2">
                  Idea mode
                </p>
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  Turn your business idea into a real product
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Describe the problem you&apos;re solving and who it&apos;s for. Atai plans, builds, and launches a full-stack application — with database, auth, and payments included.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Business plan", "Full-stack app", "Payments", "User auth"].map(tag => (
                    <span key={tag} className="rounded-md border border-primary/15 bg-primary/5 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-primary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
                Describe your business
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            {/* Website / competitor mode */}
            <Link
              href="/new/website"
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-all hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5"
            >
              <div>
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-violet-500/10">
                  <Globe className="size-5 text-violet-500" />
                </div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-500 mb-2">
                  Competitor mode
                </p>
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  Build on top of a competitor or reference
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Paste any website URL. Atai analyses its structure, product logic, and design — then rebuilds the concept as your own fully owned application.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["URL analysis", "Your own code", "Custom branding", "Editable"].map(tag => (
                    <span key={tag} className="rounded-md border border-violet-500/15 bg-violet-500/5 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-violet-500">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-violet-500">
                Paste a URL
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            {/* GitHub mode */}
            <Link
              href="/new/github"
              className="group relative flex flex-col justify-between rounded-2xl border border-purple-500/25 bg-card p-6 transition-all hover:border-purple-500/50 hover:bg-purple-500/5 hover:shadow-lg hover:shadow-purple-500/5"
            >
              <div className="absolute right-4 top-4 rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                New
              </div>
              <div>
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-purple-500/10">
                  <GitHubIcon className="size-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-2">
                  GitHub mode
                </p>
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  Continue or rebuild from an existing codebase
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Link any public or private GitHub repository. Atai reads the code, understands what it does, and either extends it with your requested changes or rebuilds it as a new product.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Clone repo", "Extend codebase", "Private repos", "Full rebuild"].map(tag => (
                    <span key={tag} className="rounded-md border border-purple-500/15 bg-purple-500/5 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-purple-600 dark:text-purple-400">
                Connect a repo
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>

          {/* What you get with every project */}
          <div className="mt-4 rounded-xl border border-border bg-muted/20 px-5 py-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Every project includes — out of the box
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {[
                "Full-stack Next.js codebase",
                "Authentication & user management",
                "Database & data models",
                "Backend API routes",
                "Payment integration",
                "Infrastructure & deployment",
                "AI integration",
                "You own the code",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <OnboardingChecklist />
        <ProjectList />

        {/* ── Explore — see what other founders are building ── */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Compass className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">See what other founders are building</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                  Browse live apps built by the Atai community. Find inspiration, fork a project
                  straight into your workspace, or see what&apos;s possible with your own idea.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "Discover", body: "Real businesses built by real founders — each one live and deployed." },
                    { label: "Fork", body: "Clone any public project into your workspace and make it your own." },
                    { label: "Get inspired", body: "See what Atai can build and use it as a starting point for yours." },
                  ].map(({ label, body }) => (
                    <div key={label} className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                      <p className="text-xs text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Link
              href="/explore"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Browse the library
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* ── Referral — grow together ── */}
        <Link
          href="/referrals"
          className="group flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Help other founders — earn credits</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                Know someone with a business idea? Refer them to Atai and earn up to{" "}
                <span className="font-semibold text-foreground">2,000 Atai Credits</span> for every
                successful referral. Credits never expire.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500/60" />
                  500 credits when they verify email
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500/60" />
                  1,500 credits when they hit 75k usage
                </span>
              </div>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors group-hover:bg-emerald-500/20">
            Get your referral link
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>
    </main>
  )
}
