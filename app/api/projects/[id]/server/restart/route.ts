import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { startOrRestartServer, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import type { ProjectEvent } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/** POST /api/projects/:id/server/restart — restart the dev server. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (project.state === "building" || project.state === "deploying") return fail("BUSY", "Please wait for the current operation to finish.", 409)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Build service is not connected.", 503)

    const result = await startOrRestartServer(project.totalumProjectId)
    await store.appendEvent(id, event("server", "Development server restart initiated"))
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.server.restart", e)
  }
}
