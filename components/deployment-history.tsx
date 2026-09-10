"use client"

import useSWR from "swr"
import { Clock, Check, X, ExternalLink, Globe, Loader2 } from "lucide-react"
import { ensureProtocol } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { DeploymentHistoryEntry } from "@/lib/types/project"

const jsonFetcher = (url: string) =>
  fetch(url, { headers: { accept: "application/json" } }).then((r) => r.json())

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
  const { data } = useSWR<{ ok: boolean; data: { deploymentHistory?: DeploymentHistoryEntry[] } }>(
    `/api/projects/${projectId}`,
    jsonFetcher,
    { refreshInterval: 15000 },
  )

  const history = data?.data?.deploymentHistory ?? []

  // Sort newest first
  const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt)

  if (sorted.length === 0) return null

  return (
    <div className="space-y-3">
      {sorted.map((entry) => {
        const isDeploying = entry.status === "deploying"
        const isSuccess = entry.status === "success"
        const isFailed = entry.status === "failed"

        return (
          <div
            key={entry.id}
            className={`rounded-lg border p-3 ${
              isFailed
                ? "border-destructive/20 bg-destructive/5"
                : isDeploying
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {isDeploying ? (
                  <Loader2 className="size-4 text-primary animate-spin" />
                ) : isSuccess ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <X className="size-4 text-destructive" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {isDeploying ? "Deploying..." : isSuccess ? "Published" : "Failed"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        isFailed
                          ? "text-destructive border-destructive/30"
                          : isDeploying
                          ? "text-primary border-primary/30"
                          : "text-green-600 border-green-500/30"
                      }`}
                    >
                      {entry.status}
                    </Badge>
                    {entry.creditsCharged && (
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.creditsCharged} credits
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{formatTime(entry.startedAt)}</span>
                    {entry.completedAt && (
                      <>
                        <span>·</span>
                        <span>{formatDuration(entry.startedAt, entry.completedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {entry.productionUrl && (
                  <a
                    href={ensureProtocol(entry.productionUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700"
                  >
                    <Globe className="size-3" />
                    Live
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
                {entry.customDomain && (
                  <a
                    href={ensureProtocol(entry.customDomain)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20"
                  >
                    <Globe className="size-3" />
                    {entry.customDomain}
                  </a>
                )}
              </div>
            </div>
            {entry.error && (
              <p className="mt-2 text-xs text-destructive">{entry.error}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
