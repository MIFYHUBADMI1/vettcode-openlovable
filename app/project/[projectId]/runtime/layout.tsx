import type { ReactNode } from "react"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { RuntimeNav } from "@/components/runtime-control/nav"

export default async function RuntimeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ projectId: string }>
}) {
  const user = await getCurrentUser()
  const { projectId } = await params
  if (!user) redirect(`/login?next=/project/${projectId}/runtime`)

  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-4 border-b border-border pb-6">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            ← Back to workspace
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Runtime</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Observe and control the Atai Runtime for <span className="font-medium text-foreground">{project.name}</span>.
              Provider credentials stay on Atai servers.
            </p>
          </div>
          <RuntimeNav projectId={projectId} />
        </div>
        {children}
      </div>
    </main>
  )
}
