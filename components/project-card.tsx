import Link from "next/link"
import type { ProjectSummary } from "@/lib/types/project"
import { StateBadge } from "@/components/state-badge"

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function relativeTime(value: string | number): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const title = project.sourceUrl ? hostOf(String(project.sourceUrl)) : project.name
  const subtitle = project.sourceUrl ?? "Built from scratch"
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-mono text-sm font-medium text-foreground">{title}</span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <StateBadge state={project.state} />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-xs text-muted-foreground">{relativeTime(project.updatedAt)}</span>
        <span className="font-mono text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Open &rarr;
        </span>
      </div>
    </Link>
  )
}
