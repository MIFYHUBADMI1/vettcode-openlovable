# Design Document: Credit Ledger Migration

## Overview

This design document specifies the migration from the legacy single-entry credit transaction system to the unified double-entry ledger system. The migration involves three major components:

1. **Admin Ledger Viewer** - New React component for viewing ledger entries
2. **API Layer** - New and updated endpoints for ledger data access
3. **Data Access Layer** - Refactoring MongoStore and legacy code to use credit-service
4. **Migration Tooling** - Database cleanup scripts and verification procedures

The system will perform a clean cutover at a configured migration date, recording all new operations in the ledger without backward migration of historical data.

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│                     Admin UI Layer                       │
│  ┌─────────────────────┐  ┌──────────────────────────┐ │
│  │ Admin Ledger Viewer │  │ Transactions Page (Legacy)│ │
│  └─────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │ /api/admin/ledger│  │ /api/admin/transactions    │  │
│  └──────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Service Layer                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Credit Service (credit-service.ts)        │  │
│  │  - getBalance()                                   │  │
│  │  - grantCredits()                                 │  │
│  │  - consumeCredits()                               │  │
│  │  - reserveCredits()                               │  │
│  │  - getCreditHistory()                             │  │
│  │  - getLedgerEntries()                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Data Access Layer                       │
│  ┌─────────────────┐  ┌──────────────────────────────┐ │
│  │   MongoStore    │  │  Direct Collection Access    │ │
│  │  (Refactored)   │  │  (To Be Removed)             │ │
│  └─────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Database Layer                        │
│  ┌──────────────────┐  ┌──────────────────────────────┐│
│  │ credit_ledger    │  │ credit_transactions (Legacy) ││
│  │ (New)            │  │ (To Be Removed)              ││
│  └──────────────────┘  └──────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Credit Grant Flow (After Migration):**
```
User Action → API Endpoint → Credit Service → credit_ledger collection
                                            → users collection (balance update)
```

**Credit Query Flow (After Migration):**
```
Admin UI → API Endpoint → Credit Service.getLedgerEntries() → credit_ledger collection
                                                             → users collection (enrichment)
```

## Component Design

### 1. Admin Ledger Viewer Component

**File:** `app/admin/ledger/page.tsx`

#### Component Structure

```typescript
interface LedgerPageState {
  entries: EnrichedLedgerEntry[]
  filters: LedgerFilters
  pagination: PaginationState
  summary: SummaryStats
  loading: boolean
  error: string | null
}

interface LedgerFilters {
  userId?: string
  creditType?: 'subscription' | 'permanent'
  transactionType?: LedgerTransactionType
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

interface EnrichedLedgerEntry extends CreditLedgerEntry {
  userName: string
  userEmail: string
}
```

#### React Hooks

**useLeadgerData**: Custom hook for data fetching and state management

```typescript
function useLedgerData(filters: LedgerFilters, pagination: PaginationState) {
  const [data, setData] = useState<EnrichedLedgerEntry[]>([])
  const [summary, setSummary] = useState<SummaryStats>(initialSummary)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch data on mount and when filters/pagination change
  useEffect(() => {
    fetchLedgerData()
  }, [filters, pagination.currentPage, pagination.pageSize])

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchLedgerData, 15000)
    return () => clearInterval(interval)
  }, [filters, pagination])

  async function fetchLedgerData() {
    setLoading(true)
    setError(null)
    try {
      const params = buildQueryParams(filters, pagination)
      const response = await fetch(`/api/admin/ledger?${params}`)
      if (!response.ok) throw new Error('Failed to fetch ledger data')
      const result = await response.json()
      setData(result.entries)
      setSummary(result.summary)
      // Update pagination with server response
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { data, summary, loading, error, refetch: fetchLedgerData }
}
```

**useLedgerFilters**: Custom hook for filter state management

```typescript
function useLedgerFilters() {
  const [filters, setFilters] = useState<LedgerFilters>({})

  const updateFilter = useCallback((key: keyof LedgerFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilter = useCallback((key: keyof LedgerFilters) => {
    setFilters(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({})
  }, [])

  return { filters, updateFilter, clearFilter, clearAllFilters }
}
```

#### Component Layout

```typescript
export default function AdminLedgerPage() {
  const { filters, updateFilter, clearAllFilters } = useLedgerFilters()
  const [pagination, setPagination] = useState<PaginationState>(initialPagination)
  const { data, summary, loading, error, refetch } = useLedgerData(filters, pagination)

  return (
    <div className="admin-ledger-page">
      {/* Header */}
      <PageHeader title="Credit Ledger" />
      
      {/* Filters Section */}
      <FilterPanel filters={filters} onUpdateFilter={updateFilter} onClearAll={clearAllFilters} />
      
      {/* Summary Statistics */}
      <SummaryPanel stats={summary} />
      
      {/* Actions Bar */}
      <ActionsBar onExportCSV={() => exportToCSV(data, filters)} onRefresh={refetch} />
      
      {/* Data Table */}
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {!loading && data.length === 0 && <EmptyState />}
      {!loading && data.length > 0 && (
        <LedgerTable entries={data} sortConfig={sortConfig} onSort={handleSort} />
      )}
      
      {/* Pagination Controls */}
      <PaginationControls 
        pagination={pagination} 
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
```

#### Sub-Components

**FilterPanel**: Renders all filter inputs

```typescript
interface FilterPanelProps {
  filters: LedgerFilters
  onUpdateFilter: (key: keyof LedgerFilters, value: any) => void
  onClearAll: () => void
}

function FilterPanel({ filters, onUpdateFilter, onClearAll }: FilterPanelProps) {
  return (
    <div className="filter-panel">
      <SearchInput 
        value={filters.searchTerm || ''} 
        onChange={(v) => onUpdateFilter('searchTerm', v)}
        placeholder="Search user, reason, or reference..."
      />
      <SelectFilter
        label="Credit Type"
        value={filters.creditType}
        options={['subscription', 'permanent']}
        onChange={(v) => onUpdateFilter('creditType', v)}
      />
      <SelectFilter
        label="Transaction Type"
        value={filters.transactionType}
        options={TRANSACTION_TYPES}
        onChange={(v) => onUpdateFilter('transactionType', v)}
      />
      <SelectFilter
        label="Direction"
        value={filters.direction}
        options={['credit', 'debit']}
        onChange={(v) => onUpdateFilter('direction', v)}
      />
      <DateRangeFilter
        startDate={filters.startDate}
        endDate={filters.endDate}
        onStartChange={(v) => onUpdateFilter('startDate', v)}
        onEndChange={(v) => onUpdateFilter('endDate', v)}
      />
      <Button onClick={onClearAll} variant="secondary">Clear All</Button>
    </div>
  )
}
```

