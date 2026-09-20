"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Lightbulb, Loader2 } from "lucide-react"
import { AdminNav } from "@/components/admin-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jsonFetcher } from "@/lib/client/api"
import { relativeTime } from "@/lib/client/format"
import { FEATURE_REQUEST_CATEGORIES, categoryLabel } from "@/lib/feature-requests/config"
import type { PublicFeatureRequest } from "@/lib/feature-requests/types"
import { StatusBadge } from "@/components/feature-requests/status-badge"

type Stats = {
  total: number
  newThisWeek: number
  underReview: number
  planned: number
  inProgress: number
  shipped: number
  totalVotes: number
}

type List = { page: number; pageSize: number; total: number; items: (PublicFeatureRequest & { hidden?: boolean })[] }

export default function AdminFeatureRequestsPage() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("needs_review")
  const [category, setCategory] = useState("all")
  const [sort, setSort] = useState("popular")
  const [page, setPage] = useState(1)
  const { data: stats } = useSWR<Stats>("/api/admin/feature-requests?stats=1", jsonFetcher)
  const url = useMemo(() => {
    const p = new URLSearchParams({ status, category, sort, page: String(page) })
    if (q.trim()) p.set("q", q.trim())
    return `/api/admin/feature-requests?${p}`
  }, [q, status, category, sort, page])
  const { data, error, isLoading, mutate } = useSWR<List>(url, jsonFetcher)

  return (
    <div className="min-h-svh bg-background">
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold">Feature Requests</h1>
            <p className="mt-1 text-sm text-muted-foreground">Demand signals, not a ticket queue.</p>
          </div>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {[
            ["Total", stats?.total],
            ["New this week", stats?.newThisWeek],
            ["Needs review", stats?.underReview],
            ["Planned", stats?.planned],
            ["In progress", stats?.inProgress],
            ["Shipped", stats?.shipped],
            ["Votes", stats?.totalVotes],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold">{value ?? "—"}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["needs_review", "Needs review"],
            ["all", "All"],
            ["planned", "Planned"],
            ["in_progress", "In progress"],
            ["shipped", "Shipped"],
            ["declined", "Declined"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={status === id ? "secondary" : "outline"}
              onClick={() => {
                setStatus(id)
                setPage(1)
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search title, description, or ID"
            className="max-w-sm"
          />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="all">All categories</option>
            {FEATURE_REQUEST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="popular">Votes</option>
            <option value="recent">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>

        {isLoading ? (
          <div className="mt-6 flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-border p-6 text-center">
            Couldn&apos;t load requests.{" "}
            <button className="text-primary underline" onClick={() => void mutate()}>
              Try again
            </button>
          </div>
        ) : !data?.items.length ? (
          <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
            <Lightbulb className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">No feature requests yet.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Request</th>
                  <th className="px-3 py-2 font-medium">Votes</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Author</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-3">
                      <Link href={`/admin/feature-requests/${item.id}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel(item.category)}
                        {item.hidden ? " · hidden" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">{item.voteCount}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3">{item.author.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{relativeTime(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.pageSize ? (
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
