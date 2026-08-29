"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProject } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

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

  if (!project) return null
  const canBuild = Boolean(project.specification) && !["building", "deploying"].includes(project.state)
  const canPrompt = Boolean(project.totalumProjectId) && !["building", "deploying"].includes(project.state)

  return <div className="flex flex-col gap-6">
    {error ? <p role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={build} disabled={!canBuild || busy}>{busy ? "Working…" : project.specification ? "Build application" : "Waiting for plan"}</Button>
      {project.developmentUrl ? <a className="font-mono text-xs text-primary hover:underline" href={project.developmentUrl} target="_blank" rel="noreferrer">Open preview</a> : null}
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="workspace-instruction">Continue building</Label>
      <Textarea id="workspace-instruction" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the next change you want to make…" disabled={!canPrompt || busy} />
      <Button variant="outline" onClick={sendPrompt} disabled={!canPrompt || busy || prompt.trim().length < 3}>Send instruction</Button>
    </div>
  </div>
}