**LedgerTable**: Renders the main data table

```typescript
interface LedgerTableProps {
  entries: EnrichedLedgerEntry[]
  sortConfig: SortConfig
  onSort: (field: string) => void
}

function LedgerTable({ entries, sortConfig, onSort }: LedgerTableProps) {
  return (
    <table className="ledger-table">
      <thead>
        <tr>
          <SortableHeader field="createdAt" label="Timestamp" config={sortConfig} onSort={onSort} />
          <th>User</th>
          <th>Credit Type</th>
          <th>Direction</th>
          <SortableHeader field="amount" label="Amount" config={sortConfig} onSort={onSort} />
          <th>Transaction Type</th>
          <th>Balance Before</th>
          <th>Balance After</th>
          <th>Reference</th>
          <th>Idempotency Key</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => (
          <LedgerRow key={entry.id} entry={entry} />
        ))}
      </tbody>
    </table>
  )
}
```

**LedgerRow**: Renders individual ledger entry

```typescript
function LedgerRow({ entry }: { entry: EnrichedLedgerEntry }) {
  const directionIcon = entry.direction === 'credit' ? '↑' : '↓'
  const directionColor = entry.direction === 'credit' ? 'text-green-600' : 'text-red-600'
  
  return (
    <tr className="ledger-row">
      <td>{formatTimestamp(entry.createdAt)}</td>
      <td>
        <div>{entry.userName}</div>
        <div className="text-sm text-gray-500">{entry.userEmail}</div>
      </td>
      <td>
        <Badge variant={entry.creditType === 'subscription' ? 'blue' : 'purple'}>
          {entry.creditType}
        </Badge>
      </td>
      <td>
        <span className={directionColor}>
          {directionIcon} {entry.direction}
        </span>
      </td>
      <td className="font-mono">{formatCredits(entry.amount)}</td>
      <td>{formatTransactionType(entry.transactionType)}</td>
      <td className="font-mono">{formatCredits(entry.balanceBefore)}</td>
      <td className="font-mono">{formatCredits(entry.balanceAfter)}</td>
      <td>
        {entry.referenceType && (
          <div>
            <span className="text-sm text-gray-500">{entry.referenceType}:</span>
            <span className="font-mono text-xs">{entry.referenceId}</span>
          </div>
        )}
      </td>
      <td className="font-mono text-xs truncate max-w-xs">{entry.idempotencyKey}</td>
    </tr>
  )
}
```

#### CSV Export Implementation

