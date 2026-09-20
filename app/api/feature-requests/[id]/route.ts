import { getCurrentUser } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { getFeatureRequest } from "@/lib/feature-requests/service"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const data = await getFeatureRequest(id, user?.id)
    return ok(data)
  } catch (e) {
    return handleRouteError("api.feature-requests.get", e)
  }
}
