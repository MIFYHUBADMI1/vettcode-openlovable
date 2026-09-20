"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Lightbulb, Loader2, Search } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jsonFetcher } from "@/lib/client/api"
import { relativeTime } from "@/lib/client/format"
import {
  FEATURE_REQUEST_CATEGORIES,
  FEATURE_REQUEST_STATUSES,
  STATUS_LABEL,
  categoryLabel,
} from "@/lib/feature-requests/config"
import type { PublicFeatureRequest } from "@/lib/feature-requests/types"
import { StatusBadge } from "./status-badge"
import { VoteButton } from "./vote-button"
import { RequestFormDialog } from "./request-form"

type ListResponse = { page: number; pageSize: number; total: number; items: PublicFeatureRequest[] }

const PUBLIC_STATUSES = FEATURE_REQUEST_STATUSES.filter((s) => s !== "duplicate")

export function FeatureRequestBoard() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [category, setCategory] = useState("all")
  const [sort, setSort] = useState("popular")
  const [scope, setScope] = useState<"all" | "mine" | "voted">("all")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (q.trim()) p.set("q", q.trim())
    if (status !== "all") p.set("status", status)
    if (category !== "all") p.set("category", category)
    p.set("sort", sort)
    p.set("page", String(page))
    if (scope === "mine") p.set("mine", "1")
    if (scope === "voted") p.set("voted", "1")
    return `/api/feature-requests?${p.toString()}`
  }, [q, status, category, sort, page, scope])

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(url, jsonFetcher)

  return (
    <DashboardShell title="Feature requests">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Shape Atai</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What should we build next?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tell us what would make Atai more useful for you. Vote on ideas from other founders and help shape what we
              build next.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={scope === "all" ? "secondary" : "outline"} size="sm" onClick={() => { setScope("all"); setPage(1) }}>
              All
            </Button>
            <Button variant={scope === "mine" ? "secondary" : "outline"} size="sm" onClick={() => { setScope("mine"); setPage(1) }}>
              My requests
            </Button>
            <Button variant={scope === "voted" ? "secondary" : "outline"} size="sm" onClick={() => { setScope("voted"); setPage(1) }}>
              My votes
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Lightbulb className="size-3.5" />
              Request a feature
            </Button>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Search feature requests..."
              className="pl-8"
              aria-label="Search feature requests"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              aria-label="Filter by status"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="all">All statuses</option>
              {PUBLIC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPage(1)
              }}
              aria-label="Filter by category"
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
              onChange={(e) => {
                setSort(e.target.value)
                setPage(1)
              }}
              aria-label="Sort requests"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="popular">Popular</option>
              <option value="recent">Recent</option>
              <option value="trending">Trending</option>
              <option value="updated">Updated</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Trending ranks by vote count among requests updated in the last 14 days.
        </p>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="font-medium">We couldn&apos;t load feature requests.</p>
              <Button className="mt-3" variant="outline" onClick={() => void mutate()}>
                Try again
              </Button>
            </div>
          ) : !data?.items.length ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Lightbulb className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-lg font-semibold">Be the first to shape Atai.</p>
              <p className="mt-1 text-sm text-muted-foreground">Tell us what you want Atai to do next.</p>
              <Button className="mt-4" onClick={() => setOpen(true)}>
                Request a feature
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item.id}>
                  <article className="flex gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <VoteButton
                      compact
                      id={item.id}
                      voteCount={item.voteCount}
                      hasVoted={item.hasVoted}
                      onChange={() => void mutate()}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {categoryLabel(item.category)}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <Link href={`/feature-requests/${item.id}`} className="mt-1 block text-base font-semibold hover:underline">
                        {item.title}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.isAuthor ? "Requested by you" : `Requested by ${item.author.name}`} · Updated{" "}
                        {relativeTime(item.updatedAt)}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && data.total > data.pageSize ? (
          <div className="mt-6 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Page {data.page} of {Math.ceil(data.total / data.pageSize)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <RequestFormDialog open={open} onOpenChange={setOpen} onCreated={() => void mutate()} />
      {isLoading ? <Loader2 className="sr-only" /> : null}
    </DashboardShell>
  )
}
