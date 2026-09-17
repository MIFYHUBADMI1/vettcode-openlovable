import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { CollaborateClient } from "./collaborate-client"

/**
 * /project/[projectId]/collaborate
 *
 * Server component that enforces access control (AC 11):
 * - Private projects: owner only
 * - Public projects: any visitor can view (but chat requires auth)
 */
export default async function CollaboratePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const user = await getCurrentUser()

  const project = await store.getProject(projectId)
  if (!project) notFound()

  // AC 11: Private projects are restricted to the owning user
  const isOwner = user?.id === project.userId
  if (project.visibility !== "public" && !isOwner) {
    redirect(`/login?next=/project/${projectId}/collaborate`)
  }

  // App-shell layout: fixed viewport height — every panel scrolls internally,
  // so the plan nav, composer, and launch button are always reachable without
  // scrolling the page.
  return (
    <main className="h-svh overflow-hidden bg-background text-foreground flex flex-col">
      <AppHeader />

      {/* Page header */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/project/${projectId}`}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
            >
              ← Workspace
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{project.name}</h1>
              <p className="font-mono text-xs text-primary">AI Co-Founder · Strengthen your plan together</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-xs text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              {project.state === "plan_ready" ? "Plan ready" : project.state.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {/* 60 / 40 split — plan left, chat right */}
      <CollaborateClient
        projectId={projectId}
        initialProject={project}
        isOwner={isOwner}
      />
    </main>
  )
}
