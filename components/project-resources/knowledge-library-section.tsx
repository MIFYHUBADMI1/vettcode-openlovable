"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { BookOpen, Search, ArrowRight, CheckCircle2 } from "lucide-react"
import { ResourceCard } from "@/components/resources/resource-card"
import type { ResourceSummary } from "@/lib/resources"
import type { ProjectState } from "@/lib/types/project"
import { deriveBusinessStage } from "@/lib/resources/business-intelligence"

interface LearningPath {
  id: string
  title: string
  description: string
  resources: ResourceSummary[]
}

interface Props {
  resources: ResourceSummary[]
  learningPaths: LearningPath[]
  state: ProjectState
}

const STAGE_LABEL: Record<string, string> = {
  planning: "planning your business",
  building: "building your application",
  live: "launching and growing",
  growing: "scaling your business",
}

export function KnowledgeLibrarySection({ resources, learningPaths, state }: Props) {
  const [query, setQuery] = useState("")
  const stage = deriveBusinessStage(state)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return resources
    return resources.filter((r) => r.searchText?.includes(q) || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
  }, [resources, query])

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Knowledge library</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Resources filtered for your stage — you're currently{" "}
          <span className="font-medium text-foreground">{STAGE_LABEL[stage] ?? "building your business"}</span>.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides, playbooks, templates…"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
        />
      </div>

      {/* Learning Paths */}
      {!query && learningPaths.length > 0 && (
        <section>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Learning paths for your stage</p>
          <div className="space-y-4">
            {learningPaths.map((path) => (
              <div key={path.id} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">{path.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{path.description}</p>
                <div className="mt-4 space-y-2">
                  {path.resources.slice(0, 4).map((r, i) => (
                    <Link
                      key={r.slug}
                      href={r.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-foreground">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.readingMinutes} min</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                  {path.resources.length > 4 && (
                    <p className="px-3 text-xs text-muted-foreground">+{path.resources.length - 4} more steps</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Resource grid */}
      <section>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {query ? `Results for "${query}"` : "Recommended for your stage"}
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-sm font-medium text-foreground">No results for "{query}"</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a broader search term</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((resource) => (
              <ResourceCard key={resource.slug} resource={resource} />
            ))}
          </div>
        )}
      </section>

      {/* Link to full library */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-foreground">See the full resource library</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Guides, playbooks, templates, and glossary for every stage.</p>
        </div>
        <Link
          href="/resources"
          className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Browse all <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
