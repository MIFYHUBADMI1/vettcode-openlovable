import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { adminList, adminStats } from "@/lib/feature-requests/service"
import { isFeatureRequestCategory, isFeatureRequestStatus, type FeatureRequestCategory, type FeatureRequestStatus } from "@/lib/feature-requests/config"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    if (url.searchParams.get("stats") === "1") {
      return ok(await adminStats())
    }
    const q = url.searchParams.get("q") ?? undefined
    const statusRaw = url.searchParams.get("status") ?? "needs_review"
    const categoryRaw = url.searchParams.get("category") ?? "all"
    const sortRaw = url.searchParams.get("sort") ?? "popular"
    const page = Number(url.searchParams.get("page") || "1")
    const status =
      statusRaw === "all" || statusRaw === "needs_review" || isFeatureRequestStatus(statusRaw)
        ? statusRaw
        : "needs_review"
    const category = categoryRaw === "all" || isFeatureRequestCategory(categoryRaw) ? categoryRaw : "all"
    const sort = ["popular", "recent", "updated", "oldest", "trending"].includes(sortRaw)
      ? (sortRaw as "popular" | "recent" | "updated" | "oldest")
      : "popular"
    const data = await adminList({
      q,
      status: status as FeatureRequestStatus | "all" | "needs_review",
      category: category as FeatureRequestCategory | "all",
      sort,
      page,
    })
    return ok(data)
  } catch (e) {
    return handleRouteError("api.admin.feature-requests.list", e)
  }
}
