"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, FolderOpen, Compass, TrendingUp } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { ProjectList } from "@/components/project-list"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { FirstMission } from "@/components/onboarding/first-mission"
import { ActivationEmpty } from "@/components/onboarding/activation-empty"
import { StartStrip } from "@/components/onboarding/start-strip"
import { useProjects, useSession } from "@/lib/client/api"

export default function DashboardPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const { projects, isLoading: projectsLoading } = useProjects()

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login?next=%2Fdashboard")
    }
  }, [session, isLoading, router])

  if (isLoading || !session) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
      </main>
    )
  }

  const firstName = session.user.name?.trim().split(/\s+/)[0] || "there"
  const hasProjects = projects.length > 0
  const showEmpty = !projectsLoading && !hasProjects && Boolean(session.user.onboarding?.dismissedAt) && !session.user.onboarding?.completedAt

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <FirstMission />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-6 border-b border-border pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Dashboard</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Good to see you, {firstName}.</h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              You bring the vision. Atai helps you shape the plan, build the product, and go live.
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

        {showEmpty ? <ActivationEmpty /> : null}
        {hasProjects ? <StartStrip /> : null}

        {hasProjects ? <OnboardingChecklist /> : null}
        {hasProjects || projectsLoading ? <ProjectList /> : null}

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
              </div>
            </div>
            <Link
              href="/explore"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Browse the library
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <Link
          href="/referrals"
          className="group flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 transition-all hover:border-emerald-500/40 sm:flex-row sm:items-center sm:justify-between"
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
                successful referral.
              </p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Get your referral link
            <ArrowRight className="size-4" />
          </span>
        </Link>
      </section>
    </main>
  )
}
