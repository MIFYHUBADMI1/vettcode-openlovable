import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { AppHeader } from "@/components/app-header"
import { CreateProjectForm } from "@/components/create-project-form"
import { ProjectList } from "@/components/project-list"

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16">
        <section className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">MirrorSite</span>
            <h1 className="text-pretty text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              Turn any website into a live, editable application.
            </h1>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Point MirrorSite at a URL. We crawl the source, build a structured understanding, generate a full
              application specification, then hand it to the build agent — with every credit accounted for up front.
            </p>
          </div>
          <div className="max-w-2xl rounded-xl border border-border bg-card p-5">
            <CreateProjectForm />
          </div>
        </section>
        <ProjectList />
      </main>
    </div>
  )
}
