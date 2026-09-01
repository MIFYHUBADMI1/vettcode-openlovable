import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { DatabaseProvider } from "@/components/database-provider"
import { DatabaseTablesList } from "@/components/database-tables"
import { InfrastructureManager } from "@/components/infrastructure-manager"

export default async function DatabasePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}/database`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  return (
    <DatabaseProvider projectId={project.id}>
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
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
                      href={`/project/${project.id}/edit`}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit application
                    </Link>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <h1 className="text-2xl font-semibold tracking-tight">Database</h1>
                <span className="text-sm text-muted-foreground">— {project.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Browse and manage your project&apos;s database, records, relations, and infrastructure plan.
              </p>
            </div>
          </div>

          {/* Infrastructure & Database */}
          <div className="space-y-8">
            <InfrastructureManager projectId={project.id} />

            <div>
              <h2 className="text-lg font-semibold mb-4">Database Tables</h2>
              <DatabaseTablesList projectId={project.id} />
            </div>
          </div>
        </div>
      </main>
    </DatabaseProvider>
  )
}
