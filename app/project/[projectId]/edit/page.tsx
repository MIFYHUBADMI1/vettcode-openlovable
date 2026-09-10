import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { EditWorkspace } from "@/components/edit-workspace"
import { Badge } from "@/components/ui/badge"

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}/edit`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  const stateLabel: Record<string, { text: string; className: string }> = {
    building: { text: "Building", className: "bg-primary/10 text-primary border-primary/30" },
    deploying: { text: "Deploying", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    ready: { text: "Ready", className: "bg-green-500/10 text-green-600 border-green-500/30" },
    build_failed: { text: "Build failed", className: "bg-destructive/10 text-destructive border-destructive/30" },
  }
  const sl = stateLabel[project.state]

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8 lg:px-10">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/project/${project.id}`} className="font-mono text-xs text-primary hover:underline">
                ← Workspace
              </Link>
              <Link href="/dashboard" className="font-mono text-xs text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              {project.totalumProjectId && (
                <>
                  <Link
                    href={`/project/${project.id}/source`}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    Source code
                  </Link>
                  <Link
                    href={`/project/${project.id}/database`}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    Database
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <h1 className="text-2xl font-semibold tracking-tight">Edit: {project.name}</h1>
              {sl && (
                <Badge variant="outline" className={`text-[10px] ${sl.className}`}>
                  {sl.text}
                </Badge>
              )}
            </div>
            {project.sourceUrl && (
              <p className="mt-1 text-xs text-muted-foreground truncate max-w-md">
                Source: {project.sourceUrl}
              </p>
            )}
          </div>
        </div>

        {/* Edit workspace */}
        <EditWorkspace projectId={project.id} projectName={project.name} initialState={project.state} />
      </div>
    </main>
  )
}
