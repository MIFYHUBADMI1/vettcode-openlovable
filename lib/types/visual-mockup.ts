/**
 * Visual Mockup Generation Types
 * -------------------------------
 * Types for AI-generated visual previews of plan sections.
 *
 * The model catalog below is aligned with OpenRouter's dedicated Image API
 * (GET https://openrouter.ai/api/v1/images/models) — every id in this list is
 * servable through POST /api/v1/images with our OPENROUTER_API_KEY.
 */

export interface ImageModel {
  id: string
  name: string
  provider: string
  category: "basic" | "premium"
  /** Flat credit cost for basic tier models (100 credits). Absent for premium (dynamic pricing). */
  fixedCreditCost?: number
  description?: string
  capabilities?: string[]
}

export interface VisualMockupRequest {
  projectId: string
  sectionId: string
  model?: string // defaults to inclusionai/ming-image-0.1-design-layer
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
  style?: string // additional style modifiers
}

export interface VisualMockupResponse {
  imageUrl: string
  creditsConsumed: number
  model: string
  /** Provider cost in dollars (before markup) */
  providerCost?: number
  /** Final cost with 45% markup */
  finalCost?: number
  generationTime?: number
}

export interface GeneratedVisual {
  id: string
  projectId: string
  sectionId: string
  imageUrl: string
  model: string
  creditsConsumed: number
  createdAt: Date
  prompt: string
}

/** A visual previously saved for a plan section (future reference). */
export interface SavedVisual {
  id: string
  imageUrl: string
  model: string
  creditsConsumed: number
  /** Epoch ms from the API, but accept Date/ISO too. */
  createdAt: number | Date | string
  prompt?: string
  aspectRatio?: string
}

/** Default model with fixed 100 credit cost */
export const DEFAULT_IMAGE_MODEL = "inclusionai/ming-image-0.1-design-layer"
export const DEFAULT_FIXED_CREDITS = 100

