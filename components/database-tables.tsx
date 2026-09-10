"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { useDatabaseStore } from "@/lib/store/database-store"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { DatabaseTable } from "@/lib/integrations/totalum/types"

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  string: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  number: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  date: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  options: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  boolean: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  file: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  "long-string": "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  objectReference: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
}

const PROPERTY_TYPE_ICONS: Record<string, string> = {
  string: "fa-font",
  number: "fa-hashtag",
  date: "fa-calendar",
  options: "fa-list",
  boolean: "fa-toggle-on",
  file: "fa-file",
  "long-string": "fa-align-left",
  objectReference: "fa-link",
}

function TableCard({ table, projectId }: { table: DatabaseTable; projectId: string }) {
  const properties = Object.values(table.properties ?? {})
  const referenceFields = properties.filter((p) => p.propertyType === "objectReference")

  return (
    <Link
      href={`/project/${projectId}/database/${table.type}`}
      className="group relative flex flex-col gap-4 rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-6 shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm">
            <i className={`${table.icon ?? "fa-solid fa-table"} text-lg`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {table.label || table.type}
            </h3>
            <p className="font-mono text-[11px] text-muted-foreground">{table.type}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="text-[10px] font-mono">
            {properties.length} field{properties.length !== 1 ? "s" : ""}
          </Badge>
          {referenceFields.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <i className="fa-solid fa-link text-[8px] text-primary/70" />
              <span>{referenceFields.length} relation{referenceFields.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {table.description && (
        <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
          {table.description}
        </p>
      )}

      {/* Field previews - styled like database schema with prominent icons */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            Schema
          </span>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {properties.slice(0, 6).map((prop) => {
            const icon = PROPERTY_TYPE_ICONS[prop.propertyType] || "fa-circle"
            const colorClass = PROPERTY_TYPE_COLORS[prop.propertyType] || "bg-muted text-muted-foreground border-border"

            return (
              <div
                key={prop.name}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                  colorClass
                )}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/20 dark:bg-black/20">
                  <i className={`fa-solid ${icon} text-xs`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold truncate">{prop.label || prop.name}</span>
                  <span className="text-[9px] opacity-60 font-mono">{prop.propertyType}</span>
                </div>
              </div>
            )
          })}
          {properties.length > 6 && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <i className="fa-solid fa-ellipsis text-xs text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  +{properties.length - 6} more
                </span>
                <span className="text-[9px] text-muted-foreground/60">fields</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hover indicator */}
      <div className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10">
          <i className="fa-solid fa-arrow-right text-[10px] text-primary" />
        </div>
      </div>
    </Link>
  )
}

function TableCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      {/* Schema section skeleton */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/50" />
          <Skeleton className="h-3 w-12" />
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DatabaseTablesList({ projectId }: { projectId: string }) {
  // Use the shared store — tables are fetched once via SWR and shared
  // across both the overview page and the table-detail page.
  const { tables, tablesLoading, tablesError, refreshTables } = useDatabaseStore()

  if (tablesLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <TableCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (tablesError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <i className="fa-solid fa-database text-destructive" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">Could not load database</p>
          <p className="mt-1 text-sm text-muted-foreground">{tablesError}</p>
        </div>
        <button
          onClick={refreshTables}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  const tableList = tables ?? []

  if (tableList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <i className="fa-solid fa-database text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">No tables found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your project doesn&apos;t have any database tables yet. Build your app with database features to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-gradient-to-r from-card to-muted/20 px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <i className="fa-solid fa-database text-lg text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Database Tables</p>
            <p className="text-2xl font-bold text-foreground">
              {tableList.length} table{tableList.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={refreshTables}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent hover:shadow-sm"
        >
          <i className="fa-solid fa-arrows-rotate text-xs" />
          Refresh
        </button>
      </div>

      {/* Table grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tableList.map((table) => (
          <TableCard key={table._id} table={table} projectId={projectId} />
        ))}
      </div>
    </div>
  )
}
