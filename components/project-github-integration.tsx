"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { GitBranch, RefreshCw, Trash2, Plus, ExternalLink, Loader2, Check, Upload, BookOpen } from "lucide-react"
import Link from "next/link"

// Inline GitHub mark SVG — lucide-react doesn't include a GitHub icon
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

interface GitHubRepo {
  id: number
  fullName: string
  name: string
  owner: string
  defaultBranch: string
  private: boolean
  canPush: boolean
}

interface GitHubIntegration {
  connected: boolean
  mode?: "push" | "build-from"
  repoOwner?: string
  repoName?: string
  branch?: string
  lastPushedAt?: number | null
  lastPushedSha?: string | null
  pushStatus?: string | null
  pushError?: string | null
}

interface Props {
  projectId: string
  isBuilt: boolean
}

export function ProjectGitHubIntegration({ projectId, isBuilt }: Props) {
  const [integration, setIntegration] = useState<GitHubIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [hasGitHub, setHasGitHub] = useState<boolean | null>(null)

  // Form state
  const [mode, setMode] = useState<"push" | "build-from">("push")
  const [selectedRepo, setSelectedRepo] = useState("")
  const [branch, setBranch] = useState("main")
  const [newRepoName, setNewRepoName] = useState("")
  const [creatingRepo, setCreatingRepo] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Check if user has GitHub connected (no token = need to sign in with GitHub)
  useEffect(() => {
    fetch("/api/github/repos?page=1")
      .then(r => {
        setHasGitHub(r.status !== 401)
      })
      .catch(() => setHasGitHub(false))
  }, [])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/github`)
      .then(r => r.json())
      .then(d => { if (d.ok) setIntegration(d.data) })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [projectId])

  async function loadRepos() {
    setReposLoading(true)
    try {
      const r = await fetch("/api/github/repos?page=1")
      const d = await r.json()
      if (d.ok) setRepos(d.data.repos)
    } catch { toast.error("Failed to load repositories") }
    finally { setReposLoading(false) }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRepo) { toast.error("Please select a repository"); return }
    const [repoOwner, repoName] = selectedRepo.split("/")
    setConnecting(true)
    try {
      const r = await fetch(`/api/projects/${projectId}/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, repoOwner, repoName, branch }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.message || "Failed to connect"); return }
      setIntegration({ connected: true, mode, repoOwner, repoName, branch })
      setShowConnect(false)
      toast.success(mode === "push"
        ? `Connected! Code will auto-push to ${repoOwner}/${repoName} after each build.`
        : `Connected! Analysis will read from ${repoOwner}/${repoName}.`)
    } finally { setConnecting(false) }
  }

  async function handleCreateRepo(e: React.FormEvent) {
    e.preventDefault()
    if (!newRepoName.trim()) return
    setCreatingRepo(true)
    try {
      const r = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRepoName.trim(), private: true }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.message || "Failed to create repo"); return }
      const repo = d.data.repo
      setRepos(prev => [{ id: repo.id, fullName: repo.fullName, name: repo.name, owner: repo.owner, defaultBranch: repo.defaultBranch, private: repo.private, canPush: true }, ...prev])
      setSelectedRepo(repo.fullName)
      setBranch(repo.defaultBranch)
      setNewRepoName("")
      toast.success(`Repository ${repo.fullName} created!`)
    } finally { setCreatingRepo(false) }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect GitHub integration for this project?")) return
    setDisconnecting(true)
    try {
      const r = await fetch(`/api/projects/${projectId}/github`, { method: "DELETE" })
      if (!r.ok) { toast.error("Failed to disconnect"); return }
      setIntegration({ connected: false })
      toast.success("GitHub integration disconnected")
    } finally { setDisconnecting(false) }
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading GitHub integration…
    </div>
  )

  // Not connected — show connect button or no-github prompt
  if (!integration?.connected) {
    if (hasGitHub === false) {
      return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <GitHubIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">Connect GitHub</p>
              <p className="text-xs text-muted-foreground">Sign in with GitHub to push code or build from a repo</p>
            </div>
          </div>
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-600 dark:text-blue-400">
            <p className="font-medium mb-1">💡 Why connect GitHub?</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• <strong>Auto-push:</strong> Deploy your built code to a GitHub repo after each build</li>
              <li>• <strong>Build from repo:</strong> Use an existing GitHub repo as the source for AI analysis</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Don't have GitHub on your account? Connect it in{" "}
              <Link href="/settings/profile" className="font-medium text-primary underline underline-offset-2">
                Settings → Profile
              </Link>
            </p>
          </div>
          <a
            href={`/api/auth/github?next=/project/${projectId}`}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#24292e] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1a1e22]"
          >
            <GitHubIcon className="size-4" />
            Sign in with GitHub
          </a>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <GitHubIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">GitHub</p>
              <p className="text-xs text-muted-foreground">Not connected</p>
            </div>
          </div>
          {!showConnect && (
            <button
              onClick={() => { setShowConnect(true); loadRepos() }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-3.5" /> Connect GitHub
            </button>
          )}
        </div>

        {showConnect && (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
            {/* Mode picker */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">What do you want to do?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => setMode("push")}
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${mode === "push" ? "border-primary/30 bg-primary/5" : "border-border hover:bg-accent"}`}
                >
                  <div className="flex items-center gap-2">
                    <Upload className={`size-4 ${mode === "push" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-semibold">Push to GitHub</span>
                    {mode === "push" && <Check className="size-3.5 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-push built code to a GitHub repo after each build</p>
                </button>
                <button
                  onClick={() => setMode("build-from")}
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${mode === "build-from" ? "border-primary/30 bg-primary/5" : "border-border hover:bg-accent"}`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className={`size-4 ${mode === "build-from" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-semibold">Build from repo</span>
                    {mode === "build-from" && <Check className="size-3.5 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Use a GitHub repo as the source for AI analysis and building</p>
                </button>
              </div>
            </div>

            {/* Repo list */}
            <form onSubmit={handleConnect} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Repository</label>
                {reposLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Loading repos…
                  </div>
                ) : (
                  <select
                    value={selectedRepo}
                    onChange={e => {
                      setSelectedRepo(e.target.value)
                      const repo = repos.find(r => r.fullName === e.target.value)
                      if (repo) setBranch(repo.defaultBranch)
                    }}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  >
                    <option value="">— Select a repository —</option>
                    {repos
                      .filter(r => mode === "build-from" || r.canPush)
                      .map(r => (
                        <option key={r.id} value={r.fullName}>{r.fullName}</option>
                      ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="main"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={connecting || !selectedRepo}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="size-3.5 animate-spin" /> : <GitHubIcon className="size-3.5" />}
                  {connecting ? "Connecting…" : "Connect"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConnect(false)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Create new repo */}
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Or create a new repository</p>
              <form onSubmit={handleCreateRepo} className="flex gap-2">
                <input
                  type="text"
                  value={newRepoName}
                  onChange={e => setNewRepoName(e.target.value)}
                  placeholder="my-new-repo"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="submit"
                  disabled={creatingRepo || !newRepoName.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {creatingRepo ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Create
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Connected — show status
  const repoUrl = `https://github.com/${integration.repoOwner}/${integration.repoName}`
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#24292e]">
            <GitHubIcon className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm text-foreground">GitHub</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${integration.mode === "push" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"}`}>
                {integration.mode === "push" ? "Auto-push" : "Build from repo"}
              </span>
              {integration.pushStatus === "ok" && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                  ✓ Synced
                </span>
              )}
              {integration.pushStatus === "failed" && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  Push failed
                </span>
              )}
            </div>
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 flex items-center gap-1 font-mono text-xs text-primary hover:underline"
            >
              {integration.repoOwner}/{integration.repoName}
              <ExternalLink className="size-3" />
            </a>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <GitBranch className="size-3" />
              {integration.branch}
              {integration.lastPushedAt && (
                <span className="ml-2">· Last pushed {new Date(integration.lastPushedAt).toLocaleDateString()}</span>
              )}
            </div>
            {integration.pushError && (
              <p className="mt-1 text-xs text-destructive">{integration.pushError}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Disconnect GitHub"
        >
          {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>

      {integration.mode === "push" && integration.lastPushedSha && (
        <a
          href={`${repoUrl}/commit/${integration.lastPushedSha}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <RefreshCw className="size-3.5" />
          Latest commit: <code className="font-mono">{integration.lastPushedSha.slice(0, 8)}</code>
          <ExternalLink className="size-3 ml-auto" />
        </a>
      )}
    </div>
  )
}
