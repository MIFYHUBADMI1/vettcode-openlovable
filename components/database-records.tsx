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
import { cn } from "@/lib/utils"

interface DatabaseRecordsTableProps {
  projectId: string
  totalumProjectId: string
  tableName: string
}

const PAGE_SIZE = 50

// Column type colors and icons
const PROPERTY_TYPE_COLORS: Record<string, string> = {
  string: "text-blue-600 dark:text-blue-400",
  number: "text-emerald-600 dark:text-emerald-400",
  date: "text-amber-600 dark:text-amber-400",
  options: "text-purple-600 dark:text-purple-400",
  boolean: "text-indigo-600 dark:text-indigo-400",
  file: "text-rose-600 dark:text-rose-400",
  "long-string": "text-sky-600 dark:text-sky-400",
  objectReference: "text-orange-600 dark:text-orange-400",
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

// Cell renderers by type
function BooleanCell({ value }: { value: unknown }) {
  const isTrue = Boolean(value)
  return (
    <div className="flex items-center gap-1.5">
      <i
        className={cn(
          "fa-solid text-sm",
          isTrue ? "fa-circle-check text-success" : "fa-circle-xmark text-muted-foreground"
        )}
      />
      <span className="text-xs text-muted-foreground">{isTrue ? "Yes" : "No"}</span>
    </div>
  )
}

function DateCell({ value }: { value: unknown }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const date = new Date(value as string)
  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  return (
    <div className="flex items-center gap-1.5">
      <i className="fa-solid fa-calendar-day text-[10px] text-muted-foreground" />
      <span className="font-mono text-xs">{formatted}</span>
    </div>
  )
}

function NumberCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  return <span className="font-mono text-xs tabular-nums">{String(value)}</span>
}

function ReferenceCell({ value }: { value: unknown }) {
  if (!value) return <span className="text-muted-foreground">—</span>

  const count = Array.isArray(value) ? value.length : 1
  return (
    <Badge variant="outline" className="text-[10px] font-mono">
      <i className="fa-solid fa-link mr-1 text-[8px]" />
      {count} linked
    </Badge>
  )
}

function OptionsCell({ value }: { value: unknown }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <Badge className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
      {String(value)}
    </Badge>
  )
}

function FileCell({ value }: { value: unknown }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-1.5">
      <i className="fa-solid fa-file text-[10px] text-muted-foreground" />
      <span className="font-mono text-xs truncate max-w-[150px]">{String(value)}</span>
    </div>
  )
}

function TextCell({ value, maxLength = 80 }: { value: unknown; maxLength?: number }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>

  const text = String(value)
  const truncated = text.length > maxLength ? text.slice(0, maxLength) + "…" : text

  return (
    <span className="font-mono text-xs" title={text}>
      {truncated}
    </span>
  )
}

// Smart cell renderer based on property type
function SmartCell({ value, property }: { value: unknown; property: DatabaseProperty }) {
  switch (property.propertyType) {
    case "date":
      return <DateCell value={value} />
    case "number":
      return <NumberCell value={value} />
    case "objectReference":
      return <ReferenceCell value={value} />
    case "options":
      return <OptionsCell value={value} />
    case "file":
      return <FileCell value={value} />
    case "long-string":
      return <TextCell value={value} maxLength={150} />
    default:
      // "string" and any unknown types (incl. "boolean" from older schemas)
      // Try to detect booleans by value type
      if (typeof value === "boolean") return <BooleanCell value={value} />
      return <TextCell value={value} maxLength={80} />
  }
}

