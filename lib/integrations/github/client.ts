/**
 * GitHub REST API v3 client.
 * accessToken is optional — omitting it makes unauthenticated requests
 * which work for public repos (60 req/hr rate limit vs 5,000 with a token).
 * Values returned from the API are treated as untrusted input.
 */

const API_BASE = "https://api.github.com"

export class GitHubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "GitHubApiError"
  }
}

async function ghFetch<T>(
  method: string,
  path: string,
  accessToken: string | null | undefined,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new GitHubApiError(res.status, `GitHub API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

// ─── Repo types ──────────────────────────────────────────────────────────────

export interface GitHubRepo {
  id: number
  full_name: string
  name: string
  owner: { login: string }
  default_branch: string
  private: boolean
  permissions?: { push: boolean; pull: boolean; admin: boolean }
}

export interface GitHubTreeItem {
  path: string
  type: "blob" | "tree"
  sha: string
  size?: number
}

// ─── Repo operations ─────────────────────────────────────────────────────────

export async function listUserRepos(accessToken: string, page = 1): Promise<GitHubRepo[]> {
  return ghFetch<GitHubRepo[]>(
    "GET",
    `/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator`,
    accessToken,
  )
}

export async function createRepo(
  accessToken: string,
  name: string,
  isPrivate = true,
  description = "",
): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>("POST", "/user/repos", accessToken, {
    name,
    private: isPrivate,
    description,
    auto_init: true,
  })
}

export async function getRepo(accessToken: string | null | undefined, owner: string, repo: string): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, accessToken)
}

// ─── File tree + content ─────────────────────────────────────────────────────

export async function getRepoTree(
  accessToken: string | null | undefined,
  owner: string,
  repo: string,
  branch: string,
): Promise<GitHubTreeItem[]> {
  const data = await ghFetch<{ tree: GitHubTreeItem[] }>(
    "GET",
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    accessToken,
  )
  return data.tree ?? []
}

export async function getFileContent(
  accessToken: string | null | undefined,
  owner: string,
  repo: string,
  path: string,
): Promise<string> {
  const data = await ghFetch<{ content: string; encoding: string }>(
    "GET",
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`,
    accessToken,
  )
  if (data.encoding === "base64") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
  }
  return data.content
}

export async function getReadme(
  accessToken: string | null | undefined,
  owner: string,
  repo: string,
): Promise<string | null> {
  try {
    const data = await ghFetch<{ content: string; encoding: string }>(
      "GET",
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      accessToken,
    )
    if (data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
    }
    return data.content
  } catch (e) {
    if (e instanceof GitHubApiError && e.status === 404) return null
    throw e
  }
}

// ─── Push files ──────────────────────────────────────────────────────────────

interface PushFilesResult {
  commitSha: string
}

/**
 * Pushes a set of files to a GitHub repo using the tree/commit/ref API.
 * Works regardless of whether files already exist (force-updates the branch tip).
 */
export async function pushFilesToRepo(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  commitMessage = "chore: sync from Atai",
): Promise<PushFilesResult> {
  const ownerE = encodeURIComponent(owner)
  const repoE = encodeURIComponent(repo)

  // 1. Get current branch tip SHA
  const refData = await ghFetch<{ object: { sha: string } }>(
    "GET", `/repos/${ownerE}/${repoE}/git/refs/heads/${encodeURIComponent(branch)}`, accessToken,
  )
  const parentSha = refData.object.sha

  // 2. Get base tree SHA
  const commitData = await ghFetch<{ tree: { sha: string } }>(
    "GET", `/repos/${ownerE}/${repoE}/git/commits/${parentSha}`, accessToken,
  )
  const baseTreeSha = commitData.tree.sha

  // 3. Create blobs for each file
  const treeItems = await Promise.all(files.map(async (f) => {
    const blob = await ghFetch<{ sha: string }>(
      "POST", `/repos/${ownerE}/${repoE}/git/blobs`, accessToken,
      { content: f.content, encoding: "utf-8" },
    )
    return { path: f.path, mode: "100644", type: "blob", sha: blob.sha }
  }))

  // 4. Create new tree
  const newTree = await ghFetch<{ sha: string }>(
    "POST", `/repos/${ownerE}/${repoE}/git/trees`, accessToken,
    { base_tree: baseTreeSha, tree: treeItems },
  )

  // 5. Create commit
  const newCommit = await ghFetch<{ sha: string }>(
    "POST", `/repos/${ownerE}/${repoE}/git/commits`, accessToken,
    { message: commitMessage, tree: newTree.sha, parents: [parentSha] },
  )

  // 6. Update branch ref
  await ghFetch(
    "PATCH", `/repos/${ownerE}/${repoE}/git/refs/heads/${encodeURIComponent(branch)}`, accessToken,
    { sha: newCommit.sha, force: true },
  )

  return { commitSha: newCommit.sha }
}
