"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProject, useCreditCosts } from "@/lib/client/api"
import { ensureProtocol } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function ProjectWorkspaceControls({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { project, refresh } = useProject(projectId, { pollWhileBuilding: true })
  const [prompt, setPrompt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function build() {
    setBusy(true); setError(null)
    try { await postJson(`/api/projects/${projectId}/build`, {}); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start build") }
    finally { setBusy(false) }
  }

  async function sendPrompt() {
    if (prompt.trim().length < 3) return
    setBusy(true); setError(null)
    try { await postJson(`/api/projects/${projectId}/agent`, { prompt: prompt.trim() }); setPrompt(""); await refresh(); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send instruction") }
    finally { setBusy(false) }
  }

  const { costs } = useCreditCosts()

  // Show warning once if spec was sanitized
  const [sanitizedWarned, setSanitizedWarned] = useState(false)
  useEffect(() => {
    if (project?.specSanitized && !sanitizedWarned) {
      toast.warning("Plan adjusted", {
        description: "Some unsupported technologies (e.g. PostgreSQL, Prisma) were automatically replaced with Totalum SDK equivalents.",
        duration: 8000,
      })
      setSanitizedWarned(true)
    }
  }, [project?.specSanitized, sanitizedWarned])

  if (!project) return null
  const canBuild = Boolean(project.specification) && !["building", "deploying"].includes(project.state)
  const canPrompt = Boolean(project.totalumProjectId) && !["building", "deploying"].includes(project.state)

  // Determine tier and cost for display
  const spec = project.specification
  const tier = spec?.complexity ?? "medium"
  const buildCost = costs?.tiers?.[tier]?.credits ?? costs?.tiers?.medium?.credits ?? 50_000
  const tierLabel = costs?.tiers?.[tier]?.label ?? tier.charAt(0).toUpperCase() + tier.slice(1)
  const followupCost = costs?.followupCost ?? 5_000

  return <div className="flex flex-col gap-6">
    {error ? <p role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    {project.specSanitized ? (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">⚠️ Plan auto-adjusted</p>
        <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
          Some unsupported technologies (e.g. PostgreSQL, Prisma, MongoDB) were automatically replaced with Totalum SDK equivalents to match the supported stack.
        </p>
      </div>
    ) : null}
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={build} disabled={!canBuild || busy}>
        {busy ? "Working…" : project.specification ? `Build ${tierLabel} · ${buildCost.toLocaleString()} credits` : "Waiting for plan"}
      </Button>
      {project.developmentUrl ? <a className="font-mono text-xs text-primary hover:underline" href={ensureProtocol(project.developmentUrl)} target="_blank" rel="noreferrer">Open preview</a> : null}
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="workspace-instruction">Continue building</Label>
      <Textarea id="workspace-instruction" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the next change you want to make…" disabled={!canPrompt || busy} />
      <Button variant="outline" onClick={sendPrompt} disabled={!canPrompt || busy || prompt.trim().length < 3}>Send instruction · {buildCost.toLocaleString()} credits</Button>
    </div>
  </div>
}
