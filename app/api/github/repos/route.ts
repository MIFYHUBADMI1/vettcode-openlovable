import { requireUser } from "@/lib/auth/session"
import { usersCol } from "@/lib/db/collections"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { listUserRepos, createRepo, GitHubApiError } from "@/lib/integrations/github/client"

/**
 * GET /api/github/repos
 * Returns the authenticated user's GitHub repositories.
 * Requires the user to have a githubAccessToken on their account.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const col  = await usersCol()
    const doc  = await col.findOne({ id: user.id })

    if (!doc?.githubAccessToken) {
      return fail("GITHUB_AUTH_REQUIRED", "Connect your GitHub account first.", 401)
    }

    const url  = new URL(req.url)
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const repos = await listUserRepos(doc.githubAccessToken, page)

    return ok({
      repos: repos.map(r => ({
        id:            r.id,
        fullName:      r.full_name,
        name:          r.name,
        owner:         r.owner.login,
        defaultBranch: r.default_branch,
        private:       r.private,
        canPush:       r.permissions?.push ?? false,
      })),
    })
  } catch (e) {
    if (e instanceof GitHubApiError) return fail("GITHUB_API_ERROR", e.message, 502)
    return handleRouteError("api.github.repos", e)
  }
}

/**
 * POST /api/github/repos
 * Creates a new GitHub repository for the authenticated user.
 * Body: { name: string, private?: boolean }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const col  = await usersCol()
    const doc  = await col.findOne({ id: user.id })

    if (!doc?.githubAccessToken) {
      return fail("GITHUB_AUTH_REQUIRED", "Connect your GitHub account first.", 401)
    }

    const body = await req.json().catch(() => ({})) as { name?: string; private?: boolean }
    if (!body.name?.trim()) return fail("VALIDATION", "Repository name is required.", 422)

    const repo = await createRepo(doc.githubAccessToken, body.name.trim(), body.private ?? true)
    return ok({
      repo: {
        id:            repo.id,
        fullName:      repo.full_name,
        name:          repo.name,
        owner:         repo.owner.login,
        defaultBranch: repo.default_branch,
        private:       repo.private,
      },
    }, { status: 201 })
  } catch (e) {
    if (e instanceof GitHubApiError) return fail("GITHUB_API_ERROR", e.message, 502)
    return handleRouteError("api.github.repos.create", e)
  }
}
