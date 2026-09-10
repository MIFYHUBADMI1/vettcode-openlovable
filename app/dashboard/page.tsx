import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Globe, Lightbulb, Users } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { ProjectList } from "@/components/project-list"
import { OnboardingTour } from "@/components/onboarding-tour"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import { getCurrentUser } from "@/lib/auth/session"

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fdashboard")

  const firstName = user.name.trim().split(/\s+/)[0] || "builder"

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <OnboardingTour />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10 lg:py-14">
        <div className="flex flex-col gap-6 border-b border-border pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Dashboard / control center</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Good to see you, {firstName}.</h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">Your projects, analysis runs, build states, and next actions—kept in one place.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/new/website"
            className="group flex flex-col justify-between border border-border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-widest text-primary">Website mode</p>
                <Globe className="size-4 text-primary" />
              </div>
              <h2 className="mt-4 text-xl font-medium">Mirror an existing site</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Bring a website reference and we&apos;ll analyze its structure before you commit to a build.
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
              Start mirroring
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/new/idea"
            className="group flex flex-col justify-between border border-border bg-card p-5 transition-colors hover:border-accent-foreground/50"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-widest text-accent-foreground">Idea mode</p>
                <Lightbulb className="size-4 text-accent-foreground" />
              </div>
              <h2 className="mt-4 text-xl font-medium">Start from an idea</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No reference site. Describe what you need and we&apos;ll turn it into a plan.
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-accent-foreground">
              Describe your app
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <OnboardingChecklist />
        </div>
        <ProjectList />

        {/* Referral Card */}
        <Link
          href="/referrals"
          className="group flex items-center justify-between border border-border bg-card p-5 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Refer & Earn</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Earn up to <span className="font-medium text-foreground">2,000 credits</span> for every successful referral.
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      </section>
    </main>
  )
}
