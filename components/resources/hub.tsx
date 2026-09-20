"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import {
  CATEGORY_META,
  LEARNING_PATHS,
  RESOURCE_CATEGORIES,
  type ResourceSummary,
} from "@/lib/resources"
import { ResourceCard } from "@/components/resources/resource-card"
import { cn } from "@/lib/utils"

export function ResourcesHub({
  resources,
  featured,
}: {
  resources: ResourceSummary[]
  featured: ResourceSummary
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return resources.filter((resource) => {
      if (category !== "all" && resource.category !== category) return false
      if (!q) return true
      return resource.searchText.includes(q)
    })
  }, [resources, query, category])

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!query.trim() || filtered.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(filtered.length - 1, index + 1))
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    }
    if (event.key === "Enter") {
      const hit = filtered[activeIndex] ?? filtered[0]
      if (hit) window.location.assign(hit.href)
    }
    if (event.key === "Escape") setQuery("")
  }

  return (
    <div className="flex flex-col gap-14">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onSearchKey}
          placeholder="Search resources"
          aria-label="Search resources"
          className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
        />
        <p className="mt-2 text-xs text-muted-foreground">Try “validate my startup idea”, “MVP”, “AI agents”, or “launch checklist”.</p>
      </div>

      {query.trim() ? (
        <section aria-live="polite">
          <h2 className="text-sm font-semibold">Results for “{query.trim()}”</h2>
          {filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-6">
              <p className="font-medium">No resources found for “{query.trim()}”.</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a broader keyword, a category, or the problem you are trying to solve.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {RESOURCE_CATEGORIES.map((id) => (
                  <Link key={id} href={`/resources/${id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                    {CATEGORY_META[id].label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {filtered.slice(0, 8).map((resource, index) => (
                <li key={resource.href}>
                  <Link
                    href={resource.href}
                    className={cn(
                      "block px-4 py-3 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      index === activeIndex && "bg-accent/60",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {CATEGORY_META[resource.category].label}
                    </p>
                    <p className="mt-1 font-medium">{resource.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{resource.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
        <Link
          href={featured.href}
          className="mt-3 block rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-6 transition-colors hover:border-indigo-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-8"
        >
          <h2 className="text-2xl font-semibold tracking-tight">{featured.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{featured.description}</p>
          <p className="mt-5 text-sm font-medium text-indigo-600 dark:text-indigo-300">Read guide →</p>
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Explore by goal</h2>
        <nav aria-label="Resource categories" className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              category === "all" ? "border-indigo-500/40 bg-indigo-500/10" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {RESOURCE_CATEGORIES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                category === id ? "border-indigo-500/40 bg-indigo-500/10" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_META[id].label}
            </button>
          ))}
        </nav>
        <p className="mt-3 text-sm text-muted-foreground">
          {RESOURCE_CATEGORIES.map((id, index) => (
            <span key={id}>
              {index > 0 ? " · " : null}
              <Link href={`/resources/${id}`} className="underline-offset-4 hover:underline">
                {CATEGORY_META[id].label}
              </Link>
            </span>
          ))}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Learning paths</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {LEARNING_PATHS.map((path) => (
            <div key={path.id} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{path.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{path.description}</p>
              <ol className="mt-4 space-y-2 text-sm">
                {path.steps.map((id, index) => {
                  const item = resources.find((resource) => `${resource.category}/${resource.slug}` === id)
                  if (!item) return null
                  return (
                    <li key={id}>
                      <Link href={item.href} className="text-foreground underline-offset-4 hover:underline">
                        {index + 1}. {item.title}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{category === "all" ? "All resources" : CATEGORY_META[category as keyof typeof CATEGORY_META]?.title ?? "Resources"}</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {category !== "all" ? (
              <>
                {" · "}
                <Link href={`/resources/${category}`} className="underline-offset-4 hover:underline">
                  Open {CATEGORY_META[category as keyof typeof CATEGORY_META]?.label} page
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(query.trim() ? filtered : category === "all" ? resources : filtered).map((resource) => (
            <ResourceCard key={resource.href} resource={resource} />
          ))}
        </div>
      </section>
    </div>
  )
}
