"use client"

import { useState, useEffect, useCallback } from "react"
import { AdminNav } from "@/components/admin-nav"

// Placeholder types - will be fully defined when implementing child components
interface LedgerFilters {
  userId?: string
  creditType?: 'subscription' | 'permanent'
  transactionType?: string
  direction?: 'credit' | 'debit'
  startDate?: number
  endDate?: number
  searchTerm?: string
}

interface PaginationState {
  currentPage: number
  pageSize: 25 | 50 | 100 | 200
  totalEntries: number
  totalPages: number
}

interface SummaryStats {
  totalEntries: number
  totalCreditsGranted: number
  totalDebitsCharged: number
}

interface EnrichedLedgerEntry {
  id: string
  userId: string
  userName: string
  userEmail: string
  creditType: 'subscription' | 'permanent'
  direction: 'credit' | 'debit'
  amount: number
  transactionType: string
  balanceBefore: number
  balanceAfter: number
  referenceType?: string
  referenceId?: string
  idempotencyKey: string
  createdAt: number
  metadata?: Record<string, any>
}

// Initial state values
const initialPagination: PaginationState = {
  currentPage: 1,
  pageSize: 50,
  totalEntries: 0,
  totalPages: 0
}

const initialSummary: SummaryStats = {
  totalEntries: 0,
  totalCreditsGranted: 0,
  totalDebitsCharged: 0
}

// Transaction type options based on LedgerTransactionType
const TRANSACTION_TYPE_OPTIONS = [
  { value: 'signup_bonus', label: 'Signup Bonus' },
  { value: 'referral_bonus', label: 'Referral Bonus' },
  { value: 'subscription_grant', label: 'Subscription Grant' },
  { value: 'subscription_expiration', label: 'Subscription Expiration' },
  { value: 'build_reservation', label: 'Build Reservation' },
  { value: 'build_consumption', label: 'Build Consumption' },
  { value: 'build_release', label: 'Build Release' },
  { value: 'topup_grant', label: 'Topup Grant' },
  { value: 'admin_adjustment', label: 'Admin Adjustment' },
  { value: 'refund', label: 'Refund' },
]

