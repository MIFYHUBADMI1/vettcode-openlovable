import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/billing/credit-service"
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

  const isOwner = user?.id === project.userId
  if (project.visibility !== "public" && !isOwner) {
    redirect(`/login?next=/project/${projectId}/collaborate`)
  }

  const userCredits = user ? (await getBalance(user.id)).total : 0

  return (
    <main className="collab-shell collab-safe-b flex min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <AppHeader />

      <div className="border-b border-border bg-card/50">
        {/* Phones get two rows: identity on top, actions across the full width
          below — the auto-complete CTA would otherwise crush the project name. */}
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              href={`/project/${projectId}`}
              aria-label="Back to workspace"
              className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground sm:w-auto sm:px-3"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <div className="min-w-0 flex-1 sm:flex-none">
              <h1 className="truncate text-sm font-semibold text-foreground">{project.name}</h1>
              <p className="hidden truncate font-mono text-xs text-primary sm:block">AI Co-Founder · Strengthen your plan together</p>
            </div>
            {/* The status chip has no room in the actions row on phones, so it
              rides next to the project name instead. The client portals the live
              chip (state + plan quality) into these slots. */}
            <div id="collab-header-status-xs" className="flex shrink-0 items-center sm:hidden" />
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <div id="collab-header-status-sm" className="hidden min-w-0 shrink-0 items-center sm:flex" />
            <div id="collab-header-actions" className="flex min-w-0 flex-1 items-center sm:flex-none" />
            <div id="collab-header-launch" className="flex min-w-0 shrink-0 items-center" />
          </div>
        </div>
      </div>

      <CollaborateClient
        projectId={projectId}
        initialProject={project}
        isOwner={isOwner}
        initialCredits={userCredits}
      />
    </main>
  )
}
