"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"

export default function AdminPlanningRunDetailPage() {
  const params = useParams<{ runId: string }>()
  const { data, error, isLoading } = useSWR<{ run: Record<string, unknown> }>(
    params.runId ? `/api/admin/planning-runs/${params.runId}` : null,
    jsonFetcher,
  )

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/admin/planning-runs" className="text-sm text-muted-foreground hover:text-foreground">
        ← Planning runs
      </Link>
      <h2 className="mt-3 font-mono text-lg">{params.runId}</h2>
      {isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">Run not found.</p> : null}
      {data?.run ? (
        <pre className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card p-4 text-xs leading-5">
          {JSON.stringify(data.run, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
