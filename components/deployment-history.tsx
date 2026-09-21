"use client"

import { Clock, Check, X, ExternalLink, Globe, Loader2 } from "lucide-react"
import { ensureProtocol } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useProject } from "@/lib/client/api"

interface DeploymentHistoryProps {
  projectId: string
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(startMs: number, endMs?: number) {
  if (!endMs) return null
  const seconds = Math.round((endMs - startMs) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`
}

export function DeploymentHistory({ projectId }: DeploymentHistoryProps) {
  const { project } = useProject(projectId)
  const history = project?.deploymentHistory ?? []
  const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt)

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No production publishes yet.</p>
  }

  return (
    <div className="grid gap-2">
      {sorted.map((entry) => {
        const isDeploying = entry.status === "deploying"
        const isSuccess = entry.status === "success"
        const isFailed = entry.status === "failed"

        return (
          <div
            key={entry.id}
            className={`min-w-0 rounded-xl border p-3 sm:p-4 ${
              isFailed
                ? "border-destructive/20 bg-destructive/5"
                : isDeploying
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-background"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                {isDeploying ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                ) : isSuccess ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">
                      {isDeploying ? "Publishing…" : isSuccess ? "Published" : "Failed"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        isFailed
                          ? "border-destructive/30 text-destructive"
                          : isDeploying
                            ? "border-primary/30 text-primary"
                            : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {entry.status}
                    </Badge>
                    {entry.creditsCharged ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.creditsCharged} credits
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3 shrink-0" />
                      {formatTime(entry.startedAt)}
                    </span>
                    {entry.completedAt ? <span>{formatDuration(entry.startedAt, entry.completedAt)}</span> : null}
                  </div>
                </div>
              </div>

              {(entry.productionUrl || entry.customDomain) ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                  {entry.productionUrl ? (
                    <a
                      href={ensureProtocol(entry.productionUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Globe className="size-3 shrink-0" />
                      <span className="truncate">Live</span>
                      <ExternalLink className="size-2.5 shrink-0" />
                    </a>
                  ) : null}
                  {entry.customDomain ? (
                    <a
                      href={ensureProtocol(entry.customDomain)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <Globe className="size-3 shrink-0" />
                      <span className="truncate">{entry.customDomain}</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
            {entry.error ? <p className="mt-2 break-words text-xs text-destructive">{entry.error}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
