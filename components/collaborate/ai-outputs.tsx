"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ChevronDown, FileText, Search, X } from "lucide-react"
import { CofounderMarkdown } from "@/components/cofounder/markdown"
import { cn } from "@/lib/utils"
import type { AIArtifact, AIArtifactStatus } from "@/lib/types/ai-artifacts"
import type { ApplicationSpecification } from "@/lib/types/specification"

const STATUS_STYLES: Record<AIArtifactStatus, { label: string; badge: string; dot: string }> = {
  ready: {
    label: "Parsed",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  fallback: {
    label: "Fallback used",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  unparsed: {
    label: "Unparsed raw output",
    badge: "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  failed: {
    label: "Failed",
    badge: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
}

const KIND_LABELS: Record<string, string> = {
  understanding: "Understanding",
  research: "Research",
  specification: "Plan generation",
  critique: "Critique",
  repair: "Repair",
  validation: "Validation",
  sanitization: "Sanitization",
  final_spec: "Stored plan",
  raw_failure: "Raw model output",
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value as object).length === 0
  return false
}

/** Deterministic (UTC) so server and client render the same string. */
function formatWhen(at: number): string {
  const iso = new Date(at).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

function FormattedValue({ value }: { value: unknown }) {
  if (isEmpty(value)) return <span className="text-sm text-muted-foreground">—</span>

  if (typeof value === "string") {
    return (
      <div className="text-foreground">
        <CofounderMarkdown>{value}</CofounderMarkdown>
      </div>
    )
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-sm text-foreground">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    const primitives = value.every(
      (item) => item == null || ["string", "number", "boolean"].includes(typeof item),
    )
    if (primitives) {
      return (
        <ul className="flex flex-col gap-1.5 text-sm leading-6 text-foreground">
          {value.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
              <span className="min-w-0 flex-1">{String(item)}</span>
            </li>
          ))}
        </ul>
      )
    }
    return (
      <div className="flex flex-col gap-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-lg border border-border/70 bg-background/60 p-3">
            <FormattedValue value={item} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => !isEmpty(v))
    if (entries.length === 0) return <span className="text-sm text-muted-foreground">—</span>
    return (
      <dl className="flex flex-col gap-3">
        {entries.map(([key, entry]) => (
          <div key={key}>
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {humanizeKey(key)}
            </dt>
            <dd className="mt-1">
              <FormattedValue value={entry} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return null
}

function ArtifactCard({ artifact, defaultOpen }: { artifact: AIArtifact; defaultOpen?: boolean }) {
  const hasContent = artifact.content !== undefined
  const hasRawText = Boolean(artifact.rawText)
  // When parsing failed there is nothing formatted to show — put the model's
  // exact answer on screen right away instead of hiding it behind a toggle.
  const rawOnly = !hasContent && hasRawText
  const [showRaw, setShowRaw] = useState(rawOnly)
  // Controlled open state: re-rendering the card (e.g. toggling to raw text)
  // must not reset what the reader opened.
  const [open, setOpen] = useState(Boolean(defaultOpen) || rawOnly)
  const status = STATUS_STYLES[artifact.status]
  const rawBody =
    artifact.rawText ??
    (hasContent ? JSON.stringify(artifact.content, null, 2) : "No content was captured for this stage.")

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group"
      >
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", status.dot)} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{artifact.label}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", status.badge)}>
                {status.label}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {KIND_LABELS[artifact.kind] ?? humanizeKey(artifact.kind)}
              {" · "}
              {formatWhen(artifact.at)}
              {artifact.model ? ` · ${artifact.model}` : ""}
            </span>
          </span>
          <ChevronDown
            className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="border-t border-border px-4 pb-4 pt-3">
          {artifact.note && (
            <p className="mb-3 text-xs leading-5 text-muted-foreground">{artifact.note}</p>
          )}

          {hasContent && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRaw((value) => !value)}
                className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-pressed={showRaw}
              >
                {showRaw ? "Show formatted" : hasRawText ? "Show exact model output" : "Show raw JSON"}
              </button>
            </div>
          )}

          {showRaw ? (
            <pre className="collab-scroll max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground">
              {rawBody}
            </pre>
          ) : hasContent ? (
            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <FormattedValue value={artifact.content} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No parsed content — use the toggle to read the exact model output.
            </p>
          )}
        </div>
      </details>
    </article>
  )
}

