import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { singleFlight } from "@/lib/cache/single-flight"
import { resolveProjectThumbnail } from "@/lib/media/project-thumbnail"

/**
 * GET /api/public/projects/:id
 * View a public project (no authentication required).
 * Returns limited project information for public viewing.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Use single-flight to handle multiple concurrent requests for popular projects
    const fetcher = singleFlight<Response>(`api.public.projects.get:${id}`)
    return fetcher(async () => {
      const project = await store.getProject(id)
      
      if (!project) {
        return fail("PROJECT_NOT_FOUND", "This project doesn't exist.", 404)
      }
      
      // Check if project is public
      if (project.visibility !== "public") {
        return fail("PROJECT_PRIVATE", "This project is private.", 403)
      }
      
      // Check if project has been deployed
      const deployment = project.deploymentHistory?.find(d => d.status === "success")
      if (!deployment) {
        return fail("PROJECT_NOT_DEPLOYED", "This project hasn't been deployed yet.", 404)
      }
      
      // Return limited public information
      return ok({
        project: {
          id: project.id,
          name: project.name,
          mode: project.mode,
          state: project.state,
          sourceUrl: project.sourceUrl,
          productionUrl: deployment.productionUrl,
          customDomain: deployment.customDomain,
          thumbnailUrl: resolveProjectThumbnail(project.understanding?.screenshots),
          purpose: project.understanding?.purpose ?? null,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }
      })
    })
  } catch (e) {
    return handleRouteError("api.public.projects.get", e)
  }
}
