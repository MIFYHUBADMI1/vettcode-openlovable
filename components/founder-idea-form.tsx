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
import { peekPendingStart, takePendingStart } from "@/lib/auth/client-intent"
import { recordOnboardingActivation } from "@/lib/onboarding/activate"
import { composeVision } from "@/lib/onboarding/state"
import { ONBOARDING_COPY } from "@/lib/onboarding/copy"

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
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("heavy")
  const [capturedVision, setCapturedVision] = useState<string | null>(null)
  const [audience, setAudience] = useState("")
  const [pendingMeta, setPendingMeta] = useState<{ source?: string; signalType?: "url" | "idea" }>({})

  function set<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const pending = peekPendingStart()
    if (!pending?.prompt) return
    if (pending.href.includes("/new/website") || pending.href.includes("/new/github")) return
    takePendingStart()
    setCapturedVision(pending.prompt)
    setPendingMeta({ source: pending.source, signalType: pending.signalType ?? "idea" })
  }, [])

  const canSubmit = capturedVision
    ? capturedVision.trim().length >= 8 && !busy
    : fields.problem.trim().length >= 8 && fields.solution.trim().length >= 8 && !busy

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
    }
    root.classList.remove("heavy-mode-active")
  }, [pipelineMode])

  async function doSubmit(preferences?: ProjectPreferences) {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const idea = capturedVision
        ? composeVision(capturedVision, audience)
        : buildIdeaString(fields)
      const { project } = await postJson<{ project: Project }>("/api/projects", {
        mode: "scratch",
        idea,
        preferences: preferences ?? undefined,
        pipelineMode,
      })
      await refresh()
      try {
        await recordOnboardingActivation({
          businessDescription: idea,
          source: pendingMeta.source ?? "direct_project_creation",
          signalType: pendingMeta.signalType ?? "idea",
          destination: `/project/${project.id}/collaborate`,
        })
      } catch {
        /* project exists — activation is derived from project state */
      }
      router.push(`/project/${project.id}/collaborate`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create project")
      setBusy(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (capturedVision) {
      void doSubmit()
      return
    }
    setShowPrefs(true)
  }

  function handlePrefsSubmit(preferences: ProjectPreferences) {
    setShowPrefs(false)
    doSubmit(preferences)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <PipelineModeSelector value={pipelineMode} onChange={setPipelineMode} />

      {capturedVision ? (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {ONBOARDING_COPY.capturedVision}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{capturedVision}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audience">{ONBOARDING_COPY.audienceLabel}</Label>
            <Input
              id="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder={ONBOARDING_COPY.audiencePlaceholder}
              maxLength={200}
            />
          </div>
        </>
      ) : (
        <>
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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="problem" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                The problem you are solving
                <span className="ml-1.5 text-primary font-semibold">*</span>
              </Label>
              <span className={cn("font-mono text-xs", fields.problem.length > 900 ? "text-orange-500" : "text-muted-foreground/60")}>
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
          </div>

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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="solution" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                The solution
                <span className="ml-1.5 text-primary font-semibold">*</span>
              </Label>
              <span className={cn("font-mono text-xs", fields.solution.length > 900 ? "text-orange-500" : "text-muted-foreground/60")}>
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="business-model" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Business model
              <span className="ml-1.5 text-muted-foreground/60 normal-case font-normal tracking-normal">(optional)</span>
            </Label>
            <select
              id="business-model"
              value={fields.businessModel}
              onChange={(e) => set("businessModel", e.target.value as BusinessModel)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {BUSINESS_MODELS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <Button type="submit" disabled={!canSubmit} className="mt-1">
        {busy ? ONBOARDING_COPY.creating : ONBOARDING_COPY.continueToPlan}
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
