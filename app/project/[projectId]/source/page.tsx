import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { SourceViewer } from "@/components/source-viewer"
import Link from "next/link"

export default async function SourcePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}/source`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-full flex-col gap-0 px-4 py-4 lg:px-6">
        {/* Minimal header */}
        <div className="flex items-center gap-3 mb-3">
          <Link
            href={`/project/${project.id}`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ← Back to project
          </Link>
          <span className="text-muted-foreground/30">|</span>
          <span className="text-sm font-medium text-foreground">{project.name}</span>
          <span className="text-xs text-muted-foreground/40">— source code</span>
          {project.totalumProjectId && (
            <Link
              href={`/project/${project.id}/database`}
              className="font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              Database
            </Link>
          )}
        </div>

        {/* Source editor */}
        <SourceViewer projectId={project.id} projectName={project.name} />
      </div>
    </main>
  )
}
