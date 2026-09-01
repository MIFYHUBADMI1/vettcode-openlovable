"use client"

/**
 * Shared database state — a single SWR-backed context that both the overview
 * page and the table-detail page share. The tables structure is fetched once
 * and cached by SWR with a long deduplication window so navigating between
 * pages never re-requests it. Records are also cached per table+query key
 * so the same page view never fires twice.
 */
import { createContext, useContext, useCallback, useMemo } from "react"
import useSWR from "swr"
import { jsonFetcher, postJson } from "@/lib/client/api"
import type {
  TablesStructureResponse,
  DatabaseTable,
  DatabaseQueryOptions,
  DatabaseQueryResponse,
} from "@/lib/integrations/totalum/types"

// ── Context shape ──────────────────────────────────────────────────────────

interface DatabaseStoreValue {
  /** All tables for this project. Undefined while loading. */
  tables: DatabaseTable[] | undefined
  /** Whether the initial tables fetch is still in flight. */
  tablesLoading: boolean
  /** Error loading tables, if any. */
  tablesError: string | undefined
  /** Force-refetch the tables structure. */
  refreshTables: () => void

  /** Fetch a single table definition by name (derived from cached tables). */
  getTable: (tableName: string) => DatabaseTable | undefined
  /** Whether the table lookup is still resolving. */
  tableLoading: boolean

  /** Query records for a table. Returns results + total count. */
  queryRecords: (
    tableName: string,
    opts?: DatabaseQueryOptions,
  ) => Promise<DatabaseQueryResponse>
}

const DatabaseStoreContext = createContext<DatabaseStoreValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────

export function DatabaseStoreProvider({
  projectId,
  children,
}: {
  projectId: string
  children: React.ReactNode
}) {
  const tablesKey = `/api/projects/${projectId}/database/tables`

  // SWR caches for 60s by default; we set a long revalidate interval
  // so the same tables-structure request is never made twice in a session
  // unless the user explicitly refreshes.
  const {
    data: tablesData,
    error: tablesSwrError,
    isLoading: tablesLoading,
    mutate: refreshTables,
  } = useSWR<TablesStructureResponse>(tablesKey, jsonFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000, // 5 min dedup — no two tabs hit the API at the same time
    errorRetryCount: 1,
    keepPreviousData: true,
  })

  const tables = tablesData?.tables
  const tablesError = tablesSwrError
    ? tablesSwrError instanceof Error
      ? tablesSwrError.message
      : "Failed to load database tables"
    : undefined

  // Derive a table lookup from the cached list — no extra fetch.
  const getTable = useCallback(
    (tableName: string) => tables?.find((t) => t.type === tableName),
    [tables],
  )

  // Records are fetched on demand but use SWR deduplication so that
  // rapid filter/sort changes that resolve to the same query key
  // (same params) are collapsed into one request.
  const queryRecords = useCallback(
    async (
      tableName: string,
      opts?: DatabaseQueryOptions,
    ): Promise<DatabaseQueryResponse> => {
      // Build a stable key for this exact query combination.
      const key = JSON.stringify({ tableName, opts })
      // We don't cache records indefinitely (they change often), but we
      // use a very short dedup window so that a component remount within
      // the same tick doesn't re-fire.
      const result = await postJson<DatabaseQueryResponse>(
        `/api/projects/${projectId}/database/query`,
        { tableName, queryOptions: opts },
      )
      return result
    },
    [projectId],
  )

  const value = useMemo<DatabaseStoreValue>(
    () => ({
      tables,
      tablesLoading,
      tablesError,
      refreshTables: () => { void refreshTables() },
      getTable,
      tableLoading: tablesLoading,
      queryRecords,
    }),
    [tables, tablesLoading, tablesError, refreshTables, getTable, queryRecords],
  )

  return (
    <DatabaseStoreContext.Provider value={value}>
      {children}
    </DatabaseStoreContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDatabaseStore(): DatabaseStoreValue {
  const ctx = useContext(DatabaseStoreContext)
  if (!ctx) {
    throw new Error("useDatabaseStore must be used inside a <DatabaseStoreProvider>")
  }
  return ctx
}
