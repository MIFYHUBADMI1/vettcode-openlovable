"use client"

import { useProjects } from "@/lib/client/api"
import { ProjectCard } from "@/components/project-card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProjectList() {
  const { projects, isLoading, error, refresh } = useProjects()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Your mirrors</h2>
        {projects.length > 0 ? (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{projects.length}</span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error.message}
        </p>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-foreground">No mirrors yet.</p>
          <p className="max-w-sm text-pretty text-xs leading-relaxed text-muted-foreground">
            Enter a URL above to create your first mirror. Analysis is cheap; you only spend build credits when you
            explicitly launch a build.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onDeleted={() => refresh()} />
          ))}
        </div>
      )}
    </section>
  )
}
