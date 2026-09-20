import { store, cryptoId } from "@/lib/store/store"
import { fail } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { runWebsiteAnalysis, runScratchAnalysis, runDeepCrawlAnalysis } from "@/lib/analysis/pipeline"
import { runGitHubAnalysis } from "@/lib/analysis/github-pipeline"
import { normalizeUrl } from "@/lib/integrations/firecrawl/service"
import type { MirrorProject, ProjectPreferences, UserPipelineMode } from "@/lib/types/project"

export type CreateProjectInput = {
  mode?: string
  url?: string
  idea?: string
  crawlMode?: string
  preferences?: ProjectPreferences
  pipelineMode?: UserPipelineMode
  githubRepoOwner?: string
  githubRepoName?: string
  githubBranch?: string
  githubSubMode?: "clone" | "extend"
  userRequest?: string
  idempotencyKey?: string
  skipAnalysis?: boolean
}

const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000

function titleFromIntent(text: string | undefined, fallback: string): string {
  const cleaned = (text ?? "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (cleaned.length < 8) return fallback
  const words = cleaned.split(" ").slice(0, 6).join(" ")
  const titled = words.replace(/\b\w/g, (c) => c.toUpperCase())
  return titled.length > 60 ? `${titled.slice(0, 57)}…` : titled
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
    crawlMode: partial.crawlMode,
    pipelineMode: partial.pipelineMode,
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

async function findRecentDuplicate(userId: string, match: { idea?: string; sourceUrl?: string; github?: string }) {
  const projects = await store.listProjects(userId, 20)
  const cutoff = Date.now() - IDEMPOTENCY_WINDOW_MS
  return projects.find((p) => {
    if (p.createdAt < cutoff) return false
    if (match.sourceUrl && p.sourceUrl === match.sourceUrl) return true
    if (match.idea && p.idea && p.idea.trim() === match.idea.trim()) return true
    if (match.github && p.name === match.github) return true
    return false
  })
}

export async function createUserProject(userId: string, body: CreateProjectInput) {
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim().slice(0, 80) : ""
  if (idempotencyKey) {
    const { findCreateIdempotency } = await import("@/lib/start/pending-store")
    const existingKey = await findCreateIdempotency(userId, idempotencyKey)
    if (existingKey?.projectId) {
      const existingProject = await store.getProject(existingKey.projectId)
      if (existingProject && existingProject.userId === userId) {
        return { project: existingProject, reused: true }
      }
    }
  }

  await checkRateLimit({
    action: "project_create",
    identifier: userId,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })

  const mode = body.mode === "scratch" ? "scratch" : body.mode === "github" ? "github" : "website"
  const crawlMode = body.crawlMode === "deep" ? "deep" : "relevant"
  const pipelineMode: UserPipelineMode = body.pipelineMode === "heavy" ? "heavy" : body.pipelineMode === "legacy" ? "legacy" : "heavy"
  const originalIntent = (body.idea ?? body.userRequest ?? "").trim() || undefined

  if (mode === "github") {
    if (!body.githubRepoOwner || !body.githubRepoName) {
      return { error: fail("VALIDATION", "GitHub repo owner and name are required.", 422) }
    }
    const githubSubMode = body.githubSubMode || "clone"
    if (githubSubMode === "extend" && (!body.userRequest || body.userRequest.trim().length === 0)) {
      return { error: fail("VALIDATION", "Extend mode requires a description of what you want to add or change.", 422) }
    }
    const repoLabel = `${body.githubRepoOwner}/${body.githubRepoName}`
    const existing = await findRecentDuplicate(userId, { github: repoLabel, idea: originalIntent })
    if (existing) return { project: existing, reused: true }

    const preferences = body.preferences
    const projectName = preferences?.appName || titleFromIntent(originalIntent, repoLabel)
    const project = newProject(userId, {
      mode,
      name: projectName,
      preferences,
      pipelineMode,
      idea: originalIntent,
    })
    await store.createProject(project)
    if (idempotencyKey) {
      const { saveCreateIdempotency } = await import("@/lib/start/pending-store")
      const saved = await saveCreateIdempotency(userId, idempotencyKey, project.id)
      if (!saved) {
        const { findCreateIdempotency } = await import("@/lib/start/pending-store")
        const raced = await findCreateIdempotency(userId, idempotencyKey)
        if (raced?.projectId && raced.projectId !== project.id) {
          const winner = await store.getProject(raced.projectId)
          if (winner) return { project: winner, reused: true }
        }
      }
    }
    const { projectGitHubCol } = await import("@/lib/db/collections")
    const { cryptoId: cid } = await import("@/lib/store/store")
    const { ObjectId } = await import("mongodb")
    const ghCol = await projectGitHubCol()
    await ghCol.insertOne({
      _id: new ObjectId(),
      id: cid(),
      projectId: project.id,
      userId,
      mode: "build-from",
      githubSubMode,
      userRequest: githubSubMode === "extend" ? body.userRequest?.trim() : originalIntent,
      repoOwner: body.githubRepoOwner,
      repoName: body.githubRepoName,
      branch: body.githubBranch || "main",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    if (!body.skipAnalysis) void runGitHubAnalysis(project.id)
    return { project, reused: false }
  }

  if (mode === "website") {
    if (!body.url || typeof body.url !== "string") {
      return { error: fail("VALIDATION", "A website URL is required.", 422) }
    }
    let sourceUrl: string
    try {
      sourceUrl = normalizeUrl(body.url)
    } catch {
      return { error: fail("VALIDATION", "Please enter a valid website URL.", 422) }
    }
    const existing = await findRecentDuplicate(userId, { sourceUrl, idea: originalIntent })
    if (existing) return { project: existing, reused: true }

    const preferences = body.preferences
    const host = new URL(sourceUrl).host
    const projectName = preferences?.appName || titleFromIntent(originalIntent, host)
    const project = newProject(userId, {
      mode,
      sourceUrl,
      name: projectName,
      preferences,
      crawlMode,
      pipelineMode,
      idea: originalIntent,
    })
    await store.createProject(project)
    if (idempotencyKey) {
      const { saveCreateIdempotency } = await import("@/lib/start/pending-store")
      await saveCreateIdempotency(userId, idempotencyKey, project.id)
    }
    if (!body.skipAnalysis) {
      if (crawlMode === "deep") {
        void runDeepCrawlAnalysis(project.id, pipelineMode)
      } else {
        void runWebsiteAnalysis(project.id, pipelineMode)
      }
    }
    return { project, reused: false }
  }

  const idea = (body.idea ?? "").trim()
  if (idea.length < 8) {
    return { error: fail("VALIDATION", "Please describe your app idea in a bit more detail.", 422) }
  }
  const existing = await findRecentDuplicate(userId, { idea })
  if (existing) return { project: existing, reused: true }

  const preferences = body.preferences
  const projectName = preferences?.appName || titleFromIntent(idea, "New app")
  const project = newProject(userId, { mode, idea, name: projectName, preferences, pipelineMode })
  await store.createProject(project)
  if (idempotencyKey) {
    const { saveCreateIdempotency } = await import("@/lib/start/pending-store")
    await saveCreateIdempotency(userId, idempotencyKey, project.id)
  }
  if (!body.skipAnalysis) void runScratchAnalysis(project.id, pipelineMode)
  return { project, reused: false }
}
