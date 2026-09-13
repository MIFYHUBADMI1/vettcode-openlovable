import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { EnvManager } from "@/components/env-manager"
import Link from "next/link"
import { ArrowLeft, KeyRound } from "lucide-react"

export default async function ProjectEnvPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  const { projectId } = await params
  if (!user) redirect(`/login?next=/project/${projectId}/env`)

  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  if (!project.totalumProjectId) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Link href={`/project/${projectId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to workspace
          </Link>
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <KeyRound className="size-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-semibold">Project not built yet</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Environment variables can only be added after the project has been built. Build it first, then come back here.
            </p>
            <Link href={`/project/${projectId}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Go to workspace
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Surface required keys from the build summary
  const requiredKeys = project.buildSummary?.secretKeysNeeded ?? {}

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-8">
          <Link href={`/project/${projectId}`} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to workspace
          </Link>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <KeyRound className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Environment Variables</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env</code> secrets for <span className="font-medium text-foreground">{project.name}</span>. Values are encrypted and injected at runtime — they are never returned after saving.
              </p>
            </div>
          </div>
        </div>

        <EnvManager projectId={projectId} initialRequiredKeys={requiredKeys} />
      </div>
    </main>
  )
}
