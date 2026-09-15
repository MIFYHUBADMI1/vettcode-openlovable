"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProjects } from "@/lib/client/api"
import type { Project, ProjectPreferences } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProjectPreferencesDialog } from "@/components/project-preferences-dialog"
import { Loader2, Lock, Globe, AlertCircle, Settings, Copy, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

/** Parse a GitHub repo URL or "owner/repo" shorthand into owner + name */
function parseRepoInput(raw: string): { owner: string; name: string; branch?: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Full GitHub URL: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch
  const urlMatch = trimmed.match(
    /^(?:https?:\/\/)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\/tree\/([^/?#]+))?(?:\.git)?(?:[/?#].*)?$/
  )
  if (urlMatch) {
    return { owner: urlMatch[1]!, name: urlMatch[2]!, branch: urlMatch[3] }
  }

  // owner/repo shorthand
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1]!, name: shortMatch[2]! }
  }

  return null
}

export function CreateGitHubRepoForm({ hasGitHub }: { hasGitHub: boolean }) {
  const router = useRouter()
  const { refresh } = useProjects()

  const [repoInput, setRepoInput] = useState("")
  const [branch, setBranch] = useState("")
  const [subMode, setSubMode] = useState<"clone" | "extend">("clone")
  const [userRequest, setUserRequest] = useState("")
  const [preferences, setPreferences] = useState<ProjectPreferences | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseRepoInput(repoInput)
  const isValid = parsed !== null
  const canSubmit = isValid && (subMode === "clone" || (subMode === "extend" && userRequest.trim().length > 0))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", {
        mode: "github",
        githubRepoOwner: parsed!.owner,
        githubRepoName: parsed!.name,
        githubBranch: branch.trim() || parsed!.branch || "main",
        githubSubMode: subMode,
        userRequest: subMode === "extend" ? userRequest.trim() : undefined,
        preferences: preferences || undefined,
      })
      await refresh()
      router.push(`/project/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Experimental badge */}
      <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 px-3 py-2.5">
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
          New &amp; Experimental
        </span>
        <p className="text-xs text-muted-foreground">
          Works with any public repo. Private repos require your GitHub account to be connected.
        </p>
      </div>

      {/* Sub-mode selection */}
      <div className="flex flex-col gap-2">
        <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Mode
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSubMode("clone")}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
              subMode === "clone"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border hover:border-primary/30 hover:bg-accent"
            )}
          >
            <Copy className={cn("size-4 shrink-0", subMode === "clone" ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className={cn("text-sm font-medium", subMode === "clone" ? "text-foreground" : "text-muted-foreground")}>Clone</p>
              <p className="text-xs text-muted-foreground">Build from scratch</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSubMode("extend")}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
              subMode === "extend"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border hover:border-primary/30 hover:bg-accent"
            )}
          >
            <Layers className={cn("size-4 shrink-0", subMode === "extend" ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className={cn("text-sm font-medium", subMode === "extend" ? "text-foreground" : "text-muted-foreground")}>Extend</p>
              <p className="text-xs text-muted-foreground">Continue existing app</p>
            </div>
          </button>
        </div>
      </div>

      {/* Repo input */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="repo-input" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Repository
        </Label>
        <Input
          id="repo-input"
          value={repoInput}
          onChange={e => { setRepoInput(e.target.value); setError(null) }}
          placeholder="github.com/owner/repo  or  owner/repo"
          className="font-mono text-sm"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
        />
        {repoInput && !isValid && (
          <p className="font-mono text-xs text-destructive">
            Enter a GitHub URL (github.com/owner/repo) or shorthand (owner/repo)
          </p>
        )}
        {isValid && (
          <p className="font-mono text-xs text-green-600 dark:text-green-400">
            ✓ {parsed.owner}/{parsed.name}
          </p>
        )}
      </div>

      {/* Branch — optional */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="branch-input" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Branch <span className="normal-case text-muted-foreground/60">(optional, defaults to main)</span>
        </Label>
        <Input
          id="branch-input"
          value={branch}
          onChange={e => setBranch(e.target.value)}
          placeholder="main"
          className="font-mono text-sm"
          autoComplete="off"
          disabled={busy}
        />
      </div>

      {/* Extend mode: user request textarea */}
      {subMode === "extend" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="user-request" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            What do you want to add or change? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="user-request"
            value={userRequest}
            onChange={e => setUserRequest(e.target.value)}
            placeholder="Add dark mode support, implement user authentication, refactor the database layer..."
            className="min-h-[100px] text-sm"
            disabled={busy}
          />
          {userRequest.trim().length === 0 && (
            <p className="text-xs text-muted-foreground">
              Describe what you want to add, change, or improve in the application.
            </p>
          )}
        </div>
      )}

      {/* Preferences button */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Project preferences</p>
          <p className="text-xs text-muted-foreground">
            {preferences ? "Database, stack type, and auth configured" : "Set database, stack type, and auth preferences"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPreferences(true)}
          className="gap-1.5"
        >
          <Settings className="size-3.5" />
          {preferences ? "Edit" : "Configure"}
        </Button>
      </div>

      {/* Private repo note */}
      {!hasGitHub && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-medium mb-1">Private repos require GitHub sign-in</p>
            <p className="text-muted-foreground">
              Public repos work without signing in. To access private repos,{" "}
              <a href="/api/auth/github?next=/new/github" className="font-medium text-amber-600 dark:text-amber-400 underline underline-offset-2">
                connect your GitHub account
              </a>{" "}
              first.
            </p>
          </div>
        </div>
      )}

      {/* Mode-specific info */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {subMode === "clone" ? "Clone mode" : "Extend mode"}
        </p>
        <p className="text-sm text-muted-foreground">
          {subMode === "clone"
            ? "We'll read your README and repository structure, then build a new application from scratch that implements the same functionality."
            : "We'll download your existing codebase and continue from where it left off, adding the features and changes you specify."}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={!canSubmit || busy} className="h-11">
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            {subMode === "clone" ? "Analyzing repository…" : "Preparing to extend…"}
          </>
        ) : (
          <>
            <GitHubIcon className="size-4 mr-2" />
            {subMode === "clone" ? "Clone & build" : "Extend application"}
          </>
        )}
      </Button>

      {/* Preferences Dialog */}
      <ProjectPreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        onSubmit={(prefs) => {
          setPreferences(prefs)
          setShowPreferences(false)
        }}
      />
    </form>
  )
}
