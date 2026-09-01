"use client"

import useSWR from "swr"
import { cn } from "@/lib/utils"
import type { ProjectState } from "@/lib/types/project"

const jsonFetcher = (url: string) =>
  fetch(url, { headers: { accept: "application/json" } }).then((r) => r.json())

const LABELS: Record<ProjectState, string> = {
  created: "Created",
  analyzing: "Analyzing",
  analysis_complete: "Analysis done",
  specification_ready: "Plan ready",
  awaiting_build_confirmation: "Awaiting confirmation",
  building: "Building",
  build_complete: "Build complete",
  build_failed: "Build failed",
  ready: "Ready",
  deploying: "Deploying",
  deployed: "Deployed",
  deployment_failed: "Deploy failed",
}

const COLORS: Record<ProjectState, string> = {
  created: "border-muted bg-muted/50 text-muted-foreground",
  analyzing: "border-primary/40 bg-primary/10 text-primary",
  analysis_complete: "border-primary/40 bg-primary/10 text-primary",
  specification_ready: "border-primary/40 bg-primary/10 text-primary",
  awaiting_build_confirmation: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  building: "border-primary/50 bg-primary/10 text-primary animate-pulse",
  build_complete: "border-success/40 bg-success/10 text-success",
  build_failed: "border-destructive/40 bg-destructive/10 text-destructive",
  ready: "border-success/40 bg-success/10 text-success",
  deploying: "border-primary/50 bg-primary/10 text-primary animate-pulse",
  deployed: "border-success/40 bg-success/10 text-success",
  deployment_failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

interface StateBadgeProps {
  projectId: string
  initialState: ProjectState
  className?: string
}

export function StateBadge({ projectId, initialState, className }: StateBadgeProps) {
  const { data } = useSWR<{ ok: boolean; data: { project: { state: ProjectState } } }>(
    `/api/projects/${projectId}`,
    jsonFetcher,
    {
      refreshInterval: (latest) => {
        const state = latest?.data?.project?.state ?? initialState
        if (state === "building" || state === "analyzing" || state === "deploying") return 3000
        return 15000
      },
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  )

  const state = data?.data?.project?.state ?? initialState

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        COLORS[state] ?? COLORS.created,
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "building" || state === "deploying" ? "bg-primary animate-pulse" : "bg-current",
        )}
      />
      {LABELS[state] ?? state}
    </span>
  )
}
