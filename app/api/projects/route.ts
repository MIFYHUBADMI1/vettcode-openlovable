import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { runWebsiteAnalysis, runScratchAnalysis } from "@/lib/analysis/pipeline"
import { normalizeUrl } from "@/lib/integrations/firecrawl/service"
import type { MirrorProject, ProjectPreferences } from "@/lib/types/project"

export async function GET() {
  try {
    const user = await requireUser()
    const projects = await store.listProjects(user.id)
    // Return lightweight summaries for the list view.
    return ok({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        mode: p.mode,
        state: p.state,
        sourceUrl: p.sourceUrl,
        updatedAt: p.updatedAt,
      })),
    })
  } catch (e) {
    return handleRouteError("api.projects.list", e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as { mode?: string; url?: string; idea?: string; preferences?: ProjectPreferences }
    const mode = body.mode === "scratch" ? "scratch" : "website"

    if (mode === "website") {
      if (!body.url || typeof body.url !== "string") return fail("VALIDATION", "A website URL is required.", 422)
      let sourceUrl: string
      try {
        sourceUrl = normalizeUrl(body.url)
      } catch {
        return fail("VALIDATION", "Please enter a valid website URL.", 422)
      }
      const preferences = body.preferences as ProjectPreferences | undefined
      const projectName = preferences?.appName || new URL(sourceUrl).host
      const project = newProject(user.id, { mode, sourceUrl, name: projectName, preferences })
      await store.createProject(project)
      // Fire-and-forget analysis; client polls status.
      void runWebsiteAnalysis(project.id)
      return ok({ project }, { status: 201 })
    }

    // scratch mode
    const idea = (body.idea ?? "").trim()
    if (idea.length < 8) return fail("VALIDATION", "Please describe your app idea in a bit more detail.", 422)
    const preferences = body.preferences as ProjectPreferences | undefined
    const projectName = preferences?.appName || "New app"
    const project = newProject(user.id, { mode, idea, name: projectName, preferences })
    await store.createProject(project)
    void runScratchAnalysis(project.id)
    return ok({ project }, { status: 201 })
  } catch (e) {
    return handleRouteError("api.projects.create", e)
  }
}

function newProject(
  userId: string,
  partial: Partial<MirrorProject> & Pick<MirrorProject, "mode" | "name">,
): MirrorProject {
  const now = Date.now()
  return {
    id: cryptoId(),
    userId,
    mode: partial.mode,
    name: partial.name,
    state: "created",
    sourceUrl: partial.sourceUrl,
    idea: partial.idea,
    preferences: partial.preferences,
    events: [{ id: cryptoId(), at: now, level: "info", stage: "create", message: "Project created" }],
    conversation: [],
    deployment: { id: cryptoId(), status: "idle", updatedAt: now },
    deploymentHistory: [],
    createdAt: now,
    updatedAt: now,
  }
}