function RecordRow({
  record,
  table,
  properties,
  index,
  onEdit,
  onDelete,
}: {
  record: Record<string, unknown>
  table: DatabaseTable
  properties: DatabaseProperty[]
  index: number
  onEdit: (record: Record<string, unknown>) => void
  onDelete: (record: Record<string, unknown>) => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <tr
      className={cn(
        "group border-b border-border/30 transition-all duration-150",
        index % 2 === 0 ? "bg-background" : "bg-muted/20",
        "hover:bg-accent/30 hover:shadow-sm"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {properties.map((prop) => (
        <td
          key={prop.name}
          className={cn(
            "px-4 py-3 text-sm transition-colors",
            prop.propertyType === "number" && "text-right"
          )}
        >
          <SmartCell value={record[prop.name]} property={prop} />
        </td>
      ))}
      <td className="px-4 py-3 w-20">
        <div
          className={cn(
            "flex items-center justify-end gap-1 transition-opacity duration-150",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <button
            onClick={() => onEdit(record)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
            title="Edit record"
          >
            <i className="fa-solid fa-pen-to-square text-xs" />
          </button>
          <button
            onClick={() => onDelete(record)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
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
    <tr className="border-b border-border/30">
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

  // Derive table + properties
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
  }

  const clearFilter = () => {
    setFilterField("")
    setFilterValue("")
    setPage(0)
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (tablesLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
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
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <i className={`${table.icon ?? "fa-solid fa-table"} text-sm text-primary`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{table.label || table.type}</h2>
              <Badge variant="outline" className="text-[10px] font-mono">
                {totalCount} record{totalCount !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="shadow-sm">
          <i className="fa-solid fa-plus mr-1.5 text-xs" />
          New record
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Field</Label>
          <select
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
            className="h-9 min-w-[140px] rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
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
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contains</Label>
          <Input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Filter value…"
            className="h-9 w-52"
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sort by</Label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="h-9 min-w-[140px] rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
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
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
          >
            <i className={`fa-solid ${sortDir === "asc" ? "fa-arrow-up-1-9" : "fa-arrow-down-9-1"} text-xs`} />
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </button>
        )}
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={applyFilter} disabled={!filterField || !filterValue}>
            <i className="fa-solid fa-filter mr-1.5 text-xs" />
            Apply
          </Button>
          {(filterField || filterValue) && (
            <Button variant="ghost" size="sm" onClick={clearFilter}>
              <i className="fa-solid fa-xmark mr-1 text-xs" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <button onClick={fetchRecords} className="mt-2 text-xs text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Data Grid */}
      <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Sticky header */}
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2 border-border bg-gradient-to-b from-muted/80 to-muted/60 backdrop-blur-sm">
                {properties.map((prop) => {
                  const icon = PROPERTY_TYPE_ICONS[prop.propertyType] || "fa-circle"
                  const color = PROPERTY_TYPE_COLORS[prop.propertyType] || "text-muted-foreground"

                  return (
                    <th
                      key={prop.name}
                      className={cn(
                        "group cursor-pointer px-4 py-3.5 text-left transition-colors select-none",
                        "hover:bg-muted/80",
                        prop.propertyType === "number" && "text-right"
                      )}
                      onClick={() => {
                        if (sortField === prop.name) {
                          setSortDir(sortDir === "asc" ? "desc" : "asc")
                        } else {
                          setSortField(prop.name)
                          setSortDir("asc")
                        }
                      }}
                    >
                      <div className={cn(
                        "flex items-center gap-2",
                        prop.propertyType === "number" && "justify-end"
                      )}>
                        <i className={`fa-solid ${icon} text-[10px] ${color}`} />
                        <span className="text-xs font-semibold text-foreground tracking-wide">
                          {prop.label || prop.name}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground opacity-60">
                          {prop.propertyType}
                        </span>
                        {sortField === prop.name && (
                          <i className={cn(
                            "fa-solid text-[10px] text-primary",
                            sortDir === "asc" ? "fa-arrow-up" : "fa-arrow-down"
                          )} />
                        )}
                      </div>
                    </th>
                  )
                })}
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <RecordRowSkeleton key={i} colCount={properties.length + 1} />
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={properties.length + 1}
                    className="px-4 py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <i className="fa-solid fa-database text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {filterField || filterValue ? "No matches found" : "No records yet"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {filterField || filterValue
                            ? "Try adjusting your filter or clearing it."
                            : "Create your first record to get started."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <RecordRow
                    key={(record._id as string) ?? JSON.stringify(record)}
                    record={record}
                    table={table}
                    properties={properties}
                    index={index}
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
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-mono">
            Page {page + 1} of {totalPages} · {totalCount} total records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <i className="fa-solid fa-chevron-left mr-1.5 text-xs" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next
              <i className="fa-solid fa-chevron-right ml-1.5 text-xs" />
            </Button>
          </div>
        </div>
      )}

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
          <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground border border-border">
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