/** Filterable statuses, in display order. */
const STATUS_FILTERS: Array<{ value: AIArtifactStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Parsed" },
  { value: "fallback", label: "Fallback" },
  { value: "unparsed", label: "Unparsed" },
  { value: "failed", label: "Failed" },
]

/** Searchable text for an artifact — its label, kind, model, note, raw text
 * and (stringified) parsed content. Kept lowercase-ready at the call site. */
function artifactHaystack(artifact: AIArtifact): string {
  return [
    artifact.label,
    KIND_LABELS[artifact.kind] ?? artifact.kind,
    artifact.model ?? "",
    artifact.note ?? "",
    artifact.rawText ?? "",
    artifact.content !== undefined ? JSON.stringify(artifact.content) : "",
  ]
    .join(" ")
    .toLowerCase()
}

export function AIOutputsPanel({
  artifacts,
  spec,
  onClose,
}: {
  artifacts: AIArtifact[]
  spec?: ApplicationSpecification
  onClose?: () => void
}) {
  const [statusFilter, setStatusFilter] = useState<AIArtifactStatus | "all">("all")
  const [query, setQuery] = useState("")
  const trimmedQuery = query.trim().toLowerCase()
  const filtersActive = statusFilter !== "all" || trimmedQuery.length > 0

  const sorted = [...artifacts].sort((a, b) => a.at - b.at)
  const capturedFinal = sorted.find((a) => a.kind === "final_spec")
  // Older plans were generated before outputs were captured: still show the
  // stored plan so the workspace never implies there is nothing to verify.
  const finalArtifact: AIArtifact | null =
    capturedFinal ??
    (spec
      ? {
          id: "stored-plan",
          kind: "final_spec",
          label: "Plan stored on this project",
          status: "ready",
          content: spec,
          note: "This is the stored plan the sections and build use. This project was generated before per-stage outputs were captured, so there are no intermediate AI responses to show.",
          at: Date.now(),
        }
      : null)
  const stages = sorted.filter((a) => a.kind !== "final_spec")
  const total = stages.length + (finalArtifact ? 1 : 0)

  // Counts per status come from every captured stage regardless of the active
  // filter, so the chips stay honest switches between fixed sets.
  const statusCounts = useMemo(() => {
    const counts: Record<AIArtifactStatus | "all", number> = { all: stages.length, ready: 0, fallback: 0, unparsed: 0, failed: 0 }
    for (const artifact of stages) counts[artifact.status] += 1
    return counts
  }, [stages])

  const visibleStages = stages.filter(
    (artifact) =>
      (statusFilter === "all" || artifact.status === statusFilter) &&
      (!trimmedQuery || artifactHaystack(artifact).includes(trimmedQuery)),
  )

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="size-4.5 shrink-0 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">AI outputs</h2>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {total} captured
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Every response the AI team produced for this plan — the parsed content, and the exact model
            text behind it. If an answer could not be parsed, its raw output is kept here too.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:min-h-0"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to plan
          </button>
        )}
      </div>

      {/* Status chips + search — the count grows with every plan run, so the
          reader needs to reach the unparsed/failed answers without scrolling
          the whole history. The stored plan below is never filtered away. */}
      {stages.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((option) => {
              const active = statusFilter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {option.label}
                  <span className="ml-1 font-mono text-[10px]">{statusCounts[option.value]}</span>
                </button>
              )
            })}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search outputs — label, model, raw text…"
              aria-label="Search AI outputs"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      {finalArtifact && (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Stored plan
          </h3>
          <ArtifactCard artifact={finalArtifact} defaultOpen />
        </section>
      )}

      {stages.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            How it was produced
          </h3>
          {visibleStages.map((artifact, index) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              defaultOpen={index === visibleStages.length - 1}
            />
          ))}
          {visibleStages.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
              <p className="text-sm font-medium text-foreground">No outputs match those filters.</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                The stored plan is always shown above. Try a different status or search — or
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all")
                    setQuery("")
                  }}
                  className="ml-1 font-medium text-primary underline underline-offset-2"
                >
                  clear the filters
                </button>
                .
              </p>
            </div>
          )}
        </section>
      )}

      {total === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm font-medium text-foreground">No AI outputs recorded yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Responses are captured as the AI team works. They will appear here as soon as the first
            stage finishes.
          </p>
        </div>
      )}
    </div>
  )
}