/** Available image generation models */
export const IMAGE_MODELS: ImageModel[] = [
  // Basic tier — flat 100 credits per image (the default).
  {
    id: "inclusionai/ming-image-0.1-design-layer",
    name: "Ming Image Design Layer",
    provider: "Inclusion AI",
    category: "basic",
    fixedCreditCost: 100,
    description: "Fast, reliable UI/UX design generation",
    capabilities: ["UI Design", "App Mockups", "Web Layouts"],
  },

  // Premium tier — 30 models, dynamic pricing from OpenRouter
  // (provider cost + 45% margin, converted at $1 = 4000 credits).
  {
    id: "openai/gpt-image-2.5-sunburst",
    name: "GPT Image 2.5 Sunburst",
    provider: "OpenAI",
    category: "premium",
    description: "OpenAI's flagship image model, highest fidelity",
    capabilities: ["Text rendering", "Editing", "Photorealism"],
  },
  {
    id: "openai/gpt-image-2.5-flare",
    name: "GPT Image 2.5 Flare",
    provider: "OpenAI",
    category: "premium",
    description: "Balanced quality/speed tier of GPT Image 2.5",
    capabilities: ["Text rendering", "Editing"],
  },
  {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    provider: "OpenAI",
    category: "premium",
    description: "High-fidelity generation and editing",
    capabilities: ["Photorealism", "Editing"],
  },
  {
    id: "openai/gpt-image-1",
    name: "GPT Image 1",
    provider: "OpenAI",
    category: "premium",
    description: "Accurate instruction-following image generation",
    capabilities: ["Instruction following", "Editing"],
  },
  {
    id: "openai/gpt-5-image",
    name: "GPT-5 Image",
    provider: "OpenAI",
    category: "premium",
    description: "GPT-5 powered image generation",
    capabilities: ["Reasoning", "Text rendering"],
  },
  {
    id: "google/gemini-nano-banana-2.1",
    name: "Nano Banana 2.1",
    provider: "Google",
    category: "premium",
    description: "Google's latest image generation and editing model",
    capabilities: ["Editing", "Character consistency"],
  },
  {
    id: "google/gemini-3.1-flash-image",
    name: "Nano Banana 2 (Gemini 3.1 Flash)",
    provider: "Google",
    category: "premium",
    description: "State-of-the-art fast image generation",
    capabilities: ["Fast", "Editing"],
  },
  {
    id: "google/gemini-3-pro-image",
    name: "Nano Banana Pro (Gemini 3 Pro)",
    provider: "Google",
    category: "premium",
    description: "Google's most advanced image model",
    capabilities: ["Ultra quality", "Text rendering"],
  },
  {
    id: "google/gemini-2.5-flash-image",
    name: "Nano Banana (Gemini 2.5 Flash)",
    provider: "Google",
    category: "premium",
    description: "Fast multimodal image generation",
    capabilities: ["Fast", "Editing"],
  },
  {
    id: "google/gemini-3.1-flash-lite-image",
    name: "Nano Banana 2 Lite",
    provider: "Google",
    category: "premium",
    description: "Google's fastest, most cost-efficient image model",
    capabilities: ["Fast", "Low cost"],
  },
  {
    id: "black-forest-labs/flux-3-image",
    name: "FLUX.3 Image",
    provider: "Black Forest Labs",
    category: "premium",
    description: "Flagship image generation and editing model",
    capabilities: ["Ultra quality", "Photorealism"],
  },
  {
    id: "black-forest-labs/flux.2-pro",
    name: "FLUX.2 Pro",
    provider: "Black Forest Labs",
    category: "premium",
    description: "Frontier-level visual quality",
    capabilities: ["Photorealism", "Complex scenes"],
  },
  {
    id: "black-forest-labs/flux.2-max",
    name: "FLUX.2 Max",
    provider: "Black Forest Labs",
    category: "premium",
    description: "Top-tier quality in the FLUX.2 family",
    capabilities: ["Ultra quality"],
  },
  {
    id: "black-forest-labs/flux.2-flex",
    name: "FLUX.2 Flex",
    provider: "Black Forest Labs",
    category: "premium",
    description: "Excels at complex text and fine details",
    capabilities: ["Typography", "Fine detail"],
  },
  {
    id: "recraft/recraft-v4.1-pro",
    name: "Recraft V4.1 Pro",
    provider: "Recraft",
    category: "premium",
    description: "Design-focused generation tuned for high aesthetics",
    capabilities: ["Design", "Brand styles"],
  },
  {
    id: "recraft/recraft-v4.1",
    name: "Recraft V4.1",
    provider: "Recraft",
    category: "premium",
    description: "Aesthetic-tuned text and image input generation",
    capabilities: ["Design", "Editing"],
  },
  {
    id: "recraft/recraft-v4-styles-pro",
    name: "Recraft V4 Styles Pro",
    provider: "Recraft",
    category: "premium",
    description: "Style-consistent generation across requests",
    capabilities: ["Style consistency"],
  },
  {
    id: "recraft/recraft-v3",
    name: "Recraft V3",
    provider: "Recraft",
    category: "premium",
    description: "Vector graphics and image generation",
    capabilities: ["Design", "Illustration"],
  },
  {
    id: "bytedance-seed/seedream-5-0-pro",
    name: "Seedream 5.0 Pro",
    provider: "ByteDance Seed",
    category: "premium",
    description: "Professional-grade image generation",
    capabilities: ["High resolution", "Editing"],
  },
  {
    id: "bytedance-seed/seedream-5-0-flash",
    name: "Seedream 5.0 Flash",
    provider: "ByteDance Seed",
    category: "premium",
    description: "Faster, lighter Seedream variant",
    capabilities: ["Fast"],
  },
  {
    id: "bytedance-seed/seedream-4.5",
    name: "Seedream 4.5",
    provider: "ByteDance Seed",
    category: "premium",
    description: "Strong all-round generation quality",
    capabilities: ["High resolution"],
  },
  {
    id: "x-ai/grok-imagine-image-2.0",
    name: "Grok Imagine Image 2.0",
    provider: "xAI",
    category: "premium",
    description: "Image generation and editing from xAI",
    capabilities: ["Photorealism", "Fast"],
  },
  {
    id: "x-ai/grok-imagine-image-quality",
    name: "Grok Imagine Image Quality",
    provider: "xAI",
    category: "premium",
    description: "High-fidelity quality tier",
    capabilities: ["Ultra quality"],
  },
  {
    id: "microsoft/mai-image-2.6",
    name: "MAI-Image-2.6",
    provider: "Microsoft AI",
    category: "premium",
    description: "Precision tier image model from Microsoft AI",
    capabilities: ["Precision", "Editing"],
  },
  {
    id: "microsoft/mai-image-2.6-flash",
    name: "MAI-Image-2.6 Flash",
    provider: "Microsoft AI",
    category: "premium",
    description: "Lower-latency, lower-cost MAI-Image variant",
    capabilities: ["Fast", "Low cost"],
  },
  {
    id: "qwen/qwen-image-3-pro",
    name: "Qwen Image 3 Pro",
    provider: "Qwen",
    category: "premium",
    description: "Precise rendering and text-to-image control",
    capabilities: ["Text rendering", "Control"],
  },
  {
    id: "qwen/qwen-image-3",
    name: "Qwen Image 3",
    provider: "Qwen",
    category: "premium",
    description: "Unified image generation and editing",
    capabilities: ["Editing"],
  },
  {
    id: "krea/krea-2-large",
    name: "Krea 2 Large",
    provider: "Krea",
    category: "premium",
    description: "High-capability creative image generation",
    capabilities: ["Creative", "Design"],
  },
  {
    id: "sourceful/riverflow-v2.5-pro",
    name: "Riverflow V2.5 Pro",
    provider: "Sourceful",
    category: "premium",
    description: "Powerful general-purpose image generation",
    capabilities: ["Photorealism", "Composition"],
  },
  {
    id: "meta/muse-image",
    name: "Muse Image",
    provider: "Meta",
    category: "premium",
    description: "Agentic image generation and editing from Meta",
    capabilities: ["Editing", "Composition"],
  },
]
