import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { adminGet, adminPatch } from "@/lib/feature-requests/service"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    return ok(await adminGet(id))
  } catch (e) {
    return handleRouteError("api.admin.feature-requests.get", e)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const data = await adminPatch(id, admin.id, {
      status: typeof body.status === "string" ? body.status : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      canonicalRequestId: typeof body.canonicalRequestId === "string" ? body.canonicalRequestId : undefined,
      hidden: typeof body.hidden === "boolean" ? body.hidden : undefined,
      releaseNote: typeof body.releaseNote === "string" ? body.releaseNote : undefined,
      releaseLink: typeof body.releaseLink === "string" ? body.releaseLink : undefined,
      internalNote: typeof body.internalNote === "string" ? body.internalNote : undefined,
      publicUpdate: typeof body.publicUpdate === "string" ? body.publicUpdate : undefined,
    })
    return ok(data)
  } catch (e) {
    return handleRouteError("api.admin.feature-requests.patch", e)
  }
}
