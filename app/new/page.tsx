"use client"

import Link from "next/link"
import { ArrowRight, Globe, Lightbulb } from "lucide-react"
import { AuthGate } from "@/components/auth/auth-gate"
import { GitHubIcon } from "@/components/github-icon"
import { CreateWorkspaceShell } from "@/components/new-project/create-shell"
import { cn } from "@/lib/utils"

const MODES = [
  {
    id: "idea",
    href: "/new/idea",
    icon: Lightbulb,
    kicker: "Your idea",
    title: "Start from an idea",
    description: "Say what you're building in your own words. Atai shapes a plan you can refine — then builds the product when you're ready.",
    cta: "Start from an idea",
    tone: "primary" as const,
  },
  {
    id: "website",
    href: "/new/website",
    icon: Globe,
    kicker: "A website",
    title: "Start from a competitor's website",
    description: "Paste a product you like, a competitor, or a site you already run. Atai studies it and drafts a plan for your business — not a copy of theirs.",
    cta: "Start from a website",
    tone: "accent" as const,
  },
  {
    id: "github",
    href: "/new/github",
    icon: GitHubIcon,
    kicker: "GitHub",
    title: "Start from a GitHub repo",
    description: "Bring a public repository, or a private one you can access. Rebuild from the README, or keep going from the code that's already there.",
    cta: "Start from GitHub",
    tone: "violet" as const,
    experimental: true,
  },
]

const FLOOR = [
  { n: "1", title: "Start", body: "Give Atai an idea, a website, or a repo." },
  { n: "2", title: "Plan", body: "Atai drafts the product. You review it before anything is built." },
  { n: "3", title: "Build", body: "When you approve, Atai builds the working application." },
]

export default function NewProjectPage() {
  return (
    <AuthGate next="/new">
      <CreateWorkspaceShell
        backHref="/dashboard"
        backLabel="Dashboard"
        kicker="New with Atai"
        title="What are you starting from?"
        description="An idea, a competitor's website, or a GitHub repo. Atai helps you understand it, plan around it, and turn it into a real product — you review the plan before anything is built."
      >
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-36">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="pb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                How Atai works
              </p>
              <ol className="flex flex-col gap-5">
                {FLOOR.map((step, index) => (
                  <li key={step.n} className="relative flex gap-3">
                    {index < FLOOR.length - 1 ? (
                      <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%+8px)] w-px bg-border" />
                    ) : null}
                    <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                      {step.n}
                    </span>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <p className="rounded-2xl border border-border/80 bg-card/90 p-5 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Atai doesn&apos;t start building until you approve the plan.</span> Credits are used when the build begins.
            </p>
          </aside>

          <section className="grid min-w-0 gap-4">
            {MODES.map((mode) => (
              <Link
                key={mode.id}
                href={mode.href}
                className={cn(
                  "group flex flex-col gap-5 rounded-2xl border border-border/80 bg-card/90 p-6 transition-colors hover:border-primary/40 hover:bg-card sm:flex-row sm:items-start sm:justify-between",
                  mode.tone === "violet" && "hover:border-violet-500/40",
                )}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl",
                      mode.tone === "primary" && "bg-primary/10 text-primary",
                      mode.tone === "accent" && "bg-accent text-accent-foreground",
                      mode.tone === "violet" && "bg-violet-500/10 text-violet-600 dark:text-violet-400",
                    )}
                  >
                    <mode.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{mode.kicker}</p>
                      {mode.experimental ? (
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                          Experimental
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight">{mode.title}</h2>
                    <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{mode.description}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 self-start text-sm font-medium text-foreground">
                  {mode.cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </section>
        </div>
      </CreateWorkspaceShell>
    </AuthGate>
  )
}
