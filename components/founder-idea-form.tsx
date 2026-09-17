"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { postJson, useProjects } from "@/lib/client/api"
import type { Project, ProjectPreferences } from "@/lib/types/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ProjectPreferencesDialog } from "@/components/project-preferences-dialog"
import { PipelineModeSelector, type PipelineMode } from "@/components/pipeline-mode-selector"
import { cn } from "@/lib/utils"

// AC 2: exact business model options
const BUSINESS_MODELS = [
  { value: "", label: "Select a business model (optional)" },
  { value: "SaaS subscription", label: "SaaS subscription" },
  { value: "One-time purchase", label: "One-time purchase" },
  { value: "Marketplace / commission", label: "Marketplace / commission" },
  { value: "Free with paid upgrades", label: "Free with paid upgrades" },
  { value: "Other", label: "Other" },
] as const

type BusinessModel = typeof BUSINESS_MODELS[number]["value"]

interface FormFields {
  productName: string
  problem: string
  targetAudience: string
  solution: string
  businessModel: BusinessModel
}

/** AC 3 + AC 5: Construct the combined idea string passed to the scratch pipeline. */
function buildIdeaString(fields: FormFields): string {
  const parts: string[] = []

  if (fields.productName.trim()) {
    parts.push(`Product / business name: ${fields.productName.trim()}`)
  }

  parts.push(`Problem being solved: ${fields.problem.trim()}`)

  if (fields.targetAudience.trim()) {
    parts.push(`Target audience: ${fields.targetAudience.trim()}`)
  }

  parts.push(`Solution: ${fields.solution.trim()}`)

  // AC 5: always include business model so the spec generator applies
  // appropriate payment scaffolding
  if (fields.businessModel) {
    parts.push(`Business model: ${fields.businessModel}`)
  }

  return parts.join("\n\n")
}

export function FounderIdeaForm() {
  const router = useRouter()
  const { refresh } = useProjects()

  const [fields, setFields] = useState<FormFields>({
    productName: "",
    problem: "",
    targetAudience: "",
    solution: "",
    businessModel: "",
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("legacy")

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  // AC 4: only problem + solution are required
  const canSubmit =
    fields.problem.trim().length >= 8 &&
    fields.solution.trim().length >= 8 &&
    !busy

  // Pipeline mode visual effect (same as original form)
  useEffect(() => {
    const root = document.documentElement
    if (pipelineMode === "heavy") {
      root.classList.add("heavy-mode-active")
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
        bubbles.forEach((b) => b.remove())
      }
    } else {
      root.classList.remove("heavy-mode-active")
    }
  }, [pipelineMode])

  async function doSubmit(preferences?: ProjectPreferences) {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      // AC 3: build combined idea string and pass it to the scratch pipeline
      const idea = buildIdeaString(fields)
      const { project } = await postJson<{ project: Project }>("/api/projects", {
        mode: "scratch",
        idea,
        preferences: preferences ?? undefined,
        pipelineMode,
      })
      await refresh()
      router.push(`/project/${project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create project")
      setBusy(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setShowPrefs(true)
  }

  function handlePrefsSubmit(preferences: ProjectPreferences) {
    setShowPrefs(false)
    doSubmit(preferences)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <PipelineModeSelector value={pipelineMode} onChange={setPipelineMode} />

      {/* ── 1. Business / product name (optional) ── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-name" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Business / product name
          <span className="ml-1.5 text-muted-foreground/60 normal-case font-normal tracking-normal">(optional)</span>
        </Label>
        <Input
          id="product-name"
          value={fields.productName}
          onChange={(e) => set("productName", e.target.value)}
          placeholder="e.g. TaskFlow, BudgetBuddy, ShopEasy…"
          maxLength={120}
        />
      </div>

      {/* ── 2. Problem (required) ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="problem" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            The problem you are solving
            <span className="ml-1.5 text-primary font-semibold">*</span>
          </Label>
          <span className={cn(
            "font-mono text-xs",
            fields.problem.length > 900 ? "text-orange-500" : "text-muted-foreground/60"
          )}>
            {fields.problem.length}/1000
          </span>
        </div>
        <Textarea
          id="problem"
          value={fields.problem}
          onChange={(e) => set("problem", e.target.value.slice(0, 1000))}
          placeholder="e.g. Small business owners spend hours every week manually tracking invoices in spreadsheets and often lose track of what's been paid."
          className="min-h-[90px] resize-none"
          maxLength={1000}
        />
        {fields.problem.trim().length > 0 && fields.problem.trim().length < 8 && (
          <p className="text-xs text-muted-foreground">A little more detail helps the AI understand the problem.</p>
        )}
      </div>

      {/* ── 3. Target audience (optional) ── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target-audience" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Your target audience
          <span className="ml-1.5 text-muted-foreground/60 normal-case font-normal tracking-normal">(optional)</span>
        </Label>
        <Input
          id="target-audience"
          value={fields.targetAudience}
          onChange={(e) => set("targetAudience", e.target.value)}
          placeholder="e.g. Freelancers, small business owners, remote teams…"
          maxLength={200}
        />
      </div>

      {/* ── 4. Solution (required) ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="solution" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            The solution
            <span className="ml-1.5 text-primary font-semibold">*</span>
          </Label>
          <span className={cn(
            "font-mono text-xs",
            fields.solution.length > 900 ? "text-orange-500" : "text-muted-foreground/60"
          )}>
            {fields.solution.length}/1000
          </span>
        </div>
        <Textarea
          id="solution"
          value={fields.solution}
          onChange={(e) => set("solution", e.target.value.slice(0, 1000))}
          placeholder="e.g. A simple invoicing app where users create and send invoices, set payment reminders, and see a dashboard showing who has paid and who hasn't."
          className="min-h-[90px] resize-none"
          maxLength={1000}
        />
        {fields.solution.trim().length > 0 && fields.solution.trim().length < 8 && (
          <p className="text-xs text-muted-foreground">Describe the app a little more.</p>
        )}
      </div>

      {/* ── 5. Business model (optional select) ── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-model" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Business model
          <span className="ml-1.5 text-muted-foreground/60 normal-case font-normal tracking-normal">(optional)</span>
        </Label>
        <select
          id="business-model"
          value={fields.businessModel}
          onChange={(e) => set("businessModel", e.target.value as BusinessModel)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {BUSINESS_MODELS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Required field hint */}
      <p className="text-xs text-muted-foreground">
        <span className="text-primary font-semibold">*</span> Required fields
      </p>

      <Button type="submit" disabled={!canSubmit} className="mt-1">
        {busy ? "Planning…" : "Generate app plan"}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <ProjectPreferencesDialog
        open={showPrefs}
        onOpenChange={setShowPrefs}
        onSubmit={handlePrefsSubmit}
        mode="idea"
      />
    </form>
  )
}
