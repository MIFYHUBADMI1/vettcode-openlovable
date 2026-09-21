"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { Button } from "@/components/ui/button"

type Run = {
  id: string
  projectId: string
  userId: string
  mode: string
  startedAt: number
  completedAt?: number
  status: string
  totalTokens: number
  totalDurationMs: number
  error?: string
}

export default function AdminPlanningRunsPage() {
  const [userId, setUserId] = useState("")
  const [projectId, setProjectId] = useState("")
  const [applied, setApplied] = useState({ userId: "", projectId: "" })

  const url = useMemo(() => {
    const p = new URLSearchParams({ limit: "50" })
    if (applied.userId) p.set("userId", applied.userId)
    if (applied.projectId) p.set("projectId", applied.projectId)
    return `/api/admin/planning-runs?${p}`
  }, [applied])

  const { data, error, isLoading, mutate } = useSWR<{ runs: Run[] }>(url, jsonFetcher)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Operate</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Planning runs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pipeline observability for idea and website planning.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void mutate()}>
          Refresh
        </Button>
      </header>

      <form
        className="mt-6 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied({ userId: userId.trim(), projectId: projectId.trim() })
        }}
      >
        <label className="text-xs">
          User ID
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 block h-8 w-56 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </label>
        <label className="text-xs">
          Project ID
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 block h-8 w-56 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </label>
        <Button type="submit" size="sm">
          Look up
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setUserId("")
            setProjectId("")
            setApplied({ userId: "", projectId: "" })
          }}
        >
          Recent
        </Button>
      </form>

      {error ? <p className="mt-6 text-sm text-destructive">Could not load planning runs.</p> : null}
      {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : null}

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
        {(data?.runs ?? []).map((run) => (
          <li key={run.id}>
            <Link href={`/admin/planning-runs/${run.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="font-mono text-xs text-muted-foreground">{run.id}</span>
                <span className="mt-0.5 block text-sm">
                  {run.status} · {run.mode} · project {run.projectId}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(run.startedAt).toLocaleString()} · {run.totalTokens.toLocaleString()} tokens
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!isLoading && (data?.runs?.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No runs for this filter.</p>
      ) : null}
    </div>
  )
}
