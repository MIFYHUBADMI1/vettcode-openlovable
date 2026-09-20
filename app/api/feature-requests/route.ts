import { getCurrentUser, requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, handleRouteError } from "@/lib/api/respond"
import { createFeatureRequest, listFeatureRequests } from "@/lib/feature-requests/service"
import { isFeatureRequestCategory, isFeatureRequestStatus, type FeatureRequestCategory, type FeatureRequestStatus } from "@/lib/feature-requests/config"
import type { ListSort } from "@/lib/feature-requests/service"

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    const url = new URL(req.url)
    const q = url.searchParams.get("q") ?? undefined
    const statusRaw = url.searchParams.get("status") ?? "all"
    const categoryRaw = url.searchParams.get("category") ?? "all"
    const sortRaw = url.searchParams.get("sort") ?? "popular"
    const page = Number(url.searchParams.get("page") || "1")
    const mine = url.searchParams.get("mine") === "1"
    const voted = url.searchParams.get("voted") === "1"
    const status = statusRaw === "all" || isFeatureRequestStatus(statusRaw) ? statusRaw : "all"
    const category = categoryRaw === "all" || isFeatureRequestCategory(categoryRaw) ? categoryRaw : "all"
    const sort: ListSort = ["popular", "recent", "updated", "trending"].includes(sortRaw)
      ? (sortRaw as ListSort)
      : "popular"
    const data = await listFeatureRequests({
      viewerId: user?.id,
      q,
      status: status as FeatureRequestStatus | "all",
      category: category as FeatureRequestCategory | "all",
      sort,
      page,
      mine,
      voted,
    })
    return ok(data)
  } catch (e) {
    return handleRouteError("api.feature-requests.list", e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    await checkRateLimit({ action: "feature-request-create", identifier: user.id, limit: 8, windowMs: 60 * 60 * 1000 })
    const body = await req.json().catch(() => ({})) as {
      title?: string
      description?: string
      whyItMatters?: string
      category?: string
      force?: boolean
    }
    const data = await createFeatureRequest({
      authorId: user.id,
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      whyItMatters: body.whyItMatters ? String(body.whyItMatters) : undefined,
      category: String(body.category ?? ""),
      force: Boolean(body.force),
    })
    return ok(data)
  } catch (e) {
    return handleRouteError("api.feature-requests.create", e)
  }
}
