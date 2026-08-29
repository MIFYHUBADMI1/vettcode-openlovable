import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { CreateProjectForm } from "@/components/create-project-form"
import { CreateIdeaForm } from "@/components/create-idea-form"
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
          <div className="border border-border bg-card p-5"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Start here</p><h2 className="mt-4 text-xl font-medium">Create a project</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Bring a website reference and we’ll analyze its structure before you commit to a build.</p><div className="mt-6"><CreateProjectForm /></div></div>
          <div className="border border-border bg-card p-5"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Start from an idea</p><h2 className="mt-4 text-xl font-medium">Describe what you need</h2><div className="mt-5"><CreateIdeaForm /></div></div>
          <OnboardingChecklist />
        </div>
        <ProjectList />
      </section>
    </main>
  )
}
