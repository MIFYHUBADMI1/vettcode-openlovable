import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { projectGitHubCol, usersCol } from "@/lib/db/collections"
import { getRepo, GitHubApiError } from "@/lib/integrations/github/client"
import { pushProjectToGitHub } from "@/lib/integrations/github/push"
import { ObjectId } from "mongodb"

/**
 * GET /api/projects/:id/github
 * Returns the current GitHub integration for a project.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)

    const col    = await projectGitHubCol()
    const github = await col.findOne({ projectId: id })

    if (!github) return ok({ connected: false })

    return ok({
      connected:   true,
      mode:        github.mode,
      repoOwner:   github.repoOwner,
      repoName:    github.repoName,
      branch:      github.branch,
      lastPushedAt: github.lastPushedAt ?? null,
      lastPushedSha: github.lastPushedSha ?? null,
      pushStatus:  github.pushStatus ?? null,
      pushError:   github.pushError ?? null,
    })
  } catch (e) {
    return handleRouteError("api.projects.github.get", e)
  }
}

/**
 * POST /api/projects/:id/github
 * Connects a GitHub repo to this project.
 * Body: { mode: "push"|"build-from", repoOwner, repoName, branch? }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)

    // Get user's GitHub token
    const userDoc = await (await usersCol()).findOne({ id: user.id })
    if (!userDoc?.githubAccessToken) {
      return fail("GITHUB_AUTH_REQUIRED", "Connect your GitHub account first via Sign in with GitHub.", 401)
    }

    const body = await req.json().catch(() => ({})) as {
      mode?: "push" | "build-from"
      repoOwner?: string
      repoName?: string
      branch?: string
    }

    if (!body.mode || !["push", "build-from"].includes(body.mode))
      return fail("VALIDATION", "mode must be 'push' or 'build-from'.", 422)
    if (!body.repoOwner?.trim() || !body.repoName?.trim())
      return fail("VALIDATION", "repoOwner and repoName are required.", 422)

    // Verify access to the repo
    try {
      const repo = await getRepo(userDoc.githubAccessToken, body.repoOwner, body.repoName)
      if (body.mode === "push" && !repo.permissions?.push) {
        return fail("GITHUB_NO_PUSH_ACCESS", "You don't have push access to this repository.", 403)
      }
    } catch (e) {
      if (e instanceof GitHubApiError && e.status === 404)
        return fail("GITHUB_REPO_NOT_FOUND", "Repository not found or you don't have access.", 404)
      throw e
    }

    const branch = body.branch?.trim() || "main"
    const now    = Date.now()
    const col    = await projectGitHubCol()

    // Upsert the integration doc
    await col.updateOne(
      { projectId: id },
      {
        $set: {
          projectId:  id,
          userId:     user.id,
          mode:       body.mode,
          repoOwner:  body.repoOwner.trim(),
          repoName:   body.repoName.trim(),
          branch,
          updatedAt:  now,
        },
        $setOnInsert: {
          _id:       new ObjectId(),
          id:        cryptoId(),
          createdAt: now,
        },
      },
      { upsert: true },
    )

    // If push mode and project is built, do initial push fire-and-forget
    if (body.mode === "push" && project.totalumProjectId) {
      void pushProjectToGitHub({
        projectId:       id,
        totalumProjectId: project.totalumProjectId,
        accessToken:     userDoc.githubAccessToken,
        repoOwner:       body.repoOwner.trim(),
        repoName:        body.repoName.trim(),
        branch,
        commitMessage:   `chore: initial sync from MirrorSite AI — ${project.name}`,
      }).catch(err => console.error("[github] initial push failed", err))
    }

    return ok({ connected: true, mode: body.mode, repoOwner: body.repoOwner, repoName: body.repoName, branch })
  } catch (e) {
    if (e instanceof GitHubApiError) return fail("GITHUB_API_ERROR", e.message, 502)
    return handleRouteError("api.projects.github.connect", e)
  }
}

/**
 * DELETE /api/projects/:id/github
 * Disconnects the GitHub integration for a project.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)

    const col = await projectGitHubCol()
    await col.deleteOne({ projectId: id })
    return ok({ disconnected: true })
  } catch (e) {
    return handleRouteError("api.projects.github.disconnect", e)
  }
}