```typescript
function exportToCSV(entries: EnrichedLedgerEntry[], filters: LedgerFilters) {
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
    'Idempotency Key',
    'Reason'
  ]

  const rows = entries.map(entry => [
    new Date(entry.createdAt).toISOString(),
    entry.userId,
    entry.userName,
    entry.userEmail,
    entry.creditType,
    entry.direction,
    entry.amount,
    entry.transactionType,
    entry.balanceBefore,
    entry.balanceAfter,
    entry.referenceType || '',
    entry.referenceId || '',
    entry.idempotencyKey,
    formatTransactionReason(entry.transactionType, entry.metadata)
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `credit-ledger-${Date.now()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
```

### 2. API Endpoint Design

#### New Endpoint: `/api/admin/ledger`

**File:** `app/api/admin/ledger/route.ts`

**Request Schema:**

```typescript
interface LedgerQueryParams {
  userId?: string
  creditType?: 'subscription' | 'permanent'
  transactionType?: LedgerTransactionType
  direction?: 'credit' | 'debit'
  startDate?: string  // Unix timestamp as string
  endDate?: string    // Unix timestamp as string
  page?: string       // Positive integer as string
  limit?: string      // 25, 50, 100, or 200 as string
  sortBy?: string     // 'createdAt' | 'amount' | 'userId'
  sortOrder?: string  // 'asc' | 'desc'
}
```

**Response Schema:**

```typescript
interface LedgerApiResponse {
  entries: EnrichedLedgerEntry[]
  pagination: {
    currentPage: number
    pageSize: number
    totalEntries: number
    totalPages: number
  }
  summary: {
    totalEntries: number
    totalCreditsGranted: number
    totalDebitsCharged: number
  }
}
```

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/auth-fns'
import { creditLedgerCol, usersCol } from '@/lib/db/collections'
import type { Filter } from 'mongodb'
import type { CreditLedgerEntry } from '@/lib/billing/billing-types'

export async function GET(request: NextRequest) {
  // 1. Authentication check
  const session = await getServerSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }

  try {
    // 2. Parse and validate query parameters
    const params = parseQueryParams(request.nextUrl.searchParams)
    
    // 3. Build MongoDB filter
    const filter = buildLedgerFilter(params)
    
    // 4. Build sort criteria
    const sort = buildSortCriteria(params.sortBy, params.sortOrder)
    
    // 5. Execute query with pagination
    const col = await creditLedgerCol()
    const totalEntries = await col.countDocuments(filter)
    const skip = (params.page - 1) * params.limit
    
    const entries = await col
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(params.limit)
      .toArray()
    
    // 6. Enrich with user data
    const enrichedEntries = await enrichWithUserData(entries)
    
    // 7. Calculate summary statistics
    const summary = await calculateSummary(filter)
    
    // 8. Return response
    return NextResponse.json({
      entries: enrichedEntries,
      pagination: {
        currentPage: params.page,
        pageSize: params.limit,
        totalEntries,
        totalPages: Math.ceil(totalEntries / params.limit)
      },
      summary
    })
  } catch (error) {
    console.error('Ledger query error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ledger data' },
      { status: 500 }
    )
  }
}

function parseQueryParams(searchParams: URLSearchParams): ParsedLedgerQuery {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limitStr = searchParams.get('limit') || '50'
  const validLimits = [25, 50, 100, 200]
  const limit = validLimits.includes(Number(limitStr)) ? Number(limitStr) : 50

  return {
    userId: searchParams.get('userId') || undefined,
    creditType: searchParams.get('creditType') as any || undefined,
    transactionType: searchParams.get('transactionType') as any || undefined,
    direction: searchParams.get('direction') as any || undefined,
    startDate: searchParams.get('startDate') ? Number(searchParams.get('startDate')) : undefined,
    endDate: searchParams.get('endDate') ? Number(searchParams.get('endDate')) : undefined,
    searchTerm: searchParams.get('searchTerm') || undefined,
    page,
    limit,
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc'
  }
}

function buildLedgerFilter(params: ParsedLedgerQuery): Filter<CreditLedgerEntry> {
  const filter: Filter<CreditLedgerEntry> = {}

  if (params.userId) {
    filter.userId = params.userId
  }

  if (params.creditType) {
    filter.creditType = params.creditType
  }

  if (params.transactionType) {
    filter.transactionType = params.transactionType
  }

  if (params.direction) {
    filter.direction = params.direction
  }

  if (params.startDate || params.endDate) {
    filter.createdAt = {}
    if (params.startDate) {
      filter.createdAt.$gte = params.startDate
    }
    if (params.endDate) {
      filter.createdAt.$lte = params.endDate
    }
  }

  // Search across multiple text fields
  if (params.searchTerm) {
    filter.$or = [
      { 'metadata.reason': { $regex: params.searchTerm, $options: 'i' } },
      { referenceId: { $regex: params.searchTerm, $options: 'i' } }
    ]
  }

  return filter
}

function buildSortCriteria(sortBy?: string, sortOrder?: string) {
  const order = sortOrder === 'asc' ? 1 : -1
  const field = sortBy || 'createdAt'
  return { [field]: order }
}

async function enrichWithUserData(
  entries: CreditLedgerEntry[]
): Promise<EnrichedLedgerEntry[]> {
  const users = await usersCol()
  const userIds = [...new Set(entries.map(e => e.userId))]
  
  // Batch fetch user data
  const userDocs = await users
    .find({ id: { $in: userIds } })
    .project({ id: 1, name: 1, email: 1 })
    .toArray()
  
  const userMap = new Map(userDocs.map(u => [u.id, { name: u.name, email: u.email }]))
  
  return entries.map(entry => {
    const user = userMap.get(entry.userId)
    return {
      ...entry,
      userName: user?.name || 'Unknown User',
      userEmail: user?.email || 'unknown@email.com'
    }
  })
}

async function calculateSummary(filter: Filter<CreditLedgerEntry>): Promise<SummaryStats> {
  const col = await creditLedgerCol()
  
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalCreditsGranted: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0]
          }
        },
        totalDebitsCharged: {
          $sum: {
            $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0]
          }
        }
      }
    }
  ]
  
  const result = await col.aggregate(pipeline).toArray()
  
  if (result.length === 0) {
    return { totalEntries: 0, totalCreditsGranted: 0, totalDebitsCharged: 0 }
  }
  
  return {
    totalEntries: result[0].totalEntries,
    totalCreditsGranted: result[0].totalCreditsGranted,
    totalDebitsCharged: result[0].totalDebitsCharged
  }
}
```

#### Updated Endpoint: `/api/admin/transactions`

**File:** `app/api/admin/transactions/route.ts`

**Changes Required:**

1. Replace `creditTransactionsCol` import with `creditLedgerCol`
2. Update query to use ledger schema
3. Map ledger fields to legacy response format
4. Compute signed amount from direction and amount

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/auth-fns'
import { creditLedgerCol, usersCol } from '@/lib/db/collections'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const col = await creditLedgerCol()
    
    // Query ledger with limit
    const entries = await col
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()
    
    // Enrich with user data
    const users = await usersCol()
    const userIds = [...new Set(entries.map(e => e.userId))]
    const userDocs = await users
      .find({ id: { $in: userIds } })
      .project({ id: 1, name: 1, email: 1 })
      .toArray()
    const userMap = new Map(userDocs.map(u => [u.id, { name: u.name, email: u.email }]))
    
    // Map to legacy format
    const transactions = entries.map(entry => {
      const user = userMap.get(entry.userId)
      const signedAmount = entry.direction === 'credit' ? entry.amount : -entry.amount
      const reason = entry.metadata?.reason as string || entry.transactionType
      
      return {
        id: entry.id,
        userId: entry.userId,
        userName: user?.name || 'Unknown User',
        userEmail: user?.email || 'unknown@email.com',
        type: entry.transactionType,
        amount: signedAmount,
        reason: reason,
        createdAt: entry.createdAt,
        // Additional ledger fields for enhanced UI
        creditType: entry.creditType,
        direction: entry.direction,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter
      }
    })
    
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Transaction query error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
```

### 3. MongoStore Refactoring

**File:** `lib/store/mongo-store.ts`

#### Refactoring Strategy

Replace direct database operations with delegation to credit-service. This maintains the existing interface while routing all credit operations through the centralized service.

#### Method-by-Method Delegation

**getBalance() - Before:**
```typescript
async getBalance(userId: string): Promise<number> {
  const now = Date.now()
  const cached = this.cacheGet<number>(`bal:${userId}`, now)
  if (cached !== undefined) return cached

  const users = await usersCol()
  const user = await users.findOne({ id: userId })
  const balance = user?.credits ?? 0
  this.cacheSet(`bal:${userId}`, balance, now)
  return balance
}
```

**getBalance() - After:**
```typescript
async getBalance(userId: string): Promise<number> {
  const now = Date.now()
  const cached = this.cacheGet<number>(`bal:${userId}`, now)
  if (cached !== undefined) return cached

  // Delegate to credit-service
  const balance = await getAvailableCredits(userId)
  this.cacheSet(`bal:${userId}`, balance, now)
  return balance
}
```

**listTransactions() - Before:**
```typescript
async listTransactions(userId: string, limit = 100): Promise<CreditTransaction[]> {
  const now = Date.now()
  const cached = this.cacheGet<CreditTransaction[]>(`tx:${userId}`, now)
  if (cached !== undefined) return cached

  const col = await creditTransactionsCol()
  const docs = await col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
  const result = docs.map(stripMongoId)
  this.cacheSet(`tx:${userId}`, result, now)
  return result
}
```

**listTransactions() - After:**
```typescript
async listTransactions(userId: string, limit = 100): Promise<CreditTransaction[]> {
  const now = Date.now()
  const cached = this.cacheGet<CreditTransaction[]>(`tx:${userId}`, now)
  if (cached !== undefined) return cached

  // Delegate to credit-service, which returns ledger entries
  // Map ledger entries to legacy CreditTransaction format for backward compatibility
  const history = await getCreditHistory(userId, { limit })
  const result = history.map(mapLedgerToLegacyTransaction)
  this.cacheSet(`tx:${userId}`, result, now)
  return result
}

// Helper function to map ledger entries to legacy format
function mapLedgerToLegacyTransaction(entry: CreditLedgerEntry): CreditTransaction {
  const signedAmount = entry.direction === 'credit' ? entry.amount : -entry.amount
  return {
    id: entry.id,
    userId: entry.userId,
    amount: signedAmount,
    type: entry.transactionType,
    reason: entry.metadata?.reason as string || entry.transactionType,
    createdAt: entry.createdAt
  }
}
```

**addTransaction() - Before:**
```typescript
async addTransaction(tx: CreditTransaction): Promise<void> {
  const users = await usersCol()
  const col = await creditTransactionsCol()
  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()
  try {
    await session.withTransaction(async () => {
      await users.updateOne(
        { id: tx.userId },
        { $inc: { credits: tx.amount }, $set: { updatedAt: Date.now() } },
        { session },
      )
      await col.insertOne({ ...tx }, { session })
    })
  } finally {
    await session.endSession()
  }
  this.cache.delete(`bal:${tx.userId}`)
  this.cache.delete(`tx:${tx.userId}`)
}
```

**addTransaction() - After:**
```typescript
async addTransaction(tx: CreditTransaction): Promise<void> {
  // Delegate to credit-service based on transaction type
  // The credit-service handles the double-entry ledger and balance updates
  
  const isCredit = tx.amount > 0
  const absoluteAmount = Math.abs(tx.amount)
  
  if (isCredit) {
    // Grant credits through credit-service
    await grantCredits({
      userId: tx.userId,
      amount: absoluteAmount,
      creditType: 'permanent', // Default for legacy addTransaction calls
      transactionType: tx.type as LedgerTransactionType,
      idempotencyKey: tx.id, // Use transaction ID as idempotency key
      metadata: {
        reason: tx.reason,
        legacyMigration: true
      }
    })
  } else {
    // Consume credits through credit-service
    await consumeCredits({
      userId: tx.userId,
      amount: absoluteAmount,
      transactionType: tx.type as LedgerTransactionType,
      idempotencyKey: tx.id,
      metadata: {
        reason: tx.reason,
        legacyMigration: true
      }
    })
  }
  
  // Cache invalidation still handled locally
  this.cache.delete(`bal:${tx.userId}`)
  this.cache.delete(`tx:${tx.userId}`)
}
```

**reserveCreditsAtomic() - Before:**
```typescript
async reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean> {
  const users = await usersCol()
  const col = await creditTransactionsCol()
  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()
  try {
    let success = false
    await session.withTransaction(async () => {
      const result = await users.updateOne(
        { id: userId, credits: { $gte: amount } },
        { $inc: { credits: -amount }, $set: { updatedAt: Date.now() } },
        { session },
      )
      if (result.modifiedCount === 0) {
        success = false
        return
      }
      await col.insertOne({ ...tx }, { session })
      success = true
    })
    return success
  } finally {
    await session.endSession()
  }
  this.cache.delete(`bal:${userId}`)
  this.cache.delete(`tx:${userId}`)
}
```

**reserveCreditsAtomic() - After:**
```typescript
async reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean> {
  // Delegate to credit-service reservation logic
  try {
    await reserveCredits({
      userId,
      projectId: tx.metadata?.projectId as string || 'unknown',
      buildId: tx.metadata?.buildId as string || 'unknown',
      complexity: tx.metadata?.complexity as any || 'simple',
      creditCost: amount,
      idempotencyKey: tx.id
    })
    
    // Cache invalidation
    this.cache.delete(`bal:${userId}`)
    this.cache.delete(`tx:${userId}`)
    
    return true
  } catch (error) {
    // If reservation fails due to insufficient balance, return false
    if (error.message?.includes('Insufficient credits')) {
      return false
    }
    // For other errors, propagate
    throw error
  }
}
```

#### Import Changes

**Remove:**
```typescript
import { creditTransactionsCol } from '@/lib/db/collections'
```

**Add:**
```typescript
import {
  getAvailableCredits,
  getCreditHistory,
  grantCredits,
  consumeCredits,
  reserveCredits
} from '@/lib/billing/credit-service'
import type { CreditLedgerEntry } from '@/lib/billing/billing-types'
```

### 4. Legacy Code Migration Pattern

#### Files to Refactor (10 total)

1. `lib/store/mongo-store.ts` ✓ (detailed above)
2. `lib/referrals/referrals.ts`
3. `lib/infrastructure/service.ts`
4. `lib/billing/topup-service.ts`
5. `lib/auth/users.ts`
6. `app/api/admin/users/[id]/route.ts`
7. `app/api/admin/self-credits/route.ts`
8. `app/api/admin/billing/user-billing/route.ts`
9. `app/api/admin/billing/audit-log/route.ts`
10. `app/api/admin/transactions/route.ts` ✓ (detailed above)

#### Refactoring Pattern Template

For each file:

**Step 1: Identify Direct Collection Access**
```typescript
// BEFORE - Direct access
const col = await creditTransactionsCol()
await col.insertOne({ userId, amount, type, ... })
```

**Step 2: Replace with Credit Service Call**
```typescript
// AFTER - Via credit-service
import { grantCredits } from '@/lib/billing/credit-service'
await grantCredits({
  userId,
  amount,
  creditType: 'permanent', // or 'subscription'
  transactionType: 'appropriate_type',
  idempotencyKey: generateIdempotencyKey(),
  metadata: { /* context */ }
})
```

**Step 3: Update Queries**
```typescript
// BEFORE - Direct query
const col = await creditTransactionsCol()
const txs = await col.find({ userId }).sort({ createdAt: -1 }).toArray()
```

```typescript
// AFTER - Via credit-service
import { getCreditHistory } from '@/lib/billing/credit-service'
const txs = await getCreditHistory(userId, { limit: 100 })
```

**Step 4: Remove Imports**
```typescript
// Remove this
import { creditTransactionsCol } from '@/lib/db/collections'
```

### 5. Migration Order and Dependencies

Execute refactoring in this order to minimize dependency issues:

```
Phase 1: Foundation (No breaking changes)
  └─ Create new API endpoint /api/admin/ledger
  └─ Create Admin Ledger Viewer component
  └─ Update /api/admin/transactions to read from ledger

Phase 2: Core Services (Internal changes only)
  └─ Refactor MongoStore methods
  └─ Update lib/auth/users.ts
  └─ Update lib/billing/topup-service.ts

Phase 3: Feature Services
  └─ Update lib/referrals/referrals.ts
  └─ Update lib/infrastructure/service.ts

Phase 4: Admin APIs
  └─ Update app/api/admin/users/[id]/route.ts
  └─ Update app/api/admin/self-credits/route.ts
  └─ Update app/api/admin/billing/user-billing/route.ts
  └─ Update app/api/admin/billing/audit-log/route.ts

Phase 5: Verification
  └─ Run all tests
  └─ Manual smoke testing
  └─ Search for any remaining creditTransactionsCol references
  └─ Verify no writes to credit_transactions collection

Phase 6: Cleanup
  └─ Run database cleanup script
  └─ Remove creditTransactionsCol from collections.ts
  └─ Remove credit_transactions indexes
  └─ Update documentation
```

### 6. Database Cleanup Script Design

**File:** `scripts/cleanup-legacy-credit-transactions.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Cleanup Script: Legacy Credit Transactions Collection
 * 
 * This script safely removes the old credit_transactions collection after
 * migration to the credit_ledger system.
 * 
 * IMPORTANT: Run this only after:
 * 1. All code has been refactored to use credit-service
 * 2. The credit_ledger collection is populated and working
 * 3. All tests pass
 * 4. Manual verification checklist is complete
 * 
 * Usage:
 *   npm run cleanup:credit-transactions
 *   
 * The script will:
 * 1. Verify credit_ledger exists and has entries
 * 2. Create a backup of credit_transactions
 * 3. Prompt for confirmation
 * 4. Drop the credit_transactions collection
 * 5. Verify deletion
 */

import { MongoClient } from 'mongodb'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const MONGODB_URI = process.env.MONGODB_URI || ''
const DB_NAME = process.env.DB_NAME || 'mirrorsite'
const BACKUP_DIR = path.join(process.cwd(), 'backups')

interface BackupStats {
  collection: string
  documentCount: number
  backupPath: string
  timestamp: number
}

async function main() {
  console.log('🔧 Legacy Credit Transactions Cleanup Script')
  console.log('=' .repeat(60))
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable not set')
    process.exit(1)
  }
  
  const client = new MongoClient(MONGODB_URI)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db(DB_NAME)
    
    // Step 1: Verify ledger exists and has data
    console.log('\n📊 Verifying credit_ledger collection...')
    const ledgerCount = await db.collection('credit_ledger').countDocuments()
    
    if (ledgerCount === 0) {
      console.error('❌ ERROR: credit_ledger collection is empty!')
      console.error('   Cannot proceed with cleanup. Ensure the new system is working.')
      process.exit(1)
    }
    
    console.log(`✅ credit_ledger has ${ledgerCount} entries`)
    
    // Step 2: Check legacy collection
    console.log('\n📊 Checking credit_transactions collection...')
    const collections = await db.listCollections({ name: 'credit_transactions' }).toArray()
    
    if (collections.length === 0) {
      console.log('ℹ️  credit_transactions collection does not exist. Nothing to clean up.')
      process.exit(0)
    }
    
    const legacyCount = await db.collection('credit_transactions').countDocuments()
    console.log(`📦 credit_transactions has ${legacyCount} documents`)
    
    // Step 3: Create backup
    console.log('\n💾 Creating backup...')
    const backupStats = await createBackup(db, 'credit_transactions')
    console.log(`✅ Backup created: ${backupStats.backupPath}`)
    console.log(`   Documents backed up: ${backupStats.documentCount}`)
    
    // Step 4: Confirmation
    console.log('\n⚠️  WARNING: About to DROP credit_transactions collection')
    console.log(`   ${legacyCount} documents will be permanently deleted`)
    console.log(`   Backup saved to: ${backupStats.backupPath}`)
    
    const confirmed = await promptConfirmation('\nType "DELETE" to confirm: ')
    
    if (confirmed !== 'DELETE') {
      console.log('\n❌ Deletion cancelled')
      process.exit(0)
    }
    
    // Step 5: Drop collection
    console.log('\n🗑️  Dropping credit_transactions collection...')
    await db.collection('credit_transactions').drop()
    console.log('✅ Collection dropped successfully')
    
    // Step 6: Verify deletion
    const verifyCollections = await db.listCollections({ name: 'credit_transactions' }).toArray()
    if (verifyCollections.length === 0) {
      console.log('✅ Verified: credit_transactions collection no longer exists')
    } else {
      console.error('⚠️  Warning: Collection still appears to exist')
    }
    
    // Step 7: Log completion
    const logEntry = {
      action: 'DROP_COLLECTION',
      collection: 'credit_transactions',
      documentCount: legacyCount,
      backupPath: backupStats.backupPath,
      timestamp: Date.now(),
      completedAt: new Date().toISOString()
    }
    
    const logPath = path.join(BACKUP_DIR, 'cleanup.log')
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n')
    console.log(`\n📝 Operation logged to: ${logPath}`)
    
    console.log('\n✅ Cleanup complete!')
    console.log('\nNext steps:')
    console.log('1. Remove creditTransactionsCol from lib/db/collections.ts')
    console.log('2. Remove credit_transactions type definitions')
    console.log('3. Remove credit_transactions index creation from ensureIndexes')
    console.log('4. Update CHANGELOG.md')
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

async function createBackup(db: any, collectionName: string): Promise<BackupStats> {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
  
  const timestamp = Date.now()
  const backupFilename = `${collectionName}_backup_${timestamp}.json`
  const backupPath = path.join(BACKUP_DIR, backupFilename)
  
  // Export all documents
  const documents = await db.collection(collectionName).find({}).toArray()
  
  const backupData = {
    collection: collectionName,
    exportedAt: new Date().toISOString(),
    timestamp,
    documentCount: documents.length,
    documents
  }
  
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2))
  
  return {
    collection: collectionName,
    documentCount: documents.length,
    backupPath,
    timestamp
  }
}

