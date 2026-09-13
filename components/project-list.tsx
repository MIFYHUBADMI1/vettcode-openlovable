"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useProjects } from "@/lib/client/api"
import { ProjectCard } from "@/components/project-card"
import { Skeleton } from "@/components/ui/skeleton"

/** Maximum number of projects shown on the dashboard. */
const DASHBOARD_LIMIT = 4

export function ProjectList() {
  const { projects, isLoading, error, refresh } = useProjects()

  const recent = projects.slice(0, DASHBOARD_LIMIT)
  const overflow = projects.length - DASHBOARD_LIMIT

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Recent projects
        </h2>
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {projects.length}
            </span>
          )}
          {projects.length > 0 && (
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 font-mono text-xs text-primary transition-colors hover:text-primary/80"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error.message}
        </p>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: DASHBOARD_LIMIT }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-foreground">No projects yet.</p>
          <p className="max-w-sm text-pretty text-xs leading-relaxed text-muted-foreground">
            Enter a URL above to create your first mirror. Analysis is cheap; you only spend build
            credits when you explicitly launch a build.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((project) => (
              <ProjectCard key={project.id} project={project} onDeleted={refresh} />
            ))}
          </div>

          {overflow > 0 && (
            <Link
              href="/projects"
              className="group flex items-center justify-between rounded-lg border border-border bg-card/50 px-5 py-3.5 transition-colors hover:border-primary/30 hover:bg-card"
            >
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{overflow}</span> more project{overflow === 1 ? "" : "s"} in your workspace
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary transition-transform group-hover:translate-x-0.5">
                View all projects <ArrowRight className="size-3.5" />
              </span>
            </Link>
          )}
        </>
      )}
    </section>
  )
}
