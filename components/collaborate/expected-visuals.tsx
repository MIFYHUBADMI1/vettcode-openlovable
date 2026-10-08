"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
  Palette,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { jsonFetcher, postJson } from "@/lib/client/api"
import { VISUAL_ESTIMATED_CREDITS } from "@/lib/billing/visual-pricing"
import {
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
  type SavedVisual,
  type VisualMockupResponse,
  type ImageModel,
} from "@/lib/types/visual-mockup"

interface ExpectedVisualsProps {
  projectId: string
  sectionId: string
  sectionLabel: string
  userCredits: number
  onCreditsUpdated: (newBalance: number) => void
}

function formatCreatedAt(value: number | Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString()
}

function modelDisplayName(model: string): string {
  return model.split("/")[1] || model
}

export function ExpectedVisuals({
  projectId,
  sectionId,
  sectionLabel,
  userCredits,
  onCreditsUpdated,
}: ExpectedVisualsProps) {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_IMAGE_MODEL)
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "4:3" | "3:4">("16:9")
  const [style, setStyle] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<VisualMockupResponse | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showSavedVisuals, setShowSavedVisuals] = useState(false)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)

  // Previously generated visuals for this section — kept for future reference.
  const [savedVisuals, setSavedVisuals] = useState<SavedVisual[]>([])
  const [viewer, setViewer] = useState<SavedVisual | null>(null)

  const selectedModelInfo = IMAGE_MODELS.find((m) => m.id === selectedModel)
  // Flat-priced models show their exact cost; premium models show the
  // upfront estimate (the real charge comes from OpenRouter's reported cost).
  const estimatedCredits = selectedModelInfo?.fixedCreditCost || VISUAL_ESTIMATED_CREDITS

  const loadVisuals = useCallback(async () => {
    try {
      const data = await jsonFetcher<{ visuals?: SavedVisual[] }>(
        `/api/projects/${projectId}/generate-visual?sectionId=${encodeURIComponent(sectionId)}`,
      )
      const visuals = data.visuals ?? []
      setSavedVisuals(visuals)
      if (visuals.length > 0) setShowSavedVisuals(true)
    } catch (error) {
      // Saved visuals are a convenience — never block the section on them.
      console.error("Failed to load saved visuals:", error)
    }
  }, [projectId, sectionId])

  useEffect(() => {
    void loadVisuals()
  }, [loadVisuals])

  // Esc closes the full-size viewer.
  useEffect(() => {
    if (!viewer) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setViewer(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [viewer])

  async function handleGenerate() {
    if (userCredits < estimatedCredits) {
      toast.error("Insufficient credits", {
        description: `You need about ${estimatedCredits.toLocaleString()} credits. You have ${userCredits.toLocaleString()}.`,
      })
      return
    }

    setGenerating(true)
    setGeneratedImage(null)

    try {
      const response = await postJson<VisualMockupResponse>(
        `/api/projects/${projectId}/generate-visual`,
        {
          sectionId,
          model: selectedModel,
          aspectRatio,
          style: style || undefined,
        },
      )

      setGeneratedImage(response)
      onCreditsUpdated(userCredits - response.creditsConsumed)

      toast.success("Expected visual generated!", {
        description: `Used ${response.creditsConsumed.toLocaleString()} credits${
          response.providerCost != null ? ` (provider cost $${response.providerCost.toFixed(4)})` : ""
        }`,
      })

      // Persisted server-side — refresh the saved gallery for future reference.
      void loadVisuals()
    } catch (error) {
      console.error("Generation error:", error)
      toast.error("Failed to generate visual", {
        description: error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload(imageUrl: string, fileName: string) {
    if (!imageUrl) return
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = fileName
    link.click()
  }

  const premiumModels = IMAGE_MODELS.filter((m) => m.category === "premium")
  const basicModels = IMAGE_MODELS.filter((m) => m.category === "basic")

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Expected Visuals</h3>
        </div>
        <div className="flex items-center gap-2">
          {savedVisuals.length > 0 && (
            <button
              onClick={() => setShowSavedVisuals(!showSavedVisuals)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              {showSavedVisuals ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {savedVisuals.length} saved
            </button>
          )}
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {userCredits.toLocaleString()} credits
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Generate AI-powered visual previews for the {sectionLabel} section to see how it might look
      </p>

      {/* Saved Visuals — images kept for future reference */}
      {savedVisuals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <button
            onClick={() => setShowSavedVisuals(!showSavedVisuals)}
            className="flex w-full items-center justify-between text-left"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saved Visuals (for future reference)
            </p>
            {showSavedVisuals ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
          </button>
          {showSavedVisuals && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {savedVisuals.map((visual) => (
                <div
                  key={visual.id}
                  className="group relative cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted/30"
                  onClick={() => setViewer(visual)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setViewer(visual)
                    }
                  }}
                  aria-label={`Open saved visual for ${sectionLabel}`}
                >
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    <img
                      src={visual.imageUrl}
                      alt={`${sectionLabel} saved visual`}
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-lg bg-white/20 backdrop-blur-sm px-2 py-1 text-xs text-white">
                      <Eye className="mr-1 inline size-3" /> View
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="truncate text-[10px] font-medium text-white">
                      {modelDisplayName(visual.model)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Selector */}
      <div>
        <label className="text-xs font-medium text-foreground block mb-2">AI Model</label>
        <button
          onClick={() => setShowModelSelector(!showModelSelector)}
          className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {selectedModelInfo?.name || selectedModel}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedModelInfo?.provider} •{" "}
                {selectedModelInfo?.fixedCreditCost
                  ? `${selectedModelInfo.fixedCreditCost} credits`
                  : `~${estimatedCredits.toLocaleString()} credits (varies with model cost)`}
              </p>
            </div>
            <Palette className="size-4 text-muted-foreground ml-2" />
          </div>
        </button>

        {showModelSelector && (
          <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-card">
            {/* Basic Tier */}
            <div className="border-b border-border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Default (Fixed Cost)
              </p>
            </div>
            {basicModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                isSelected={selectedModel === model.id}
                onSelect={() => {
                  setSelectedModel(model.id)
                  setShowModelSelector(false)
                }}
                expanded={expandedModel === model.id}
                onToggleExpand={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
              />
            ))}

            {/* Premium Tier */}
            <div className="border-b border-border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Premium ({premiumModels.length} models — cost from provider + 45% margin)
              </p>
            </div>
            {premiumModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                isSelected={selectedModel === model.id}
                onSelect={() => {
                  setSelectedModel(model.id)
                  setShowModelSelector(false)
                }}
                expanded={expandedModel === model.id}
                onToggleExpand={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className="text-xs font-medium text-foreground block mb-2">Aspect Ratio</label>
        <div className="grid grid-cols-5 gap-2">
          {[
            { value: "1:1" as const, label: "Square" },
            { value: "16:9" as const, label: "Wide" },
            { value: "9:16" as const, label: "Tall" },
            { value: "4:3" as const, label: "Classic" },
            { value: "3:4" as const, label: "Portrait" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setAspectRatio(option.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                aspectRatio === option.value
                  ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              <div className="text-center">
                <div className="font-mono">{option.value}</div>
                <div className="mt-0.5 text-[10px]">{option.label}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Style Modifier (Optional) */}
      <div>
        <label htmlFor="style-input" className="text-xs font-medium text-foreground block mb-2">
          Style Modifier (Optional)
        </label>
        <input
          id="style-input"
          type="text"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="e.g., minimalist, vibrant colors, dark theme..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || userCredits < estimatedCredits}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 inline size-4" />
            Generate Expected Visual ({estimatedCredits.toLocaleString()}
            {selectedModelInfo?.fixedCreditCost ? "" : " est."} credits)
          </>
        )}
      </button>

      {/* Generated Image Display */}
      {generatedImage && (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Expected Visual Preview</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleDownload(
                    generatedImage.imageUrl,
                    `${sectionId}-expected-visual-${Date.now()}.png`,
                  )
                }
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Download className="mr-1 inline size-3" />
                Download
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <RefreshCw className="mr-1 inline size-3" />
                Regenerate
              </button>
            </div>
          </div>

          <div
            className="relative aspect-video w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
            onClick={() =>
              setViewer({
                id: `preview_${Date.now()}`,
                imageUrl: generatedImage.imageUrl,
                model: generatedImage.model,
                creditsConsumed: generatedImage.creditsConsumed,
                createdAt: Date.now(),
              })
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.preventDefault()
            }}
            aria-label="Open full-size preview"
          >
            <img
              src={generatedImage.imageUrl}
              alt={`${sectionLabel} expected visual`}
              className="size-full object-contain"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Model: {modelDisplayName(generatedImage.model)}</span>
            <span>{generatedImage.creditsConsumed.toLocaleString()} credits used</span>
            {generatedImage.generationTime && (
              <span>{(generatedImage.generationTime / 1000).toFixed(1)}s</span>
            )}
          </div>
          {generatedImage.providerCost != null && generatedImage.finalCost != null && (
            <p className="text-[11px] text-muted-foreground">
              Provider cost ${generatedImage.providerCost.toFixed(4)} + 45% margin = $
              {generatedImage.finalCost.toFixed(4)} → {generatedImage.creditsConsumed.toLocaleString()}{" "}
              credits
            </p>
          )}
        </div>
      )}

      {/* Full-size viewer for saved visuals */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${sectionLabel} saved visual`}
          onClick={() => setViewer(null)}
        >
          <div
            className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-auto rounded-xl border border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {sectionLabel} — saved visual
                </p>
                <p className="text-xs text-muted-foreground">
                  {modelDisplayName(viewer.model)}
                  {viewer.creditsConsumed > 0 && ` · ${viewer.creditsConsumed.toLocaleString()} credits`}
                  {formatCreatedAt(viewer.createdAt) && ` · ${formatCreatedAt(viewer.createdAt)}`}
                </p>
              </div>
              <button
                onClick={() => setViewer(null)}
                aria-label="Close viewer"
                className="shrink-0 rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <img
              src={viewer.imageUrl}
              alt={`${sectionLabel} expected visual`}
              className="max-h-[70vh] w-full rounded-lg bg-muted object-contain"
            />
            <div className="flex justify-end">
              <button
                onClick={() =>
                  handleDownload(viewer.imageUrl, `${sectionId}-visual-${viewer.id}.png`)
                }
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Download className="mr-1 inline size-3" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ModelRowProps {
  model: ImageModel
  isSelected: boolean
  onSelect: () => void
  expanded: boolean
  onToggleExpand: () => void
}

function ModelRow({ model, isSelected, onSelect, expanded, onToggleExpand }: ModelRowProps) {
  const estimatedCost = model.fixedCreditCost || VISUAL_ESTIMATED_CREDITS

  return (
    <div className={`border-b border-border last:border-b-0 ${isSelected ? "bg-primary/5" : ""}`}>
      <button
        onClick={onSelect}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-accent transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{model.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{model.provider}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {model.category === "basic" && model.fixedCreditCost && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">
              {model.fixedCreditCost} credits
            </span>
          )}
          {model.category === "premium" && (
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">
              ~{estimatedCost.toLocaleString()} credits
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation()
                onToggleExpand()
              }
            }}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={expanded ? "Hide capabilities" : "Show capabilities"}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </span>
        </div>
      </button>

      {expanded && model.capabilities && (
        <div className="px-3 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Capabilities
          </p>
          <div className="flex flex-wrap gap-1">
            {model.capabilities.map((cap) => (
              <span
                key={cap}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
