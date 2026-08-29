"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProjects } from "@/lib/client/api"
import type { Project } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function CreateIdeaForm() {
  const router = useRouter(); const { refresh } = useProjects()
  const [idea, setIdea] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent) { event.preventDefault(); if (idea.trim().length < 8 || busy) return; setBusy(true); setError(null); try { const { project } = await postJson<{ project: Project }>("/api/projects", { mode: "scratch", idea: idea.trim() }); await refresh(); router.push(`/project/${project.id}`) } catch (e) { setError(e instanceof Error ? e.message : "Could not create project"); setBusy(false) } }
  return <form onSubmit={submit} className="flex flex-col gap-3"><Label htmlFor="project-idea" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">App idea</Label><Textarea id="project-idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Describe the application you want to build…" /><Button type="submit" disabled={busy || idea.trim().length < 8}>{busy ? "Planning…" : "Start from idea"}</Button>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</form>
}
