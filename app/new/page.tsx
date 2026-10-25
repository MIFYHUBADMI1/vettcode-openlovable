"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Globe, Lightbulb, ShieldCheck } from "lucide-react"
import { AuthGate } from "@/components/auth/auth-gate"
import { GitHubIcon } from "@/components/github-icon"
import { AppHeader } from "@/components/app-header"
import { LandingComposer } from "@/components/landing/composer"
import {
  beginStartFlow,
  trackStartMethodSelected,
  type StartMethod,
} from "@/lib/analytics/start-funnel"
import { cn } from "@/lib/utils"

const SOURCES = [
  {
    id: "idea",
    href: "/new/idea",
    icon: Lightbulb,
    title: "An idea",
    body: "Start with a problem, vision, or business concept. Describe it in your own words and shape it with Atai.",
    cta: "Describe your idea",
    tone: "primary" as const,
  },
  {
    id: "website",
    href: "/new/website",
    icon: Globe,
    title: "A website",
    body: "Use a reference site to explore a business model or product experience — not to copy it.",
    cta: "Use a website",
    tone: "neutral" as const,
  },
  {
    id: "github",
    href: "/new/github",
    icon: GitHubIcon,
    title: "An existing codebase",
    body: "Bring a GitHub repository to continue, improve, or extend an application that already exists.",
    cta: "Use a repository",
    tone: "violet" as const,
    experimental: true,
  },
]

const JOURNEY = [
  { n: "01", title: "Imagine", body: "Describe the business you want to build. Plain language is enough." },
  { n: "02", title: "Plan", body: "Atai drafts the product plan. You review and refine it first." },
  { n: "03", title: "Build", body: "Approve the plan first, and Atai builds the working application." },
  { n: "04", title: "Launch", body: "Publish it, then keep managing and growing from your workspace." },
]

export default function NewProjectPage() {
  useEffect(() => {
    // Starts the funnel clock. Submission/plan events live downstream.
    beginStartFlow({ method: "idea", surface: "new" })
  }, [])

  return (
    <AuthGate next="/new">
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />

        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>

          <section className="mx-auto mt-10 w-full max-w-3xl text-center sm:mt-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Your next business starts here
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn your idea into a real business.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
              Bring your vision. Atai brings the AI co-founder, tools, and technology to help you build it.
            </p>

            <div className="mt-10 text-left sm:mt-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Start with my idea
              </p>
              <h2 className="mt-2 text-xl font-medium tracking-tight sm:text-2xl">What would you like to build?</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                No technical knowledge required. Describe the business in your own words.
              </p>

              <div className="mt-5">
                <LandingComposer
                  lockedMode="idea"
                  showModes={false}
                  showIntro={false}
                  surface="new"
                  className="mx-auto max-w-3xl"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  You review the plan before anything is built.
                </span>
                <span>Credits are used when the build begins.</span>
              </div>
            </div>
          </section>

          <section aria-labelledby="other-starting-points" className="mx-auto mt-14 w-full max-w-5xl sm:mt-16">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px flex-1 bg-border" />
              <h2
                id="other-starting-points"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Or start with
              </h2>
              <span aria-hidden className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {SOURCES.map((source) => {
                const Icon = source.icon
                return (
                  <Link
                    key={source.id}
                    href={source.href}
                    onClick={() => trackStartMethodSelected(source.id as StartMethod, "new_source_card")}
                    className={cn(
                      "group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      source.tone === "violet" ? "hover:border-violet-500/40" : "hover:border-primary/35",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          source.tone === "primary" && "bg-primary/10 text-primary",
                          source.tone === "neutral" && "bg-secondary text-secondary-foreground",
                          source.tone === "violet" && "bg-violet-500/10 text-violet-600 dark:text-violet-400",
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      {source.experimental ? (
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                          Experimental
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-sm font-semibold tracking-tight">{source.title}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{source.body}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                      {source.cta}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          <section
            aria-labelledby="from-vision-to-launch"
            className="mx-auto mt-14 w-full max-w-5xl border-t border-border/80 pt-8 sm:mt-16 sm:pt-10"
          >
            <h2
              id="from-vision-to-launch"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              From vision to launch
            </h2>
            <ol className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 font-mono text-[11px] font-semibold text-primary">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </AuthGate>
  )
}