function FilterPanel({
  filters,
  onUpdateFilter,
  onClearAll
}: {
  filters: LedgerFilters
  onUpdateFilter: (key: keyof LedgerFilters, value: any) => void
  onClearAll: () => void
}) {
  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '')

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Search</label>
          <input
            type="text"
            placeholder="Search user, reason, or reference..."
            value={filters.searchTerm || ''}
            onChange={(e) => onUpdateFilter('searchTerm', e.target.value || undefined)}
            className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* User ID Filter */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">User ID</label>
            <input
              type="text"
              placeholder="Filter by user..."
              value={filters.userId || ''}
              onChange={(e) => onUpdateFilter('userId', e.target.value || undefined)}
              className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Credit Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Credit Type</label>
            <select
              value={filters.creditType || ''}
              onChange={(e) => onUpdateFilter('creditType', e.target.value || undefined)}
              className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All types</option>
              <option value="subscription">Subscription</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Transaction Type</label>
            <select
              value={filters.transactionType || ''}
              onChange={(e) => onUpdateFilter('transactionType', e.target.value || undefined)}
              className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All transactions</option>
              {TRANSACTION_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Direction Filter */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Direction</label>
            <select
              value={filters.direction || ''}
              onChange={(e) => onUpdateFilter('direction', e.target.value || undefined)}
              className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All directions</option>
              <option value="credit">Credit (+)</option>
              <option value="debit">Debit (-)</option>
            </select>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Date Range</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground/70">Start Date</label>
              <input
                type="date"
                value={filters.startDate ? new Date(filters.startDate).toISOString().slice(0, 10) : ''}
                onChange={(e) => {
                  const value = e.target.value
                  onUpdateFilter('startDate', value ? new Date(value).getTime() : undefined)
                }}
                className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground/70">End Date</label>
              <input
                type="date"
                value={filters.endDate ? new Date(filters.endDate).toISOString().slice(0, 10) : ''}
                onChange={(e) => {
                  const value = e.target.value
                  // Set to end of day for end date
                  onUpdateFilter('endDate', value ? new Date(value).getTime() + 86400000 - 1 : undefined)
                }}
                className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {filters.searchTerm && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                Search: {filters.searchTerm}
                <button
                  onClick={() => onUpdateFilter('searchTerm', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove search filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.userId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                User: {filters.userId}
                <button
                  onClick={() => onUpdateFilter('userId', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove user filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.creditType && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {filters.creditType}
                <button
                  onClick={() => onUpdateFilter('creditType', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove credit type filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.transactionType && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {TRANSACTION_TYPE_OPTIONS.find(opt => opt.value === filters.transactionType)?.label}
                <button
                  onClick={() => onUpdateFilter('transactionType', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove transaction type filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.direction && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {filters.direction === 'credit' ? 'Credit (+)' : 'Debit (-)'}
                <button
                  onClick={() => onUpdateFilter('direction', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove direction filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.startDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                From: {new Date(filters.startDate).toLocaleDateString()}
                <button
                  onClick={() => onUpdateFilter('startDate', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove start date filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.endDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                To: {new Date(filters.endDate).toLocaleDateString()}
                <button
                  onClick={() => onUpdateFilter('endDate', undefined)}
                  className="hover:text-primary/80"
                  aria-label="Remove end date filter"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryPanel({ stats }: { stats: SummaryStats }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4">
        <h2 className="text-sm font-medium mb-4">Summary Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Entries */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-semibold tracking-tight">
              {stats.totalEntries.toLocaleString()}
            </p>
          </div>

          {/* Total Credits Granted */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Credits Granted</p>
            <p className="text-2xl font-semibold tracking-tight text-green-600 dark:text-green-500">
              +{stats.totalCreditsGranted.toLocaleString()}
            </p>
          </div>

          {/* Total Debits Charged */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Debits Charged</p>
            <p className="text-2xl font-semibold tracking-tight text-red-600 dark:text-red-500">
              -{stats.totalDebitsCharged.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Net Balance Indicator */}
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Net Movement</span>
          <span className={`text-sm font-semibold ${stats.totalCreditsGranted - stats.totalDebitsCharged >= 0
            ? 'text-green-600 dark:text-green-500'
            : 'text-red-600 dark:text-red-500'
            }`}>
            {stats.totalCreditsGranted - stats.totalDebitsCharged >= 0 ? '+' : ''}
            {(stats.totalCreditsGranted - stats.totalDebitsCharged).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

function LedgerRow({ entry }: { entry: EnrichedLedgerEntry }) {
  // Visual styling based on direction
  const directionIcon = entry.direction === 'credit' ? '↑' : '↓'
  const directionColor = entry.direction === 'credit'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'

  // Format timestamp
  const formatTimestamp = (ts: number) => {
    const date = new Date(ts)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Format credits with thousands separators
  const formatCredits = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  }

  // Format transaction type to human-readable
  const formatTransactionType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Credit type badge styling
  const creditTypeBadge = entry.creditType === 'subscription'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      {/* Timestamp */}
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {formatTimestamp(entry.createdAt)}
      </td>

      {/* User */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-sm">{entry.userName}</span>
          <span className="text-xs text-muted-foreground">{entry.userEmail}</span>
          <span className="text-xs font-mono text-muted-foreground">{entry.userId}</span>
        </div>
      </td>

      {/* Credit Type */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${creditTypeBadge}`}>
          {entry.creditType}
        </span>
      </td>

      {/* Direction */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 font-semibold ${directionColor}`}>
          <span className="text-lg">{directionIcon}</span>
          <span className="capitalize">{entry.direction}</span>
        </span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 font-mono text-right font-semibold">
        {formatCredits(entry.amount)}
      </td>

      {/* Transaction Type */}
      <td className="px-4 py-3 text-sm">
        {formatTransactionType(entry.transactionType)}
      </td>

      {/* Balance Before */}
      <td className="px-4 py-3 font-mono text-right text-muted-foreground">
        {formatCredits(entry.balanceBefore)}
      </td>

      {/* Balance After */}
      <td className="px-4 py-3 font-mono text-right font-semibold">
        {formatCredits(entry.balanceAfter)}
      </td>

      {/* Reference */}
      <td className="px-4 py-3">
        {entry.referenceType && entry.referenceId ? (
          <div className="flex flex-col text-xs">
            <span className="text-muted-foreground">{entry.referenceType}</span>
            <span className="font-mono text-xs truncate max-w-[150px]" title={entry.referenceId}>
              {entry.referenceId}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Idempotency Key */}
      <td className="px-4 py-3">
        <span
          className="font-mono text-xs text-muted-foreground truncate block max-w-[200px]"
          title={entry.idempotencyKey}
        >
          {entry.idempotencyKey}
        </span>
      </td>
    </tr>
  )
}

function LedgerTable({
  entries
}: {
  entries: EnrichedLedgerEntry[]
}) {
  const [sortConfig, setSortConfig] = useState<{
    field: 'createdAt' | 'amount' | 'userId'
    order: 'asc' | 'desc'
  }>({
    field: 'createdAt',
    order: 'desc'
  })

  const handleSort = (field: 'createdAt' | 'amount' | 'userId') => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
    }))
  }

  const sortedEntries = [...entries].sort((a, b) => {
    const { field, order } = sortConfig
    let comparison = 0

    if (field === 'createdAt' || field === 'amount') {
      comparison = a[field] - b[field]
    } else if (field === 'userId') {
      comparison = a.userId.localeCompare(b.userId)
    }

    return order === 'asc' ? comparison : -comparison
  })

  const SortableHeader = ({
    field,
    label
  }: {
    field: 'createdAt' | 'amount' | 'userId'
    label: string
  }) => {
    const isSorted = sortConfig.field === field
    const icon = isSorted ? (sortConfig.order === 'asc' ? '↑' : '↓') : '↕'

    return (
      <th
        className="cursor-pointer select-none hover:bg-accent/50 transition-colors"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <span className={`text-xs ${isSorted ? 'text-primary' : 'text-muted-foreground'}`}>
            {icon}
          </span>
        </div>
      </th>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider">
            <tr className="border-b border-border">
              <SortableHeader field="createdAt" label="Timestamp" />
              <SortableHeader field="userId" label="User" />
              <th className="text-left px-4 py-3">Credit Type</th>
              <th className="text-left px-4 py-3">Direction</th>
              <SortableHeader field="amount" label="Amount" />
              <th className="text-left px-4 py-3">Transaction Type</th>
              <th className="text-right px-4 py-3">Balance Before</th>
              <th className="text-right px-4 py-3">Balance After</th>
              <th className="text-left px-4 py-3">Reference</th>
              <th className="text-left px-4 py-3">Idempotency Key</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(entry => (
              <LedgerRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaginationControls({
  pagination,
  onPageChange,
  onPageSizeChange
}: {
  pagination: PaginationState
  onPageChange: (page: number) => void
  onPageSizeChange: (size: 25 | 50 | 100 | 200) => void
}) {
  const { currentPage, totalPages, pageSize, totalEntries } = pagination

  // Calculate page range display
  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endEntry = Math.min(currentPage * pageSize, totalEntries)

  // Navigation handlers
  const goToFirstPage = () => onPageChange(1)
  const goToPreviousPage = () => onPageChange(Math.max(1, currentPage - 1))
  const goToNextPage = () => onPageChange(Math.min(totalPages, currentPage + 1))
  const goToLastPage = () => onPageChange(totalPages)

  // Disable states
  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages || totalPages === 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Page info and size selector */}
        <div className="flex items-center gap-4">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value) as 25 | 50 | 100 | 200)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          {/* Entry range display */}
          <div className="text-sm text-muted-foreground">
            {totalEntries === 0 ? (
              <span>No entries</span>
            ) : (
              <span>
                {startEntry}-{endEntry} of {totalEntries.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-2">
          {/* Page indicator */}
          <span className="text-sm text-muted-foreground mr-2">
            Page {currentPage} of {totalPages || 1}
          </span>

          {/* First page button */}
          <button
            onClick={goToFirstPage}
            disabled={isFirstPage}
            aria-label="Go to first page"
            className="h-8 w-8 rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors"
          >
            <span className="sr-only">First page</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="11 17 6 12 11 7"></polyline>
              <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
          </button>

          {/* Previous page button */}
          <button
            onClick={goToPreviousPage}
            disabled={isFirstPage}
            aria-label="Go to previous page"
            className="h-8 w-8 rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors"
          >
            <span className="sr-only">Previous page</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          {/* Next page button */}
          <button
            onClick={goToNextPage}
            disabled={isLastPage}
            aria-label="Go to next page"
            className="h-8 w-8 rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors"
          >
            <span className="sr-only">Next page</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          {/* Last page button */}
          <button
            onClick={goToLastPage}
            disabled={isLastPage}
            aria-label="Go to last page"
            className="h-8 w-8 rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors"
          >
            <span className="sr-only">Last page</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLedgerPage() {
  // State management
  const [filters, setFilters] = useState<LedgerFilters>({})
  const [pagination, setPagination] = useState<PaginationState>(initialPagination)
  const [data, setData] = useState<EnrichedLedgerEntry[]>([])
  const [summary, setSummary] = useState<SummaryStats>(initialSummary)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter management functions
  const updateFilter = useCallback((key: keyof LedgerFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({})
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }, [])

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }))
  }, [])

  const handlePageSizeChange = useCallback((size: 25 | 50 | 100 | 200) => {
    setPagination(prev => ({ ...prev, pageSize: size, currentPage: 1 }))
  }, [])

  // Data fetching function - fully implemented
  const fetchLedgerData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Build query parameters from filters and pagination
      const params = new URLSearchParams()

      // Add filter parameters
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.creditType) params.set('creditType', filters.creditType)
      if (filters.transactionType) params.set('transactionType', filters.transactionType)
      if (filters.direction) params.set('direction', filters.direction)
      if (filters.startDate) params.set('startDate', filters.startDate.toString())
      if (filters.endDate) params.set('endDate', filters.endDate.toString())
      if (filters.searchTerm) params.set('searchTerm', filters.searchTerm)

      // Add pagination parameters
      params.set('page', pagination.currentPage.toString())
      params.set('limit', pagination.pageSize.toString())

      // Make API call
      const response = await fetch(`/api/admin/ledger?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch ledger data: ${response.statusText}`)
      }

      const result = await response.json()

      // Update state with response data
      setData(result.entries)
      setSummary(result.summary)
      setPagination(prev => ({
        ...prev,
        totalEntries: result.pagination.totalEntries,
        totalPages: result.pagination.totalPages
      }))
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ledger data')
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.currentPage, pagination.pageSize])

  // Fetch data on mount and when filters/pagination change
  useEffect(() => {
    fetchLedgerData()
  }, [fetchLedgerData])

  // Auto-refresh every 15 seconds (Requirement 1.19)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLedgerData()
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchLedgerData])

  // CSV Export function (Requirements: 1.13, 1.14, 1.15)
  const handleExportCSV = useCallback(() => {
    if (data.length === 0) return

    // Define CSV headers - all visible columns (Requirement 1.14)
    const headers = [
      'Timestamp',
      'User ID',
      'User Name',
      'User Email',
      'Credit Type',
      'Direction',
      'Amount',
      'Transaction Type',
      'Balance Before',
      'Balance After',
      'Reference Type',
      'Reference ID',
      'Idempotency Key'
    ]

    // Convert entries to CSV rows (Requirement 1.15 - uses filtered data)
    const rows = data.map(entry => [
      new Date(entry.createdAt).toISOString(),
      entry.userId,
      entry.userName,
      entry.userEmail,
      entry.creditType,
      entry.direction,
      entry.amount.toString(),
      entry.transactionType,
      entry.balanceBefore.toString(),
      entry.balanceAfter.toString(),
      entry.referenceType || '',
      entry.referenceId || '',
      entry.idempotencyKey
    ])

    // Build CSV content with proper escaping
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => {
          // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
          const escaped = String(cell).replace(/"/g, '""')
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
        }).join(',')
      )
    ].join('\n')

    // Create downloadable file with timestamp in filename (Requirement 1.13)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `credit-ledger-${timestamp}.csv`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header Section */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Credit Ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and analyze all credit transactions across the platform using the double-entry ledger system.
          </p>
        </header>

        {/* Filters Section */}
        <section className="mb-6">
          <FilterPanel
            filters={filters}
            onUpdateFilter={updateFilter}
            onClearAll={clearAllFilters}
          />
        </section>

        {/* Summary Section */}
        <section className="mb-6">
          <SummaryPanel stats={summary} />
        </section>

        {/* Actions Bar */}
        <section className="mb-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {loading && (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                <span>Refreshing data...</span>
              </>
            )}
            {!loading && data.length > 0 && <span>{data.length} entries displayed</span>}
            {!loading && data.length === 0 && !error && <span>No entries to display</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={data.length === 0 || loading}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={fetchLedgerData}
              disabled={loading}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </section>

        {/* Table Section */}
        <section className="mb-6">
          {/* Loading State */}
          {loading && (
            <div className="rounded-lg border border-border bg-card p-12">
              <div className="flex flex-col items-center justify-center gap-4">
                {/* Spinner */}
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Loading ledger entries...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-8">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                {/* Error Icon */}
                <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-destructive"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-destructive text-base">Failed to load ledger data</p>
                  <p className="text-sm text-destructive/80 mt-1">{error}</p>
                </div>
                <button
                  onClick={fetchLedgerData}
                  className="rounded-md bg-destructive/20 hover:bg-destructive/30 px-4 py-2 text-sm font-medium text-destructive transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && data.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card p-12">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                {/* Empty Icon */}
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-base">No ledger entries found</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    {Object.values(filters).some(v => v !== undefined && v !== '')
                      ? 'No entries match your current filters. Try adjusting your search criteria.'
                      : 'No credit transactions have been recorded yet. Transactions will appear here once they occur.'}
                  </p>
                </div>
                {Object.values(filters).some(v => v !== undefined && v !== '') && (
                  <button
                    onClick={clearAllFilters}
                    className="rounded-md bg-primary hover:bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Data Table */}
          {!loading && !error && data.length > 0 && (
            <LedgerTable entries={data} />
          )}
        </section>

        {/* Pagination Section */}
        <section>
          <PaginationControls
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </section>
      </div>
    </main>
  )
}
