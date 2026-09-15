import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Globe, Lightbulb, Users, FolderOpen, Compass } from "lucide-react"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}
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
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            <FolderOpen className="size-4" />
            All projects
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
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
          <Link
            href="/new/github"
            className="group relative flex flex-col justify-between border border-purple-500/30 bg-card p-5 transition-colors hover:border-purple-500/60 hover:bg-purple-500/5"
          >
            {/* Experimental badge */}
            <div className="absolute right-3 top-3 rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
              New
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-widest text-purple-600 dark:text-purple-400">GitHub mode</p>
                <GitHubIcon className="size-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="mt-4 text-xl font-medium">Build from a repo</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Paste any GitHub repo URL. We read the code, understand it, and build a working app from it.
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-purple-600 dark:text-purple-400">
              Start from repo
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
        <OnboardingChecklist />
        <ProjectList />

        {/* Explore public projects */}
        <div className="flex flex-col gap-5 border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Compass className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Explore public projects</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Browse apps built by the community — like, follow creators, or fork a project into your workspace
                </p>
              </div>
            </div>
            <Link
              href="/explore"
              className="group hidden shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground sm:inline-flex"
            >
              Browse library
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Discover</span>
              <p className="text-sm text-foreground">Browse apps built by creators using MirrorSite AI</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Fork</span>
              <p className="text-sm text-foreground">Clone any public project straight into your workspace</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Connect</span>
              <p className="text-sm text-foreground">Like projects and follow creators you find interesting</p>
            </div>
          </div>
          <Link
            href="/explore"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:hidden"
          >
            Browse public library
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

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
