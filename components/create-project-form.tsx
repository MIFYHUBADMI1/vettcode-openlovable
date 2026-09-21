"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProjects, useSession } from "@/lib/client/api"
import type { Project, ProjectPreferences } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ProjectPreferencesDialog } from "@/components/project-preferences-dialog"
import { CrawlModeDialog, type CrawlMode } from "@/components/crawl-mode-dialog"
import { PipelineModeSelector, type PipelineMode } from "@/components/pipeline-mode-selector"
import { peekPendingStart, takePendingStart } from "@/lib/auth/client-intent"
import { recordOnboardingActivation } from "@/lib/onboarding/activate"
import { extractWebsiteUrl } from "@/lib/start/detect-input"

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withScheme)
    if (!u.hostname.includes(".")) return null
    return u.toString()
  } catch {
    return null
  }
}

export function CreateProjectForm() {
  const router = useRouter()
  const { refresh: refreshProjects } = useProjects()
  const { refresh: refreshSession } = useSession()
  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)
  const [showCrawlMode, setShowCrawlMode] = useState(false)
  const [pendingPrefs, setPendingPrefs] = useState<ProjectPreferences | null>(null)
  const [pendingCrawlMode, setPendingCrawlMode] = useState<CrawlMode | null>(null)
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("heavy")
  const [capturedIntent, setCapturedIntent] = useState<string | null>(null)

  useEffect(() => {
    const pending = peekPendingStart()
    if (!pending?.prompt) return
    if (!pending.href.includes("/new/website") && !/^https?:\/\//i.test(pending.prompt) && !/^www\./i.test(pending.prompt)) return
    takePendingStart()
    setCapturedIntent(pending.prompt)
    setUrl(extractWebsiteUrl(pending.prompt) ?? pending.prompt)
    if (pending.pipelineMode === "legacy" || pending.pipelineMode === "heavy") {
      setPipelineMode(pending.pipelineMode)
    }
  }, [])

  // Apply page-wide visual effect with floating bubbles
  useEffect(() => {
    const root = document.documentElement
    
    if (pipelineMode === "heavy") {
      root.classList.add("heavy-mode-active")
      
      // Create floating energy bubbles
      const bubbles: HTMLDivElement[] = []
      for (let i = 0; i < 8; i++) {
        const bubble = document.createElement("div")
        bubble.className = "energy-bubble"
        bubble.style.setProperty("--size", `${Math.random() * 150 + 80}px`)
        bubble.style.setProperty("--duration", `${Math.random() * 15 + 15}s`)
        bubble.style.setProperty("--delay", `${Math.random() * 5}s`)
        bubble.style.setProperty("--start-x", `${Math.random() * 100}%`)
        bubble.style.setProperty("--float-x", `${(Math.random() - 0.5) * 200}px`)
        document.body.appendChild(bubble)
        bubbles.push(bubble)
      }
      
      return () => {
        root.classList.remove("heavy-mode-active")
        bubbles.forEach(b => b.remove())
      }
    } else {
      root.classList.remove("heavy-mode-active")
    }
  }, [pipelineMode])

  const normalized = normalizeUrl(url)
  const valid = normalized !== null

  async function doSubmit(preferences?: ProjectPreferences, crawlMode?: CrawlMode) {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", {
        url: normalized,
        idea: capturedIntent ?? undefined,
        crawlMode: crawlMode ?? undefined,
        preferences: preferences ?? undefined,
        pipelineMode,
      })
      await Promise.all([refreshProjects(), refreshSession()])
      try {
        await recordOnboardingActivation({
          businessDescription: normalized ?? undefined,
          source: "direct_project_creation",
          signalType: "url",
          destination: `/project/${project.id}/collaborate`,
        })
      } catch {
        /* project exists — activation is derived from project state */
      }
      router.push(`/project/${project.id}/collaborate`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project")
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    if (capturedIntent) {
      void doSubmit(undefined, "relevant")
      return
    }
    setShowCrawlMode(true)
  }

  function handleCrawlModeSelect(mode: CrawlMode) {
    setShowCrawlMode(false)
    setPendingCrawlMode(mode)
    // Then show preferences
    setShowPrefs(true)
  }

  function handlePrefsSubmit(preferences: ProjectPreferences) {
    setPendingPrefs(preferences)
    setShowPrefs(false)
    doSubmit(preferences, pendingCrawlMode ?? undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <PipelineModeSelector value={pipelineMode} onChange={setPipelineMode} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-url" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Source URL
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="source-url"
            inputMode="url"
            autoComplete="url"
            placeholder="example.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
            }}
            className={cn(
              "h-11 font-mono text-sm",
              url.length > 0 && !valid && "border-destructive/60 focus-visible:ring-destructive/30",
            )}
            aria-invalid={url.length > 0 && !valid}
          />
          <Button type="submit" disabled={!valid || submitting} className="h-11 shrink-0 px-6">
            {submitting ? "Starting…" : "Start from this site"}
          </Button>
        </div>
      </div>
      {url.length > 0 && !valid ? (
        <p className="font-mono text-xs text-destructive">Enter a valid website URL (e.g. example.com).</p>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          Atai studies the site and drafts a plan for your product. Choose a deeper crawl if you want a closer match.
        </p>
      )}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <CrawlModeDialog
        open={showCrawlMode}
        onOpenChange={setShowCrawlMode}
        onSelect={handleCrawlModeSelect}
        url={normalized ?? url}
      />
      <ProjectPreferencesDialog
        open={showPrefs}
        onOpenChange={setShowPrefs}
        onSubmit={handlePrefsSubmit}
        mode="website"
      />
    </form>
  )
}
