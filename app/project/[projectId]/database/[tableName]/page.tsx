import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { DatabaseProvider } from "@/components/database-provider"
import { DatabaseRecordsTable } from "@/components/database-records"

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; tableName: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    const p = await params
    redirect(`/login?next=${encodeURIComponent(`/project/${p.projectId}/database/${p.tableName}`)}`)
  }

  const { projectId, tableName } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()
  if (!project.totalumProjectId) notFound()

  return (
    <DatabaseProvider projectId={project.id}>
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/project/${project.id}/database`} className="font-mono text-xs text-primary hover:underline">
                  ← Database
                </Link>
                <Link href={`/project/${project.id}`} className="font-mono text-xs text-muted-foreground hover:text-foreground">
                  Workspace
                </Link>
                <Link href="/dashboard" className="font-mono text-xs text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <h1 className="text-2xl font-semibold tracking-tight">{tableName}</h1>
                <span className="text-sm text-muted-foreground">— {project.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                View, create, edit, and delete records in this table.
              </p>
            </div>
          </div>

          {/* Records table */}
          <DatabaseRecordsTable
            projectId={project.id}
            totalumProjectId={project.totalumProjectId}
            tableName={tableName}
          />
        </div>
      </main>
    </DatabaseProvider>
  )
}
