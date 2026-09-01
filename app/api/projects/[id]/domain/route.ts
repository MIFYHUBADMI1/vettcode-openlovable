import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { addCustomDomain, removeCustomDomain, isTotalumConfigured, getDeploymentStatus } from "@/lib/integrations/totalum/service"
import type { ProjectEvent } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * PUT /api/projects/:id/domain
 * Add a custom domain to a deployed project.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)

    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Deployment service is not connected.", 503)

    const body = (await req.json().catch(() => ({}))) as { hostname?: string }
    if (!body.hostname) return fail("VALIDATION", "A hostname is required (e.g. app.yourdomain.com).", 422)

    // Validate hostname format
    const hostname = body.hostname.trim().toLowerCase()
    if (!hostname.includes(".") || hostname.startsWith("http")) {
      return fail("VALIDATION", "Enter a valid hostname like app.yourdomain.com", 422)
    }

    // Check deployment exists
    try {
      const deployStatus = await getDeploymentStatus(project.totalumProjectId)
      if (deployStatus.status !== "success") {
        return fail("NO_DEPLOYMENT", "You must deploy your project first before adding a custom domain.", 400)
      }
    } catch {
      return fail("NO_DEPLOYMENT", "Could not verify deployment status. Deploy first.", 400)
    }

    // Add custom domain via Totalum
    try {
      const result = await addCustomDomain(project.totalumProjectId, { hostname })

      await store.appendEvent(id, event("domain", `Custom domain added: ${hostname}`))

      return ok({
        message: "Custom domain added. Configure your DNS records, then wait for activation.",
        hostname: result.hostname,
        status: result.status,
        dnsRecordsToAdd: result.dnsRecordsToAdd,
      })
    } catch (providerError) {
      const msg = providerError instanceof Error ? providerError.message : "Failed to add custom domain"
      if (msg.includes("NO_DEPLOYMENT")) {
        return fail("NO_DEPLOYMENT", "You must deploy your project first before adding a custom domain.", 400)
      }
      throw providerError
    }
  } catch (e) {
    return handleRouteError("api.projects.domain.add", e)
  }
}

/**
 * DELETE /api/projects/:id/domain
 * Remove the custom domain from a project.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)

    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Deployment service is not connected.", 503)

    const result = await removeCustomDomain(project.totalumProjectId)

    await store.appendEvent(id, event("domain", "Custom domain removed"))

    return ok({ message: result.message })
  } catch (e) {
    return handleRouteError("api.projects.domain.remove", e)
  }
}
