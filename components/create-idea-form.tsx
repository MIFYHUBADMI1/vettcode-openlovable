"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProjects } from "@/lib/client/api"
import type { Project, ProjectPreferences } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ProjectPreferencesDialog } from "@/components/project-preferences-dialog"
import { PipelineModeSelector, type PipelineMode } from "@/components/pipeline-mode-selector"
import { cn } from "@/lib/utils"

const MAX_IDEA_LENGTH = 2000 // Maximum 2000 characters

export function CreateIdeaForm() {
  const router = useRouter(); const { refresh } = useProjects()
  const [idea, setIdea] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("legacy")

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

  async function doSubmit(preferences?: ProjectPreferences) {
    if (idea.trim().length < 8 || busy) return
    setBusy(true); setError(null)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", {
        mode: "scratch",
        idea: idea.trim(),
        preferences: preferences ?? undefined,
        pipelineMode,
      })
      await refresh(); router.push(`/project/${project.id}`)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create project"); setBusy(false) }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (idea.trim().length < 8 || busy) return
    setShowPrefs(true)
  }

  function handlePrefsSubmit(preferences: ProjectPreferences) {
    setShowPrefs(false)
    doSubmit(preferences)
  }

  const charCount = idea.length
  const isNearLimit = charCount > MAX_IDEA_LENGTH * 0.9
  const isAtLimit = charCount >= MAX_IDEA_LENGTH

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <PipelineModeSelector value={pipelineMode} onChange={setPipelineMode} />
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="project-idea" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            App idea
          </Label>
          <span className={cn(
            "font-mono text-xs transition-colors",
            isAtLimit ? "text-destructive font-semibold" : 
            isNearLimit ? "text-orange-600 dark:text-orange-400" : 
            "text-muted-foreground"
          )}>
            {charCount} / {MAX_IDEA_LENGTH}
          </span>
        </div>
        <Textarea
          id="project-idea"
          value={idea}
          onChange={(e) => {
            const newValue = e.target.value
            if (newValue.length <= MAX_IDEA_LENGTH) {
              setIdea(newValue)
            }
          }}
          placeholder="Describe the application you want to build…"
          className="min-h-32 max-h-80 max-w-full resize-none overflow-y-auto overflow-x-hidden"
          maxLength={MAX_IDEA_LENGTH}
        />
      </div>
      
      <Button type="submit" disabled={busy || idea.trim().length < 8}>
        {busy ? "Planning…" : "Start from idea"}
      </Button>
      
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      
      <ProjectPreferencesDialog 
        open={showPrefs} 
        onOpenChange={setShowPrefs} 
        onSubmit={handlePrefsSubmit} 
        mode="idea" 
      />
    </form>
  )
}