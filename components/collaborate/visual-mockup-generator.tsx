"use client"

import { useState } from "react"
import { Image as ImageIcon, Sparkles, Loader2, Download, RefreshCw, Palette } from "lucide-react"
import { toast } from "sonner"
import { postJson } from "@/lib/client/api"
import { 
  IMAGE_MODELS, 
  DEFAULT_IMAGE_MODEL, 
  DEFAULT_FIXED_CREDITS,
  type VisualMockupResponse,
  type ImageModel 
} from "@/lib/types/visual-mockup"

interface VisualMockupGeneratorProps {
  projectId: string
  sectionId: string
  sectionLabel: string
  userCredits: number
  onCreditsUpdated: (newBalance: number) => void
}

export function VisualMockupGenerator({
  projectId,
  sectionId,
  sectionLabel,
  userCredits,
  onCreditsUpdated,
}: VisualMockupGeneratorProps) {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_IMAGE_MODEL)
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "4:3" | "3:4">("16:9")
  const [style, setStyle] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<VisualMockupResponse | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)

  const selectedModelInfo = IMAGE_MODELS.find(m => m.id === selectedModel)
  const estimatedCredits = selectedModelInfo?.fixedCreditCost || 300

  async function handleGenerate() {
    if (userCredits < estimatedCredits) {
      toast.error("Insufficient credits", {
        description: `You need ${estimatedCredits} credits. You have ${userCredits}.`,
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
        }
      )

      setGeneratedImage(response)
      onCreditsUpdated(userCredits - response.creditsConsumed)
      
      toast.success("Visual mockup generated!", {
        description: `Used ${response.creditsConsumed} credits`,
      })
    } catch (error) {
      console.error("Generation error:", error)
      toast.error("Failed to generate visual", {
        description: error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!generatedImage?.imageUrl) return
    
    const link = document.createElement("a")
    link.href = generatedImage.imageUrl
    link.download = `${sectionId}-mockup-${Date.now()}.png`
    link.click()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Visual Mockup</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {userCredits.toLocaleString()} credits
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Generate an AI-powered visual mockup for the {sectionLabel} section
      </p>

      {/* Model Selector */}
      <div>
        <label className="text-xs font-medium text-foreground block mb-2">
          AI Model
        </label>
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
                {selectedModelInfo?.provider} • {estimatedCredits} credits
              </p>
            </div>
            <Palette className="size-4 text-muted-foreground ml-2" />
          </div>
        </button>

        {showModelSelector && (
          <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-border bg-card">
            {/* Basic Tier */}
            <div className="border-b border-border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Basic (Fixed Cost)
              </p>
            </div>
            {IMAGE_MODELS.filter(m => m.category === "basic").map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model.id)
                  setShowModelSelector(false)
                }}
                className={`w-full border-b border-border p-3 text-left transition-colors hover:bg-accent ${
                  selectedModel === model.id ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{model.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">
                    {model.fixedCreditCost} credits
                  </span>
                </div>
              </button>
            ))}

            {/* Premium Tier */}
            <div className="border-b border-border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Premium (Dynamic Cost)
              </p>
            </div>
            {IMAGE_MODELS.filter(m => m.category === "premium").slice(0, 30).map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model.id)
                  setShowModelSelector(false)
                }}
                className={`w-full border-b border-border p-3 text-left transition-colors hover:bg-accent last:border-b-0 ${
                  selectedModel === model.id ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{model.name}</p>
                    {model.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                    )}
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">
                    ~300 credits
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className="text-xs font-medium text-foreground block mb-2">
          Aspect Ratio
        </label>
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
            Generate Mockup ({estimatedCredits} credits)
          </>
        )}
      </button>

      {/* Generated Image Display */}
      {generatedImage && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Generated Mockup</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
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

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={generatedImage.imageUrl}
              alt={`${sectionLabel} mockup`}
              className="size-full object-contain"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Model: {generatedImage.model.split("/")[1] || generatedImage.model}</span>
            <span>{generatedImage.creditsConsumed} credits used</span>
            {generatedImage.generationTime && (
              <span>{(generatedImage.generationTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
