"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, PartyPopper } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { jsonFetcher } from "@/lib/client/api"
import { relativeTime } from "@/lib/client/format"
import { categoryLabel } from "@/lib/feature-requests/config"
import type { PublicFeatureRequest } from "@/lib/feature-requests/types"
import { StatusBadge } from "@/components/feature-requests/status-badge"
import { VoteButton } from "@/components/feature-requests/vote-button"

export default function FeatureRequestDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, error, isLoading, mutate } = useSWR<PublicFeatureRequest>(
    params.id ? `/api/feature-requests/${params.id}` : null,
    jsonFetcher,
  )

  return (
    <DashboardShell title="Feature request">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-6">
        <Link href="/feature-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Feature Requests
        </Link>
        {isLoading ? <div className="mt-6 h-64 animate-pulse rounded-2xl border border-border bg-card" /> : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-medium">We couldn&apos;t find that request.</p>
            <Link href="/feature-requests" className="mt-3 inline-flex text-sm text-primary hover:underline">
              Back to the board
            </Link>
          </div>
        ) : null}
        {data ? (
          <article className="mt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {categoryLabel(data.category)}
                  </span>
                  <StatusBadge status={data.status} />
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{data.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.isAuthor ? "Requested by you" : `Requested by ${data.author.name}`} · {relativeTime(data.createdAt)}
                </p>
              </div>
              <VoteButton
                id={data.id}
                voteCount={data.voteCount}
                hasVoted={data.hasVoted}
                onChange={(next) => void mutate({ ...data, ...next }, { revalidate: false })}
              />
            </div>

            {data.status === "shipped" ? (
              <section className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <PartyPopper className="size-4" /> Shipped
                </p>
                <p className="mt-2 text-sm leading-6">
                  {data.releaseNote || "This is now available in Atai."}
                </p>
                {data.releaseLink ? (
                  <a href={data.releaseLink} className="mt-3 inline-flex text-sm text-primary hover:underline">
                    Try it
                  </a>
                ) : null}
              </section>
            ) : null}

            {data.status === "duplicate" && data.canonicalRequestId ? (
              <section className="mt-6 rounded-2xl border border-border bg-muted/40 p-5 text-sm">
                This request is already represented here.{" "}
                <Link href={`/feature-requests/${data.canonicalRequestId}`} className="text-primary hover:underline">
                  View canonical request
                </Link>
              </section>
            ) : null}

            <section className="mt-8">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">The request</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{data.description}</p>
            </section>
            {data.whyItMatters ? (
              <section className="mt-8">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Why this matters</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{data.whyItMatters}</p>
              </section>
            ) : null}
            {data.updates && data.updates.length > 0 ? (
              <section className="mt-8">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Atai update</h3>
                <ul className="mt-3 space-y-3">
                  {data.updates.map((u) => (
                    <li key={u.id} className="rounded-xl border border-border bg-card p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6">{u.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{relativeTime(u.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        ) : null}
      </div>
    </DashboardShell>
  )
}
