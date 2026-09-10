import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  getSecrets,
  createSecret,
  deleteSecret,
  isTotalumConfigured,
} from "@/lib/integrations/totalum/service"
import type { ProjectEvent } from "@/lib/types/project"
import { cryptoId } from "@/lib/store/store"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/** GET /api/projects/:id/secrets — list secrets (names only, values never returned). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Build service is not connected.", 503)

    const result = await getSecrets(project.totalumProjectId)
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.secrets.list", e)
  }
}

/** POST /api/projects/:id/secrets — create a secret. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Build service is not connected.", 503)

    const body = (await req.json().catch(() => ({}))) as { secretName?: string; secretValue?: string; environment?: string }
    if (!body.secretName || !body.secretValue) return fail("MISSING_SECRET_FIELDS", "secretName and secretValue are required.", 422)

    const result = await createSecret(project.totalumProjectId, {
      secretName: body.secretName,
      secretValue: body.secretValue,
      environment: body.environment,
    })

    await store.appendEvent(id, event("secret", `Secret created: ${body.secretName}`))
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.secrets.create", e)
  }
}

/** DELETE /api/projects/:id/secrets?id=secretId — remove a secret. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Build service is not connected.", 503)

    const url = new URL(req.url)
    const secretId = url.searchParams.get("id")
    if (!secretId) return fail("MISSING_SECRET_ID", "Secret ID is required.", 422)

    const result = await deleteSecret(project.totalumProjectId, secretId)
    await store.appendEvent(id, event("secret", `Secret removed`))
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.secrets.delete", e)
  }
}
