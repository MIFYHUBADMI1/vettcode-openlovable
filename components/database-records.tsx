"use client"

import { useState, useEffect, useCallback } from "react"
import { deleteJson } from "@/lib/client/api"
import { useDatabaseStore } from "@/lib/store/database-store"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DatabaseRecordDialog,
} from "@/components/database-record-dialog"
import type {
  DatabaseTable,
  DatabaseQueryResponse,
  DatabaseProperty,
} from "@/lib/integrations/totalum/types"
import { toast } from "sonner"

interface DatabaseRecordsTableProps {
  projectId: string
  totalumProjectId: string
  tableName: string
}

const PAGE_SIZE = 20

function formatValue(value: unknown, prop?: DatabaseProperty): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length ? `${value.length} items` : "[]"
    if (prop?.propertyType === "objectReference") {
      if (Array.isArray(value)) return `${value.length} linked`
      return "Linked"
    }
    return JSON.stringify(value).slice(0, 80)
  }
  if (typeof value === "string" && value.length > 100) return value.slice(0, 100) + "…"
  return String(value)
}

function RecordRow({
  record,
  table,
  properties,
  onEdit,
  onDelete,
}: {
  record: Record<string, unknown>
  table: DatabaseTable
  properties: DatabaseProperty[]
  onEdit: (record: Record<string, unknown>) => void
  onDelete: (record: Record<string, unknown>) => void
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      {properties.map((prop) => (
        <td
          key={prop.name}
          className="max-w-[250px] truncate px-4 py-3 text-sm text-foreground/80"
          title={formatValue(record[prop.name], prop)}
        >
          {prop.propertyType === "objectReference" ? (
            <Badge variant="outline" className="text-[10px]">
              {formatValue(record[prop.name], prop)}
            </Badge>
          ) : prop.propertyType === "options" ? (
            <Badge variant="secondary" className="text-[10px]">
              {formatValue(record[prop.name], prop)}
            </Badge>
          ) : (
            <span className="font-mono text-xs">{formatValue(record[prop.name], prop)}</span>
          )}
        </td>
      ))}
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(record)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Edit record"
          >
            <i className="fa-solid fa-pen-to-square text-xs" />
          </button>
          <button
            onClick={() => onDelete(record)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete record"
          >
            <i className="fa-solid fa-trash text-xs" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function RecordRowSkeleton({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </td>
      ))}
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
    </tr>
  )
}

