import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { getSecrets, createSecret, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * GET /api/projects/:id/secrets
 * Lists all secret keys for the project (values are never returned by Totalum).
 * Also surfaces secretKeysNeeded from the buildSummary so the UI can show
 * which keys are required but missing.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id)
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)

    if (!project.totalumProjectId)
      return fail("NOT_BUILT", "This project hasn't been built yet.", 400)

    if (!isTotalumConfigured())
      return fail("PROVIDER_NOT_CONFIGURED", "Build service not connected.", 503)

    const { secrets } = await getSecrets(project.totalumProjectId)

    // Surface required keys from the AI build summary
    const requiredKeys = project.buildSummary?.secretKeysNeeded ?? {}

    return ok({
      secrets: secrets.map(s => ({
        id: s._id,
        name: s.secretName,
        environment: s.environment ?? "production",
        createdAt: s.createdAt,
      })),
      requiredKeys, // { KEY_NAME: { isProvided: boolean, description: string } }
    })
  } catch (e) {
    return handleRouteError("api.projects.secrets.list", e)
  }
}

/**
 * POST /api/projects/:id/secrets
 * Creates or updates a secret (env var) for the project.
 * Body: { name: string, value: string, environment?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id)
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)

    if (!project.totalumProjectId)
      return fail("NOT_BUILT", "This project hasn't been built yet.", 400)

    if (!isTotalumConfigured())
      return fail("PROVIDER_NOT_CONFIGURED", "Build service not connected.", 503)

    const body = await req.json().catch(() => ({})) as {
      name?: string
      value?: string
      environment?: string
    }

    if (!body.name || typeof body.name !== "string" || !body.name.trim())
      return fail("VALIDATION", "Secret name is required.", 422)
    if (!body.value || typeof body.value !== "string")
      return fail("VALIDATION", "Secret value is required.", 422)

    // Validate key name — only uppercase letters, digits, underscores
    const name = body.name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")

    const secret = await createSecret(project.totalumProjectId, {
      secretName: name,
      secretValue: body.value,
      environment: body.environment ?? "production",
    })

    return ok({
      secret: {
        id: secret._id,
        name: secret.secretName,
        environment: secret.environment ?? "production",
        createdAt: secret.createdAt,
      },
    }, { status: 201 })
  } catch (e) {
    return handleRouteError("api.projects.secrets.create", e)
  }
}
