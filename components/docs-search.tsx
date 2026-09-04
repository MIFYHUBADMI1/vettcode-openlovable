"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"

interface DocsSearchProps {
  /** Section definitions with searchable keywords */
  sections: { id: string; label: string; keywords: string[] }[]
  /** Callback when filtered section IDs change */
  onFilter: (visibleIds: string[]) => void
}

export function DocsSearch({ sections, onFilter }: DocsSearchProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!query.trim()) {
      onFilter(sections.map((s) => s.id))
      return sections
    }

    const lower = query.toLowerCase()
    const matches = sections.filter(
      (s) =>
        s.label.toLowerCase().includes(lower) ||
        s.keywords.some((k) => k.toLowerCase().includes(lower)),
    )
    onFilter(matches.map((s) => s.id))
    return matches
  }, [query, sections, onFilter])

  return (
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search docs…"
        className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
      {query && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "section" : "sections"} found
        </p>
      )}
    </div>
  )
}
