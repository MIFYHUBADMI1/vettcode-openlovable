import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { TreeIcon } from "./tree-icon"

export default async function TreePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}/tree`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()
  if (!project.githubFileTree) notFound()

  const lines = project.githubFileTree.split("\n")
  const folderCount = lines.filter((l) => l.includes("/")).length
  const fileCount = lines.length - folderCount

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-4 border-b border-border pb-6">
          <Link
            href={`/project/${project.id}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            ← Back to workspace
          </Link>
          <div className="flex items-center gap-3">
            <TreeIcon />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Application Structure</h1>
              <p className="text-sm text-muted-foreground">{project.name}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Files</p>
            <p className="mt-1 text-2xl font-semibold">{fileCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Folders</p>
            <p className="mt-1 text-2xl font-semibold">{folderCount}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <p className="font-mono text-xs text-muted-foreground">Repository file structure</p>
          </div>
          <div className="p-6">
            <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-foreground">
              {project.githubFileTree}
            </pre>
          </div>
        </div>

        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <p className="text-xs text-muted-foreground">
            This file tree was generated from the GitHub repository structure during project creation. It shows all files and folders that were analyzed.
          </p>
        </div>
      </div>
    </main>
  )
}