export function DatabaseRecordsTable({
  projectId,
  totalumProjectId,
  tableName,
}: DatabaseRecordsTableProps) {
  // ── Shared store ───────────────────────────────────────────────────────
  // Tables structure is fetched ONCE and cached via SWR in the provider.
  // getTable derives from that cache — zero extra network requests.
  const { tables, tablesLoading, getTable, queryRecords, refreshTables } = useDatabaseStore()

  // ── Local state ────────────────────────────────────────────────────────
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterField, setFilterField] = useState("")
  const [filterValue, setFilterValue] = useState("")
  const [sortField, setSortField] = useState("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Derive table + properties from the cached store — no extra fetch.
  const table = getTable(tableName)
  const properties = table ? Object.values(table.properties ?? {}) : []
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // ── Fetch records ──────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const queryOptions: Record<string, unknown> = {
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
        _count: true,
      }

      if (filterField && filterValue) {
        queryOptions._filter = { [filterField]: { contains: filterValue } }
      }

      if (sortField) {
        queryOptions._sort = { [sortField]: sortDir }
      }

      const result = await queryRecords(tableName, queryOptions)
      setRecords(result.results ?? [])
      setTotalCount(result._count?._total ?? (result.results?.length ?? 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records")
    } finally {
      setLoading(false)
    }
  }, [tableName, page, filterField, filterValue, sortField, sortDir, queryRecords])

  useEffect(() => {
    // Only fetch records once the tables structure has loaded (so we know
    // the table exists) — avoids a wasted 404 query on unknown tables.
    if (!tablesLoading && tables) {
      fetchRecords()
    }
  }, [fetchRecords, tablesLoading, tables])

  // ── Delete handler ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteRecord?._id) return
    setDeleting(true)
    try {
      await deleteJson(
        `/api/projects/${projectId}/database/records/${deleteRecord._id}?tableName=${encodeURIComponent(tableName)}`,
      )
      toast.success("Record deleted")
      setDeleteRecord(null)
      fetchRecords()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete record")
    } finally {
      setDeleting(false)
    }
  }

  const applyFilter = () => {
    setPage(0)
    // fetchRecords will run via the useEffect when filter state updates.
  }

  const clearFilter = () => {
    setFilterField("")
    setFilterValue("")
    setPage(0)
  }

  // ── Loading: schema still loading ──────────────────────────────────────
  if (tablesLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <RecordRowSkeleton key={i} colCount={5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Table not found ────────────────────────────────────────────────────
  if (!table) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <i className="fa-solid fa-table text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">Table not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The table &quot;{tableName}&quot; doesn&apos;t exist in this project&apos;s database.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshTables}>
          Refresh tables
        </Button>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">{table.label || table.type}</h2>
          <Badge variant="outline" className="text-[10px]">
            {totalCount} record{totalCount !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <i className="fa-solid fa-plus mr-1.5 text-xs" />
          New record
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground">Field</Label>
          <select
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select field…</option>
            {properties
              .filter((p) => p.propertyType !== "objectReference" && p.propertyType !== "file")
              .map((p) => (
                <option key={p.name} value={p.name}>
                  {p.label || p.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground">Contains</Label>
          <Input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Filter value…"
            className="h-9 w-48"
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground">Sort by</Label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Default</option>
            {properties.map((p) => (
              <option key={p.name} value={p.name}>
                {p.label || p.name}
              </option>
            ))}
          </select>
        </div>
        {sortField && (
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <i className={`fa-solid ${sortDir === "asc" ? "fa-arrow-up" : "fa-arrow-down"} text-xs`} />
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </button>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={applyFilter} disabled={!filterField || !filterValue}>
            Apply
          </Button>
          {(filterField || filterValue) && (
            <Button variant="ghost" size="sm" onClick={clearFilter}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={fetchRecords} className="mt-2 text-xs text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Records table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {properties.map((prop) => (
                  <th
                    key={prop.name}
                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none"
                    onClick={() => {
                      if (sortField === prop.name) {
                        setSortDir(sortDir === "asc" ? "desc" : "asc")
                      } else {
                        setSortField(prop.name)
                        setSortDir("asc")
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {prop.label || prop.name}
                      <span className="text-[10px] opacity-50">{prop.propertyType}</span>
                      {sortField === prop.name && (
                        <i className={`fa-solid ${sortDir === "asc" ? "fa-arrow-up" : "fa-arrow-down"} text-[10px]`} />
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <RecordRowSkeleton key={i} colCount={properties.length + 1} />
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={properties.length + 1}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {filterField || filterValue
                      ? "No records match your filter. Try adjusting or clearing it."
                      : "No records yet. Create your first record to get started."}
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <RecordRow
                    key={(record._id as string) ?? JSON.stringify(record)}
                    record={record}
                    table={table}
                    properties={properties}
                    onEdit={setEditRecord}
                    onDelete={setDeleteRecord}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({totalCount} records)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              ← Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* Schema summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Table Schema</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((prop) => (
            <div key={prop.name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
              <Badge variant="outline" className="text-[10px] shrink-0">
                {prop.propertyType}
              </Badge>
              <span className="text-xs font-medium text-foreground">{prop.label || prop.name}</span>
              {prop.description && (
                <span className="text-[10px] text-muted-foreground truncate">— {prop.description}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      <DatabaseRecordDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        tableName={tableName}
        table={table}
        mode="create"
        onSuccess={() => {
          setCreateOpen(false)
          fetchRecords()
        }}
      />

      {/* Edit dialog */}
      {editRecord && (
        <DatabaseRecordDialog
          open={!!editRecord}
          onOpenChange={(open) => { if (!open) setEditRecord(null) }}
          projectId={projectId}
          tableName={tableName}
          table={table}
          mode="edit"
          record={editRecord}
          onSuccess={() => {
            setEditRecord(null)
            fetchRecords()
          }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteRecord} onOpenChange={(open) => { if (!open) setDeleteRecord(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
            ID: {String(deleteRecord?._id ?? "")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecord(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
