import { creditLedgerCol } from "@/lib/db/collections"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { usersCol } from "@/lib/db/collections"

interface QueryParams {
  userId?: string
  creditType?: "subscription" | "permanent"
  transactionType?: string
  direction?: "credit" | "debit"
  startDate?: number
  endDate?: number
  page: number
  limit: 25 | 50 | 100 | 200
  sortBy: string
  sortOrder: "asc" | "desc"
}

/**
 * Parse and validate query parameters from the request URL.
 * 
 * @requirements 2.4-2.12
 */
function parseQueryParams(searchParams: URLSearchParams): QueryParams {
  // Page (default 1)
  const pageStr = searchParams.get("page")
  const page = pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1

  // Limit (default 50, valid values: 25, 50, 100, 200)
  const limitStr = searchParams.get("limit")
  const limitNum = limitStr ? parseInt(limitStr, 10) : 50
  const limit = [25, 50, 100, 200].includes(limitNum) ? (limitNum as 25 | 50 | 100 | 200) : 50

  // Sort parameters
  const sortBy = searchParams.get("sortBy") || "createdAt"
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc"

  const params: QueryParams = {
    page,
    limit,
    sortBy,
    sortOrder,
  }

  // Optional filters
  const userId = searchParams.get("userId")
  if (userId) params.userId = userId

  const creditType = searchParams.get("creditType")
  if (creditType === "subscription" || creditType === "permanent") {
    params.creditType = creditType
  }

  const transactionType = searchParams.get("transactionType")
  if (transactionType) params.transactionType = transactionType

  const direction = searchParams.get("direction")
  if (direction === "credit" || direction === "debit") {
    params.direction = direction
  }

  const startDate = searchParams.get("startDate")
  if (startDate) {
    const num = parseInt(startDate, 10)
    if (!isNaN(num)) params.startDate = num
  }

  const endDate = searchParams.get("endDate")
  if (endDate) {
    const num = parseInt(endDate, 10)
    if (!isNaN(num)) params.endDate = num
  }

  return params
}

/**
 * Admin Ledger Viewer API endpoint.
 * Returns paginated, filtered ledger entries with summary statistics.
 * 
 * @requirements 2.1, 2.2, 2.3
 */
export async function GET(request: NextRequest) {
  try {
    // Requirement 2.2, 2.3: Admin authentication check
    await requireAdmin()

    // Requirement 2.4-2.11: Parse and validate query parameters
    const params = parseQueryParams(request.nextUrl.searchParams)

    // Requirement 2.13: Build MongoDB filter from query parameters
    const filter = buildLedgerFilter(params)

    // Requirement 2.14: Build sort criteria
    const sort = buildSortCriteria(params.sortBy, params.sortOrder)

    // Requirement 2.13, 2.15: Execute paginated query
    const col = await creditLedgerCol()
    const totalEntries = await col.countDocuments(filter)
    const skip = (params.page - 1) * params.limit

    const entries = await col
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(params.limit)
      .toArray()

    // Requirement 2.16: Enrich with user data
    const enrichedEntries = await enrichWithUserData(entries)

    // Requirement 2.17: Calculate summary statistics
    const summary = await calculateSummary(filter)

    // Requirement 2.18: Return JSON response
    const totalPages = Math.ceil(totalEntries / params.limit)

    return NextResponse.json({
      entries: enrichedEntries,
      pagination: {
        currentPage: params.page,
        pageSize: params.limit,
        totalEntries,
        totalPages,
      },
      summary,
    })
  } catch (error: unknown) {
    console.error("Error fetching ledger entries:", error)

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Build MongoDB filter object from query parameters.
 * 
 * @requirements 2.4-2.9, 2.13
 */
function buildLedgerFilter(params: QueryParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {}

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

  // Date range filter
  if (params.startDate || params.endDate) {
    filter.createdAt = {}
    if (params.startDate) {
      (filter.createdAt as Record<string, unknown>).$gte = params.startDate
    }
    if (params.endDate) {
      (filter.createdAt as Record<string, unknown>).$lte = params.endDate
    }
  }

  return filter
}

/**
 * Build MongoDB sort criteria from sortBy and sortOrder parameters.
 * 
 * @requirements 2.14
 */
function buildSortCriteria(sortBy: string, sortOrder: "asc" | "desc"): [string, 1 | -1] {
  const order = sortOrder === "asc" ? 1 : -1 as const
  const field = sortBy || "createdAt"
  return [field, order]
}

/**
 * Enrich ledger entries with user name and email from the users collection.
 * Uses batch fetching for efficiency.
 * 
 * @requirements 2.16
 */
async function enrichWithUserData(
  entries: Array<{
    _id?: unknown
    userId: string
    creditType: string
    amount: number
    direction: string
    transactionType: string
    balanceBefore: number
    balanceAfter: number
    referenceType?: string
    referenceId?: string
    metadata?: Record<string, unknown>
    idempotencyKey: string
    createdAt: number
  }>
) {
  if (entries.length === 0) return []

  // Extract unique user IDs
  const uniqueUserIds = Array.from(new Set(entries.map((e) => e.userId)))

  // Batch fetch users
  const users = await usersCol()
  const userDocs = await users
    .find({ id: { $in: uniqueUserIds } })
    .project({ id: 1, name: 1, email: 1 })
    .toArray()

  // Create user map for efficient lookups
  const userMap = new Map(userDocs.map((u) => [u.id, { name: u.name, email: u.email }]))

  // Enrich entries
  return entries.map((entry) => {
    const user = userMap.get(entry.userId)
    return {
      id: entry._id?.toString() || "",
      userId: entry.userId,
      userName: user?.name || "Unknown User",
      userEmail: user?.email || "unknown@example.com",
      creditType: entry.creditType,
      amount: entry.amount,
      direction: entry.direction,
      transactionType: entry.transactionType,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      reason: entry.metadata?.reason as string | undefined,
      idempotencyKey: entry.idempotencyKey,
      createdAt: entry.createdAt,
    }
  })
}

/**
 * Calculate summary statistics for the filtered ledger entries.
 * 
 * @requirements 2.17, 2.20
 */
async function calculateSummary(filter: Record<string, unknown>) {
  const col = await creditLedgerCol()

  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalCreditsGranted: {
          $sum: {
            $cond: [{ $eq: ["$direction", "credit"] }, "$amount", 0],
          },
        },
        totalDebitsCharged: {
          $sum: {
            $cond: [{ $eq: ["$direction", "debit"] }, "$amount", 0],
          },
        },
      },
    },
  ]

  const result = await col.aggregate(pipeline).toArray()

  if (result.length === 0) {
    return {
      totalEntries: 0,
      totalCreditsGranted: 0,
      totalDebitsCharged: 0,
    }
  }

  return {
    totalEntries: result[0].totalEntries,
    totalCreditsGranted: result[0].totalCreditsGranted,
    totalDebitsCharged: result[0].totalDebitsCharged,
  }
}

