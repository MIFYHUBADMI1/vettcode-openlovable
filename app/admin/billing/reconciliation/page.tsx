"use client"

import Link from "next/link"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Issue = {
  id: string
  type: string
  severity: "critical" | "warning" | "info"
  userId?: string
  referenceId?: string
  description: string
  detectedAt: number
}

type Payload = {
  summary: { totalIssues: number; critical: number; warning: number; info: number; checkedAt: number }
  issues: Issue[]
}

export default function AdminReconciliationPage() {
  const { data, error, isLoading, mutate } = useSWR<Payload>("/api/admin/billing/reconciliation", jsonFetcher)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Money</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Billing reconciliation</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Payments vs credit grants vs subscriptions vs ledger. This is a check, not a write.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void mutate()}>
          Run again
        </Button>
      </header>

      {isLoading ? <p className="mt-8 text-sm text-muted-foreground">Checking records…</p> : null}
      {error ? <p className="mt-8 text-sm text-destructive">Could not run reconciliation.</p> : null}

      {data ? (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ["Issues", data.summary.totalIssues],
              ["Critical", data.summary.critical],
              ["Warning", data.summary.warning],
              ["Info", data.summary.info],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Checked {new Date(data.summary.checkedAt).toLocaleString()}
          </p>
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {data.issues.map((issue) => (
              <li key={issue.id} className="px-4 py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px]",
                      issue.severity === "critical" && "bg-destructive/10 text-destructive",
                      issue.severity === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      issue.severity === "info" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {issue.severity}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{issue.type}</span>
                </p>
                <p className="mt-1 text-sm">{issue.description}</p>
                {issue.userId ? (
                  <Link href="/admin/users" className="mt-1 inline-block text-xs text-primary hover:underline">
                    User {issue.userId}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          {data.issues.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No mismatches in the checked sample.</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
