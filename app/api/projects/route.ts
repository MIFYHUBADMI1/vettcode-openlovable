import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { runWebsiteAnalysis, runScratchAnalysis, runDeepCrawlAnalysis } from "@/lib/analysis/pipeline"
import { runGitHubAnalysis } from "@/lib/analysis/github-pipeline"
import { normalizeUrl } from "@/lib/integrations/firecrawl/service"
import type { MirrorProject, ProjectPreferences } from "@/lib/types/project"
import { singleFlight } from "@/lib/cache/single-flight"

/**
 * Returns the list of projects for the authenticated user.
 *
 * Single-flight deduplication prevents thundering herds when many SWR clients
 * revalidate simultaneously.
 */
export async function GET() {
  try {
    const user = await requireUser()

    const fetcher = singleFlight<Response>(`api.projects:${user.id}`)
    return fetcher(async () => {
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
          thumbnailUrl: p.understanding?.screenshots?.[0] ?? null,
        })),
      })
    })
  } catch (e) {
    return handleRouteError("api.projects.list", e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()

    // Rate-limit project creation: 10 new projects per hour per user.
    await checkRateLimit({
      action: "project_create",
      identifier: user.id,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })

    const body = (await req.json().catch(() => ({}))) as {
      mode?: string;
      url?: string;
      idea?: string;
      crawlMode?: string;
      preferences?: ProjectPreferences;
      pipelineMode?: "legacy" | "heavy";
      githubRepoOwner?: string;
      githubRepoName?: string;
      githubBranch?: string;
      githubSubMode?: "clone" | "extend";
      userRequest?: string;
    }
    const mode = body.mode === "scratch" ? "scratch" : body.mode === "github" ? "github" : "website"
    const crawlMode = body.crawlMode === "deep" ? "deep" : "relevant"
    const pipelineMode = body.pipelineMode ?? "legacy"

    if (mode === "github") {
      if (!body.githubRepoOwner || !body.githubRepoName)
        return fail("VALIDATION", "GitHub repo owner and name are required.", 422)

      const githubSubMode = body.githubSubMode || "clone"
      if (githubSubMode === "extend" && (!body.userRequest || body.userRequest.trim().length === 0)) {
        return fail("VALIDATION", "Extend mode requires a description of what you want to add or change.", 422)
      }

      const preferences = body.preferences as ProjectPreferences | undefined
      const projectName = preferences?.appName || `${body.githubRepoOwner}/${body.githubRepoName}`
      const project = newProject(user.id, { mode, name: projectName, preferences, pipelineMode })
      await store.createProject(project)
      // Store GitHub connection doc
      const { projectGitHubCol } = await import("@/lib/db/collections")
      const { cryptoId: cid } = await import("@/lib/store/store")
      const { ObjectId } = await import("mongodb")
      const ghCol = await projectGitHubCol()
      await ghCol.insertOne({
        _id: new ObjectId(),
        id: cid(),
        projectId: project.id,
        userId: user.id,
        mode: "build-from",
        githubSubMode,
        userRequest: githubSubMode === "extend" ? body.userRequest?.trim() : undefined,
        repoOwner: body.githubRepoOwner,
        repoName: body.githubRepoName,
        branch: body.githubBranch || "main",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      void runGitHubAnalysis(project.id)
      return ok({ project }, { status: 201 })
    }

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
      const project = newProject(user.id, { mode, sourceUrl, name: projectName, preferences, crawlMode, pipelineMode })
      await store.createProject(project)
      // Fire-and-forget analysis; client polls status.
      if (crawlMode === "deep") {
        void runDeepCrawlAnalysis(project.id, pipelineMode)
      } else {
        void runWebsiteAnalysis(project.id, pipelineMode)
      }
      return ok({ project }, { status: 201 })
    }

    // scratch mode
    const idea = (body.idea ?? "").trim()
    if (idea.length < 8) return fail("VALIDATION", "Please describe your app idea in a bit more detail.", 422)
    const preferences = body.preferences as ProjectPreferences | undefined
    const projectName = preferences?.appName || "New app"
    const project = newProject(user.id, { mode, idea, name: projectName, preferences, pipelineMode })
    await store.createProject(project)
    void runScratchAnalysis(project.id, pipelineMode)
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
    crawlMode: partial.crawlMode as import("@/lib/types/project").CrawlMode | undefined,
    pipelineMode: partial.pipelineMode as import("@/lib/types/project").UserPipelineMode | undefined,
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
