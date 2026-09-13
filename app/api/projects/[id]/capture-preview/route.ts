import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { captureAppPreview } from "@/lib/screenshots/capture-app-preview"
import { ensureProtocol } from "@/lib/utils"

/**
 * POST /api/projects/:id/capture-preview
 * Manually trigger a screenshot capture of the built app URL.
 * Works for existing projects that were built before auto-capture was added.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    // Find the best URL to screenshot — prefer production, fall back to dev
    const latestDeploy = [...(project.deploymentHistory ?? [])]
      .reverse()
      .find(d => d.status === "success")

    const targetUrl =
      (latestDeploy?.productionUrl ? ensureProtocol(latestDeploy.productionUrl) : null) ??
      (project.developmentUrl ? ensureProtocol(project.developmentUrl) : null)

    if (!targetUrl) {
      return fail(
        "NO_URL",
        "This project has no live URL yet. Build or deploy it first.",
        400
      )
    }

    // Run synchronously so the client gets a real result (not fire-and-forget)
    await captureAppPreview(id, targetUrl)

    // Return the updated thumbnail
    const updated = await store.getProject(id)
    const thumbnailUrl = updated?.understanding?.screenshots?.[0] ?? null

    return ok({
      thumbnailUrl,
      message: thumbnailUrl
        ? "Preview screenshot captured successfully"
        : "Screenshot capture completed but no image was returned — the app URL may not be publicly accessible yet",
    })
  } catch (e) {
    return handleRouteError("api.projects.capture-preview", e)
  }
}
