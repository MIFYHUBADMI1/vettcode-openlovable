"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProject, useSession } from "@/lib/client/api"

import { useBuildCosts } from "@/lib/client/build-costs"
import { ensureProtocol } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function ProjectWorkspaceControls({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { project, refresh } = useProject(projectId, { pollWhileBuilding: true })
  const { refresh: refreshSession } = useSession()
  const [prompt, setPrompt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function build() {
    setBusy(true); setError(null)
    try { await postJson(`/api/projects/${projectId}/build`, {}); await Promise.all([refresh(), refreshSession()]) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start build") }
    finally { setBusy(false) }
  }

  async function sendPrompt() {
    if (prompt.trim().length < 3) return
    setBusy(true); setError(null)
    try { await postJson(`/api/projects/${projectId}/agent`, { prompt: prompt.trim() }); setPrompt(""); await Promise.all([refresh(), refreshSession()]); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send instruction") }
    finally { setBusy(false) }
  }

  const { buildCost, tierLabel, followupCost } = useBuildCosts()

  if (!project) return null
  const canBuild = Boolean(project.specification) && !["building", "deploying"].includes(project.state)
  const canPrompt = Boolean(project.totalumProjectId) && !["building", "deploying"].includes(project.state)

  // Display costs from the server-authoritative cost table — the server
  // re-checks the real cost at launch/send time.
  const spec = project.specification
  const tier = spec?.complexity ?? "medium"
  const buildCostNum = buildCost(tier, project.pipelineMode)
  const buildTierLabel = tierLabel(tier)
  const followupCostNum = followupCost(tier)

  return <div className="mt-4 flex flex-col gap-5">
    {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
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
        {busy ? "Working…" : project.specification ? `Build ${buildTierLabel} · ${buildCostNum.toLocaleString()} credits` : "Waiting for plan"}
      </Button>
      {project.developmentUrl ? <a className="font-mono text-xs text-primary hover:underline" href={ensureProtocol(project.developmentUrl)} target="_blank" rel="noreferrer">Open preview</a> : null}
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="workspace-instruction">Tell the engineering team what to do next</Label>
      <Textarea id="workspace-instruction" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the next change you want to make…" disabled={!canPrompt || busy} />
      <Button variant="outline" onClick={sendPrompt} disabled={!canPrompt || busy || prompt.trim().length < 3}>Send instruction · {followupCostNum.toLocaleString()} credits</Button>
    </div>
  </div>
}
