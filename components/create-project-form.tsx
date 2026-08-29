"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProjects, useSession } from "@/lib/client/api"
import type { Project } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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

  const normalized = normalizeUrl(url)
  const valid = normalized !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", { url: normalized })
      await Promise.all([refreshProjects(), refreshSession()])
      router.push(`/project/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            {submitting ? "Creating…" : "Mirror site"}
          </Button>
        </div>
      </div>
      {url.length > 0 && !valid ? (
        <p className="font-mono text-xs text-destructive">Enter a valid website URL (e.g. example.com).</p>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          {"We\u2019ll crawl, analyze, and generate a specification before any credits are spent on building."}
        </p>
      )}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
