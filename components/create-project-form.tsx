"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { postJson, useProjects, useSession } from "@/lib/client/api"
import type { Project, ProjectPreferences } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ProjectPreferencesDialog } from "@/components/project-preferences-dialog"
import { CrawlModeDialog, type CrawlMode } from "@/components/crawl-mode-dialog"
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
  const [capturedIntent, setCapturedIntent] = useState<string | null>(null)

  useEffect(() => {
    const pending = peekPendingStart()
    if (!pending?.prompt) return
    if (!pending.href.includes("/new/website") && !/^https?:\/\//i.test(pending.prompt) && !/^www\./i.test(pending.prompt)) return
    takePendingStart()
    setCapturedIntent(pending.prompt)
    setUrl(extractWebsiteUrl(pending.prompt) ?? pending.prompt)
  }, [])

  const urlRef = useRef<HTMLInputElement>(null)

  const normalized = normalizeUrl(url)
  const valid = normalized !== null
  const host = normalized ? new URL(normalized).hostname.replace(/^www\./, "") : null

  const PRESETS = [
    { pill: "A project tracker I admire", url: "https://linear.app" },
    { pill: "A booking platform for clinics", url: "https://www.doctolib.com" },
    { pill: "A marketplace like this one", url: "https://www.etsy.com" },
  ]

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-url" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Reference website
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={urlRef}
            id="source-url"
            inputMode="url"
            autoComplete="url"
            placeholder="Paste the website URL — e.g. linear.app"
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
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Studying…
              </>
            ) : (
              "Start from this site"
            )}
          </Button>
        </div>
        <p aria-hidden className="text-xs leading-5 text-muted-foreground/80 italic">
          Example: “https://linear.app — study how a modern tracker works, then plan mine for my market.”
        </p>
        {valid && host ? (
          <p className="text-xs text-muted-foreground">
            Atai will study <span className="font-medium text-foreground">{host}</span>, then you choose how the plan
            is shaped — nothing is built yet.
          </p>
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {url.length > 0 && !valid ? (
          <p role="alert" className="text-xs text-destructive">
            That doesn’t look like a website address yet. Try one like “stripe.com”. Your text stays in the box.
          </p>
        ) : submitting ? (
          <p className="text-xs text-muted-foreground">Atai is opening the site and mapping its pages…</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}{" "}
          <span className="text-muted-foreground">Your URL is still in the box — try again in a moment.</span>
        </p>
      ) : null}

      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Need some inspiration?
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.pill}
              type="button"
              className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-indigo-500/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setUrl(preset.url)
                setError(null)
                urlRef.current?.focus()
              }}
            >
              {preset.pill}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">
        Atai prepares a plan first. Your application is only built after you review and approve it.
      </p>

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