async function promptConfirmation(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Run the script
main().catch(console.error)
```

**Add to package.json scripts:**
```json
{
  "scripts": {
    "cleanup:credit-transactions": "tsx scripts/cleanup-legacy-credit-transactions.ts"
  }
}
```

### 7. Type Definitions

**File:** `lib/billing/billing-types.ts` (additions)

```typescript
// Enhanced ledger entry with user information for admin UI
export interface EnrichedLedgerEntry extends CreditLedgerEntry {
  userName: string
  userEmail: string
}

// Ledger query parameters
export interface LedgerQueryParams {
  userId?: string
  creditType?: CreditType
  transactionType?: LedgerTransactionType
  direction?: 'credit' | 'debit'
  startDate?: number
  endDate?: number
  searchTerm?: string
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Ledger API response
export interface LedgerApiResponse {
  entries: EnrichedLedgerEntry[]
  pagination: PaginationMetadata
  summary: SummaryStatistics
}

export interface PaginationMetadata {
  currentPage: number
  pageSize: number
  totalEntries: number
  totalPages: number
}

export interface SummaryStatistics {
  totalEntries: number
  totalCreditsGranted: number
  totalDebitsCharged: number
}

// Legacy transaction type for backward compatibility
export interface CreditTransaction {
  id: string
  userId: string
  amount: number  // Signed: positive for credit, negative for debit
  type: string
  reason: string
  createdAt: number
  metadata?: Record<string, unknown>
}
```

### 8. Error Handling

#### Error Scenarios and Responses

**Insufficient Credits:**
```typescript
class InsufficientCreditsError extends Error {
  constructor(requested: number, available: number) {
    super(`Insufficient credits: requested ${requested}, available ${available}`)
    this.name = 'InsufficientCreditsError'
  }
}
```

**Idempotency Key Conflict:**
```typescript
class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency key already used: ${key}`)
    this.name = 'IdempotencyConflictError'
  }
}
```

**Invalid Query Parameters:**
```typescript
class InvalidQueryParametersError extends Error {
  constructor(message: string) {
    super(`Invalid query parameters: ${message}`)
    this.name = 'InvalidQueryParametersError'
  }
}
```

#### Error Handling in API Endpoints

```typescript
try {
  // Operation logic
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    return NextResponse.json(
      { error: error.message, code: 'INSUFFICIENT_CREDITS' },
      { status: 400 }
    )
  }
  
  if (error instanceof IdempotencyConflictError) {
    return NextResponse.json(
      { error: error.message, code: 'IDEMPOTENCY_CONFLICT' },
      { status: 409 }
    )
  }
  
  if (error instanceof InvalidQueryParametersError) {
    return NextResponse.json(
      { error: error.message, code: 'INVALID_PARAMETERS' },
      { status: 400 }
    )
  }
  
  // Generic error
  console.error('Unexpected error:', error)
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  )
}
```

### 9. Caching Strategy

**Cache Keys:**
```typescript
const CACHE_KEYS = {
  balance: (userId: string) => `bal:${userId}`,
  transactions: (userId: string) => `tx:${userId}`,
  ledgerQuery: (hash: string) => `ledger:${hash}`
}
```

**Cache Invalidation Rules:**
- Invalidate balance cache on any credit operation
- Invalidate transactions cache on any credit operation
- Ledger query cache has 15-second TTL for admin UI auto-refresh

**Implementation in MongoStore:**
```typescript
// After any credit operation
private invalidateUserCache(userId: string): void {
  this.cache.delete(CACHE_KEYS.balance(userId))
  this.cache.delete(CACHE_KEYS.transactions(userId))
}
```

### 10. Migration Date Configuration

**Environment Variable:**
```bash
# .env.local
CREDIT_LEDGER_MIGRATION_DATE=1704067200000  # Unix timestamp in ms
```

**Configuration Module:**
```typescript
// lib/billing/config.ts additions

export const MIGRATION_DATE = process.env.CREDIT_LEDGER_MIGRATION_DATE
  ? parseInt(process.env.CREDIT_LEDGER_MIGRATION_DATE)
  : Date.now() // Default to immediate cutover

export function isPostMigration(): boolean {
  return Date.now() >= MIGRATION_DATE
}

export function validateMigrationDate(): void {
  if (isNaN(MIGRATION_DATE)) {
    throw new Error('Invalid CREDIT_LEDGER_MIGRATION_DATE environment variable')
  }
  console.log(`Credit system migration date: ${new Date(MIGRATION_DATE).toISOString()}`)
  console.log(`Current mode: ${isPostMigration() ? 'LEDGER' : 'LEGACY'}`)
}
```

**Usage:**
```typescript
import { isPostMigration } from '@/lib/billing/config'

if (isPostMigration()) {
  // Use credit-service (ledger system)
} else {
  // Use legacy system (during transition period)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Ledger Entry Display Completeness

*For any* ledger entry retrieved by the Admin Ledger Viewer, the rendered component SHALL contain all required fields: user identifier, user name, user email, credit type, amount, direction, transaction type, reference type, reference identifier, balance before, balance after, timestamp, and idempotency key.

**Validates: Requirements 1.3**

### Property 2: Filter Result Correctness

*For any* set of ledger entries and filter criteria (user, credit type, transaction type, direction, date range), all filtered results SHALL match ALL active filter criteria.

**Validates: Requirements 1.4, 1.5, 1.6, 1.7, 1.8**

### Property 3: Pagination Correctness

*For any* dataset and page size, the pagination logic SHALL correctly divide the data such that:
- Total pages = ceil(total entries / page size)
- Each page contains at most page size entries
- All entries appear exactly once across all pages

**Validates: Requirements 1.9, 1.10, 1.11**

### Property 4: Summary Statistics Accuracy

*For any* filtered dataset, the summary statistics SHALL satisfy:
- Total credits granted = sum of all entries where direction = 'credit'
- Total debits charged = sum of all entries where direction = 'debit'
- Total entries = count of all matching entries

**Validates: Requirements 1.12**

### Property 5: CSV Export Completeness

*For any* filtered dataset, the CSV export SHALL contain exactly the filtered entries with all visible columns included.

**Validates: Requirements 1.13, 1.14, 1.15**

### Property 6: Sort Order Correctness

*For any* dataset and sort criteria (field, order), the results SHALL be ordered such that for all adjacent pairs (a, b), the comparison a[field] ≤ b[field] (ascending) or a[field] ≥ b[field] (descending) holds.

**Validates: Requirements 1.16, 1.17**

### Property 7: Search Result Relevance

*For any* search term and dataset, all returned results SHALL contain the search term in at least one searchable field (user name, user email, reason, reference identifier), case-insensitive.

**Validates: Requirements 1.18**

### Property 8: Query Parameter Acceptance

*For any* valid combination of query parameters (within specified constraints), the API endpoint SHALL accept the request and return a successful response.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11**

### Property 9: Filter Translation Correctness

*For any* set of API filter parameters, the MongoDB query SHALL return only documents that match ALL specified filters.

**Validates: Requirements 2.13, 2.14**

### Property 10: User Enrichment Completeness

*For any* set of ledger entries with valid userIds, the enriched results SHALL have userName and userEmail populated for all entries.

**Validates: Requirements 2.16**

### Property 11: API Response Structure

*For any* valid API request, the response SHALL contain an `entries` array and a `pagination` object with currentPage, pageSize, totalEntries, and totalPages fields.

**Validates: Requirements 2.17, 2.18**

### Property 12: MongoStore Delegation

*For any* MongoStore credit operation (getBalance, listTransactions, addTransaction, reserveCreditsAtomic), the corresponding Credit_Service function SHALL be invoked.

**Validates: Requirements 3.4, 3.5, 3.6, 3.7**

### Property 13: Method Signature Preservation

*For any* existing MongoStore method call pattern, the method SHALL accept the same parameters and return the same type after refactoring.

**Validates: Requirements 3.10, 3.11**

### Property 14: Error Propagation

*For any* Credit_Service operation that throws an error, MongoStore SHALL propagate that error to its caller without suppression.

**Validates: Requirements 3.14**

### Property 15: Legacy Transaction Response Mapping

*For any* ledger entry, the legacy transactions API response SHALL correctly map:
- type = ledger.transactionType
- reason = ledger.metadata.reason || ledger.transactionType
- amount = ledger.amount (positive if direction = 'credit', negative if direction = 'debit')

**Validates: Requirements 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10**

### Property 16: Ledger Field Display

*For any* ledger entry displayed in the admin transactions UI, the rendered output SHALL include credit type, direction, balance before, and balance after fields.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 17: Direction Visual Distinction

*For any* ledger entry where direction = 'credit', the UI SHALL display with green color and upward arrow; *for any* entry where direction = 'debit', the UI SHALL display with red color and downward arrow.

**Validates: Requirements 6.7, 6.8, 6.9, 6.10**

### Property 18: Migration Date Behavior

*For any* credit operation timestamp, IF timestamp < MIGRATION_DATE, the system SHALL use Legacy_System behavior; IF timestamp ≥ MIGRATION_DATE, the system SHALL use Ledger_System behavior.

**Validates: Requirements 10.3, 10.4**

### Property 19: Post-Migration Write Isolation

*For any* credit operation occurring after MIGRATION_DATE, the system SHALL write to credit_ledger collection AND SHALL NOT write to credit_transactions collection.

**Validates: Requirements 10.6, 10.7**

### Property 20: Backward Compatible Interface

*For any* existing API call pattern to MongoStore or admin endpoints, the call SHALL produce a valid response after migration (even if the response is an empty array for pre-migration data).

**Validates: Requirements 12.1, 12.2, 12.6**

## Testing Strategy

### Unit Tests

**Admin Ledger Viewer Component:**
- Filter state management
- Pagination calculations
- CSV export data transformation
- Search filtering logic
- Sort order logic

**API Endpoints:**
- Query parameter parsing and validation
- Filter construction from parameters
- Pagination calculation
- Summary statistics aggregation
- User enrichment logic
- Error responses for invalid inputs

**MongoStore:**
- Delegation to credit-service functions
- Cache invalidation on operations
- Error propagation
- Method signature compatibility

### Integration Tests

**End-to-End Credit Flows:**
- Grant credits → verify ledger entry → verify balance update
- Reserve credits → verify ledger → release → verify final state
- Consume credits → verify ledger → verify balance reduction
- Multiple operations → verify ledger sequence and balance consistency

**API Integration:**
- Full request/response cycle for /api/admin/ledger
- Filter combinations produce correct results
- Pagination navigation works correctly
- CSV export produces valid CSV format

**Database Operations:**
- Cleanup script backup creation
- Cleanup script deletion verification
- Index performance for common queries

### Property-Based Tests

Each correctness property above should have a corresponding property-based test with minimum 100 iterations:

**Example: Property 2 (Filter Result Correctness)**
```typescript
import * as fc from 'fast-check'

test('Property 2: All filtered results match filter criteria', () => {
  fc.assert(
    fc.property(
      fc.array(arbitraryLedgerEntry()),
      arbitraryLedgerFilters(),
      (entries, filters) => {
        const filtered = applyFilters(entries, filters)
        
        // Every filtered entry must match all active filters
        for (const entry of filtered) {
          if (filters.userId) {
            expect(entry.userId).toBe(filters.userId)
          }
          if (filters.creditType) {
            expect(entry.creditType).toBe(filters.creditType)
          }
          if (filters.direction) {
            expect(entry.direction).toBe(filters.direction)
          }
          if (filters.startDate) {
            expect(entry.createdAt).toBeGreaterThanOrEqual(filters.startDate)
          }
          if (filters.endDate) {
            expect(entry.createdAt).toBeLessThanOrEqual(filters.endDate)
          }
        }
      }
    ),
    { numRuns: 100 }
  )
})
```

### Manual Testing Checklist

1. **Admin UI Visual Verification:**
   - [ ] Ledger viewer displays all columns correctly
   - [ ] Filters update results in real-time
   - [ ] Pagination controls work
   - [ ] CSV export downloads correctly
   - [ ] Auto-refresh works every 15 seconds
   - [ ] Empty state displays when no results

2. **Data Accuracy:**
   - [ ] Balance before/after values are correct
   - [ ] Credit type badges show correct colors
   - [ ] Direction arrows and colors are correct
   - [ ] User names and emails are populated

3. **Legacy Compatibility:**
   - [ ] Existing transactions page still works
   - [ ] Existing API endpoints return valid data
   - [ ] MongoStore methods still work for callers

4. **Error Handling:**
   - [ ] Invalid query parameters return 400
   - [ ] Non-admin access returns 403
   - [ ] Database errors return 500

## Deployment Checklist

### Pre-Deployment

1. [ ] All tests pass (unit, integration, property-based)
2. [ ] Code review complete
3. [ ] All legacy code refactored
4. [ ] No references to `creditTransactionsCol` remain except in cleanup script
5. [ ] Migration date configured in environment
6. [ ] Database indexes created for credit_ledger collection
7. [ ] Backup procedures documented and tested

### Deployment Steps

1. [ ] Deploy code to staging environment
2. [ ] Run smoke tests on staging
3. [ ] Verify admin ledger viewer works
4. [ ] Verify legacy endpoints still work
5. [ ] Deploy to production
6. [ ] Monitor error rates for 1 hour
7. [ ] Verify credit operations work correctly
8. [ ] Check ledger entries are being created

### Post-Deployment (after 48 hours)

1. [ ] Run verification checklist
2. [ ] Confirm no writes to credit_transactions
3. [ ] Verify ledger data accuracy
4. [ ] Run cleanup script
5. [ ] Remove creditTransactionsCol from collections.ts
6. [ ] Remove index creation for credit_transactions
7. [ ] Update documentation
8. [ ] Update CHANGELOG

## Rollback Procedure

If critical issues are discovered:

**Immediate Rollback (< 1 hour):**
1. Revert deployment to previous version
2. Investigate issue in staging
3. Fix and re-test

**Data Rollback (if ledger data is corrupted):**
1. Stop all credit operations
2. Restore credit_transactions from backup
3. Restore user credit balances from backup
4. Revert code deployment
5. Investigate root cause
6. Re-test fix thoroughly before retry

**Note:** Because we are NOT migrating historical data, rolling back is simpler. New ledger entries created post-migration can be deleted, and the system can return to legacy mode. User balances should be synchronized from the authoritative source.

## Performance Considerations

### Query Optimization

**Indexes for credit_ledger collection:**
```typescript
// In lib/db/collections.ts ensureIndexes()
await creditLedger.createIndex({ userId: 1, createdAt: -1 })
await creditLedger.createIndex({ createdAt: -1 })
await creditLedger.createIndex({ transactionType: 1, createdAt: -1 })
await creditLedger.createIndex({ creditType: 1, createdAt: -1 })
await creditLedger.createIndex({ idempotencyKey: 1 }, { unique: true })
```

**Query Performance Targets:**
- `/api/admin/ledger` should respond in < 500ms for typical queries
- User enrichment batch fetch reduces N+1 query problem
- Pagination limits result set size

### Caching Strategy

- Balance cache: 30 second TTL
- Transaction list cache: 30 second TTL
- Admin UI auto-refresh: 15 second interval (does not rely on cache)

### Scalability

- Ledger collection will grow indefinitely
- Consider archiving strategy for entries > 1 year old
- Monitor collection size and query performance
- Add date-based sharding if collection grows > 10M documents

## Security Considerations

### Authentication & Authorization

- All admin endpoints require `isAdmin` check
- No public access to ledger data
- Idempotency keys prevent duplicate operations
- MongoDB transactions prevent race conditions

### Data Privacy

- User email and name are enriched only for admin views
- CSV exports contain PII - restrict download to admins only
- Backup files contain sensitive data - secure storage required

### Audit Trail

- Every credit operation creates immutable ledger entry
- Idempotency keys enable duplicate detection
- Balance before/after enables verification

## Open Questions and Future Enhancements

### Open Questions

1. Should we archive old ledger entries to a separate collection?
2. What is the retention policy for credit transaction data?
3. Do we need additional aggregation queries for reporting?

### Future Enhancements

1. **Real-time Updates:** WebSocket-based live updates instead of polling
2. **Advanced Analytics:** Graphs and charts of credit usage over time
3. **Export Formats:** Add PDF and Excel export options
4. **Audit Alerts:** Notify admins of unusual credit activity
5. **Ledger Reconciliation:** Automated job to verify balance consistency
6. **Historical Data Migration:** Optional tool to migrate old transactions if needed

## Conclusion

This design provides a comprehensive migration path from the legacy single-entry credit transaction system to the new double-entry ledger system. The approach prioritizes safety through:

- Clean cutover without historical data migration
- Backward-compatible interfaces
- Comprehensive testing strategy
- Gradual refactoring with clear dependencies
- Rollback procedures for risk mitigation

The migration establishes the credit-service as the single authoritative source for all credit operations while providing enhanced visibility through the Admin Ledger Viewer.
