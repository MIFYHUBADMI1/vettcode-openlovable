"use client"

import Link from "next/link"
import { useDatabaseStore } from "@/lib/store/database-store"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { DatabaseTable } from "@/lib/integrations/totalum/types"

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  string: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  number: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  date: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  options: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  file: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "long-string": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  objectReference: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
}

function TableCard({ table, projectId }: { table: DatabaseTable; projectId: string }) {
  const properties = Object.values(table.properties ?? {})
  const referenceFields = properties.filter((p) => p.propertyType === "objectReference")

  return (
    <Link
      href={`/project/${projectId}/database/${table.type}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <i className={`${table.icon ?? "fa-solid fa-table"} text-sm`} />
          </div>
          <div>
            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
              {table.label || table.type}
            </h3>
            <p className="font-mono text-xs text-muted-foreground">{table.type}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {properties.length} field{properties.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {table.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{table.description}</p>
      )}

      {/* Field previews */}
      <div className="flex flex-wrap gap-1.5">
        {properties.slice(0, 6).map((prop) => (
          <span
            key={prop.name}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${PROPERTY_TYPE_COLORS[prop.propertyType] ?? "bg-muted text-muted-foreground"}`}
          >
            {prop.label || prop.name}
            <span className="opacity-60">{prop.propertyType}</span>
          </span>
        ))}
        {properties.length > 6 && (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            +{properties.length - 6} more
          </span>
        )}
      </div>

      {/* Relations indicator */}
      {referenceFields.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <i className="fa-solid fa-link text-primary/60" />
          {referenceFields.length} relation{referenceFields.length !== 1 ? "s" : ""}
        </div>
      )}
    </Link>
  )
}

function TableCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
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
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tableList.length} table{tableList.length !== 1 ? "s" : ""} in your database
        </p>
        <button
          onClick={refreshTables}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <i className="fa-solid fa-arrows-rotate text-[10px]" />
          Refresh
        </button>
      </div>

      {/* Table grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tableList.map((table) => (
          <TableCard key={table._id} table={table} projectId={projectId} />
        ))}
      </div>
    </div>
  )
}
