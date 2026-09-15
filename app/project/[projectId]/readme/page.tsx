import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { BookOpen } from "lucide-react"

export default async function ReadmePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}/readme`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  if (!project.githubReadme) {
    notFound()
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 lg:px-10">
        
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6">
          <Link
            href={`/project/${project.id}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            ← Back to workspace
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
              <BookOpen className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">README</h1>
              <p className="text-sm text-muted-foreground">{project.name}</p>
            </div>
          </div>
        </div>

        {/* README content */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <p className="font-mono text-xs text-muted-foreground">
              From GitHub repository
            </p>
          </div>
          <div className="p-6">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-sm leading-relaxed text-foreground">
{project.githubReadme}
              </pre>
            </article>
          </div>
        </div>

        {/* Footer note */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <p className="text-xs text-muted-foreground">
            This README was fetched from the GitHub repository during project creation. It represents the original documentation from the source code.
          </p>
        </div>
      </div>
    </main>
  )
}
