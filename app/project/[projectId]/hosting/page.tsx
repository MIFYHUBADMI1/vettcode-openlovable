import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { PublishMenu } from "@/components/publish-menu"
import { DeploymentHistory } from "@/components/deployment-history"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

export default async function ProjectHostingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  const { projectId } = await params
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${projectId}/hosting`)}`)
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  const live = project.deploymentHistory?.some((d) => d.status === "success")

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <Link href={`/project/${project.id}`} className="inline-flex w-fit text-sm text-muted-foreground hover:text-foreground">
          ← Workspace
        </Link>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Hosting</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {live
              ? "This application is hosted and reachable in production."
              : project.totalumProjectId
                ? "The application is built. Launch when you want it on production hosting."
                : "Hosting becomes available after the first application is built."}
          </p>
        </div>
        {project.totalumProjectId ? (
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <PublishMenu projectId={project.id} projectName={project.name} totalumProjectId={project.totalumProjectId} />
          </div>
        ) : (
          <p className="rounded-2xl border border-border/80 bg-card p-5 text-sm text-muted-foreground">
            Nothing to host yet. Finish the plan and start the first build from the workspace.
          </p>
        )}
        {project.deploymentHistory?.length ? (
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Deployments</p>
            <DeploymentHistory projectId={project.id} />
          </div>
        ) : null}
      </div>
    </main>
  )
}
