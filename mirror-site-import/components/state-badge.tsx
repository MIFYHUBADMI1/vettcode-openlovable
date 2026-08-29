import { cn } from "@/lib/utils"
import { STATE_LABELS, type ProjectState } from "@/lib/types/project"

const STATE_META: Record<ProjectState, { className: string }> = {
  created: { className: "bg-muted text-muted-foreground" },
  analyzing: { className: "bg-accent/15 text-accent border-accent/30" },
  analysis_complete: { className: "bg-accent/15 text-accent border-accent/30" },
  specification_ready: { className: "bg-accent/15 text-accent border-accent/30" },
  awaiting_build_confirmation: { className: "bg-accent/15 text-accent border-accent/30" },
  building: { className: "bg-accent/20 text-accent border-accent/40" },
  build_complete: { className: "bg-success/15 text-success border-success/30" },
  build_failed: { className: "bg-destructive/15 text-destructive border-destructive/30" },
  ready: { className: "bg-success/15 text-success border-success/30" },
  deploying: { className: "bg-accent/20 text-accent border-accent/40" },
  deployed: { className: "bg-success/15 text-success border-success/30" },
  deployment_failed: { className: "bg-destructive/15 text-destructive border-destructive/30" },
}

const ACTIVE_STATES: ReadonlySet<ProjectState> = new Set(["analyzing", "building", "deploying"])

export function StateBadge({ state, className }: { state: ProjectState; className?: string }) {
  const meta = STATE_META[state] ?? STATE_META.created
  const label = STATE_LABELS[state] ?? state
  const isActive = ACTIVE_STATES.has(state)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider",
        meta.className,
        className,
      )}
    >
      {isActive ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
      {label}
    </span>
  )
}
