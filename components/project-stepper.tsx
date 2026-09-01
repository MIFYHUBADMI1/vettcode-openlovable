import { cn } from "@/lib/utils"
import type { ProjectState } from "@/lib/types/project"

type PhaseId = "captured" | "understanding" | "plan" | "building" | "live"

interface Phase {
  id: PhaseId
  label: string
  blurb: string
  states: ProjectState[]
  failState?: ProjectState
}

const PHASES: Phase[] = [
  {
    id: "captured",
    label: "Reference captured",
    blurb: "Your URL or idea is saved and queued.",
    states: ["created"],
  },
  {
    id: "understanding",
    label: "Understanding it",
    blurb: "Reading pages, structure, and content.",
    states: ["analyzing", "analysis_complete"],
  },
  {
    id: "plan",
    label: "Plan ready",
    blurb: "A build plan is drafted for your review.",
    states: ["specification_ready", "awaiting_build_confirmation"],
  },
  {
    id: "building",
    label: "Building",
    blurb: "Generating the real application.",
    states: ["building", "build_complete"],
    failState: "build_failed",
  },
  {
    id: "live",
    label: "Live",
    blurb: "Deployed and ready to keep shaping.",
    states: ["ready", "deploying", "deployed"],
    failState: "deployment_failed",
  },
]

const ACTIVE_STATES: ReadonlySet<ProjectState> = new Set(["analyzing", "building", "deploying"])

function phaseIndexForState(state: ProjectState): number {
  const direct = PHASES.findIndex((phase) => phase.states.includes(state))
  if (direct !== -1) return direct
  const failed = PHASES.findIndex((phase) => phase.failState === state)
  return failed !== -1 ? failed : 0
}

export function ProjectStepper({ state }: { state: ProjectState }) {
  const currentIndex = phaseIndexForState(state)
  const isFailed = PHASES[currentIndex]?.failState === state
  const isActive = ACTIVE_STATES.has(state)
  const isTerminalSuccess = state === "deployed"

  return (
    <ol className="flex flex-col gap-1">
      {PHASES.map((phase, index) => {
        const isCurrent = index === currentIndex
        const resolvedStatus =
          index < currentIndex || (isCurrent && isTerminalSuccess)
            ? "done"
            : isCurrent
              ? isFailed
                ? "failed"
                : isActive
                  ? "active"
                  : "current"
              : "upcoming"

        return (
          <li key={phase.id} className="relative flex gap-3 pb-6 last:pb-0">
            {index < PHASES.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 h-full w-px",
                  resolvedStatus === "done" ? "bg-success/50" : "bg-border",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                resolvedStatus === "done" && "border-success/40 bg-success/15 text-success",
                resolvedStatus === "active" && "border-primary/50 bg-primary/15 text-primary live-dot",
                resolvedStatus === "current" && "border-primary/50 bg-primary/15 text-primary",
                resolvedStatus === "failed" && "border-destructive/40 bg-destructive/15 text-destructive",
                resolvedStatus === "upcoming" && "border-border bg-muted text-muted-foreground",
              )}
            >
              {resolvedStatus === "done" ? "✓" : resolvedStatus === "failed" ? "!" : index + 1}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <p
                className={cn(
                  "text-sm font-medium",
                  resolvedStatus === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {phase.label}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {resolvedStatus === "failed" ? "Something went wrong here — check activity below." : phase.blurb}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
