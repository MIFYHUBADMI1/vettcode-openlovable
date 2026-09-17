import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { RepoCodeIcons } from "./repo-code-icons"

export default async function RepoCodePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}/repo-code`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()
  if (!project.githubZipUrl) notFound()

  const repoUrl = project.understanding?.sourceUrl || ""
  const repoName = repoUrl.split("/").slice(-2).join("/") || "repository"

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
            <RepoCodeIcons.HeaderIcon />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Original Codebase</h1>
              <p className="text-sm text-muted-foreground">{project.name}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <RepoCodeIcons.CardIcon />
            <div className="flex-1">
              <h2 className="text-lg font-medium">Repository Archive</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This is the original codebase ZIP that was used to extend your application.
                The build process downloaded this archive and continued from the existing code with your requested changes.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Source:</span>
                  <span className="font-mono text-xs">{repoName}</span>
                </div>
                {repoUrl && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Repository:</span>
                    <RepoCodeIcons.ExternalLink href={repoUrl} label={repoUrl} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
          <h3 className="mb-3 text-sm font-medium text-foreground">Download Archive</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            You can download the original codebase ZIP file used during the build process.
            This is the exact snapshot that the builder worked from.
          </p>
          <RepoCodeIcons.DownloadLink href={project.githubZipUrl} />
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <details>
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Technical Details
            </summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Archive URL:</span></p>
              <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                {project.githubZipUrl}
              </code>
              <p className="pt-2">
                This URL points to the GitHub API zipball endpoint, which provides a snapshot
                of the repository at the specified branch.
              </p>
            </div>
          </details>
        </div>
      </div>
    </main>
  )
}
