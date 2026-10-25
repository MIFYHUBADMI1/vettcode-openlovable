/**
 * Market & Grow — AI content briefs and prompt assembly (pure).
 *
 * This module contains NO network, DB, or environment access, so the same
 * vocabulary can be used by the client UI and unit-tested deterministically.
 * The server service turns these prompts into real runtime capability calls
 * (ai.text / ai.image / ai.speech / ai.video) on the project's own identity.
 */

export const MARKET_CONTENT_KINDS = [
  "copy",
  "email",
  "social",
  "timeline",
  "blog",
  "brief",
  "image",
  "voice",
  "video",
] as const

export type MarketContentKind = (typeof MARKET_CONTENT_KINDS)[number]

export const MARKET_TONES = [
  "professional",
  "confident",
  "friendly",
  "bold",
  "playful",
  "warm",
  "technical",
  "urgent",
] as const

export const MARKET_CHANNELS = [
  "instagram",
  "linkedin",
  "x",
  "facebook",
  "tiktok",
  "email",
  "blog",
  "landing_page",
  "whatsapp",
  "sms",
] as const

export const MARKET_LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Portuguese",
  "Arabic",
  "Swahili",
  "Hindi",
  "Chinese",
] as const

export const MARKET_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const
export const MARKET_VIDEO_DURATIONS = [4, 6, 8] as const
export const MARKET_IMAGE_QUALITIES = ["auto", "low", "medium", "high"] as const
export const MARKET_VOICE_STYLES = [
  "warm",
  "confident",
  "energetic",
  "calm",
  "authoritative",
  "friendly",
] as const
export const MARKET_LENGTHS = ["short", "medium", "long"] as const

export type MarketTone = (typeof MARKET_TONES)[number]
export type MarketChannel = (typeof MARKET_CHANNELS)[number]
export type MarketLanguage = (typeof MARKET_LANGUAGES)[number]
export type MarketAspectRatio = (typeof MARKET_ASPECT_RATIOS)[number]
export type MarketVideoDuration = (typeof MARKET_VIDEO_DURATIONS)[number]
export type MarketImageQuality = (typeof MARKET_IMAGE_QUALITIES)[number]
export type MarketVoiceStyle = (typeof MARKET_VOICE_STYLES)[number]
export type MarketLength = (typeof MARKET_LENGTHS)[number]

/** The founder's brief for one studio generation. */
export interface MarketBrief {
  kind: MarketContentKind
  brief: string
  tone?: MarketTone
  language?: MarketLanguage
  channel?: MarketChannel
  channels?: MarketChannel[]
  audience?: string
  length?: MarketLength
  aspectRatio?: MarketAspectRatio
  quality?: MarketImageQuality
  voiceStyle?: MarketVoiceStyle
  durationSeconds?: MarketVideoDuration
  /** Optional pre-written voiceover script (voice kind only). */
  script?: string
}

export interface MarketKindMeta {
  label: string
  shortLabel: string
  description: string
  /** Runtime capability that produces the deliverable. */
  capability: "ai.text" | "ai.image" | "ai.speech" | "ai.video"
  operation: "chat" | "generateImage" | "speak" | "generateVideo"
  media: "text" | "image" | "audio" | "video"
  promptPlaceholder: string
}

export const MARKET_KIND_META: Record<MarketContentKind, MarketKindMeta> = {
  copy: {
    label: "Copy & captions",
    shortLabel: "Copy",
    description: "Headlines, product copy, and short campaign lines.",
    capability: "ai.text",
    operation: "chat",
    media: "text",
    promptPlaceholder: "What are you promoting? Include the product, offer, and the one action you want.",
  },
  email: {
    label: "Email campaign",
    shortLabel: "Email",
    description: "A complete email with subject, preview text, body, and CTA.",
    capability: "ai.text",
    operation: "chat",
    media: "text",
    promptPlaceholder: "Who is this email for and what should it get them to do?",
  },
  social: {
    label: "Social posts",
    shortLabel: "Social",
    description: "Platform-native posts for the channels you choose.",
    capability: "ai.text",
    operation: "chat",
    media: "text",
    promptPlaceholder: "Describe the announcement, launch, or moment you want to post about.",
  },
  timeline: {
    label: "Content timeline",
    shortLabel: "Timeline",
    description: "A practical multi-day content calendar you can execute.",
    capability: "ai.text",
    operation: "chat",
    media: "text",
    promptPlaceholder: "What campaign or launch should the timeline cover?",
  },
  blog: {
    label: "Blog article",
    shortLabel: "Blog",
    description: "A structured article draft with headings you can edit.",
    capability: "ai.text",
    operation: "chat",
    media: "text",
    promptPlaceholder: "What should the article explain, who is it for, and what should they do next?",
  },
  brief: {
    label: "Strategy brief",
    shortLabel: "Brief",
    description: "A concise marketing brief grounded in your project context.",
    capability: "ai.text",
    operation: "chat",
    media: "text",
    promptPlaceholder: "What goal, launch, or audience should the brief cover?",
  },
  image: {
    label: "Image generation",
    shortLabel: "Image",
    description: "A marketing-ready visual generated from your brief.",
    capability: "ai.image",
    operation: "generateImage",
    media: "image",
    promptPlaceholder: "Describe the visual: subject, setting, mood, and what it should communicate.",
  },
  voice: {
    label: "Voiceover",
    shortLabel: "Voice",
    description: "A spoken script generated and performed as audio.",
    capability: "ai.speech",
    operation: "speak",
    media: "audio",
    promptPlaceholder: "What is the voiceover for? A product teaser, ad read, or onboarding message?",
  },
  video: {
    label: "Video generation",
    shortLabel: "Video",
    description: "A short marketing video clip generated from your brief.",
    capability: "ai.video",
    operation: "generateVideo",
    media: "video",
    promptPlaceholder: "Describe the shot: subject, motion, setting, and the feeling to convey.",
  },
}

export function isMarketContentKind(value: string): value is MarketContentKind {
  return (MARKET_CONTENT_KINDS as readonly string[]).includes(value)
}

const LENGTH_GUIDANCE: Record<MarketLength, string> = {
  short: "Keep it tight — a quick read.",
  medium: "Use a balanced length suitable for a normal campaign asset.",
  long: "Give the idea room — go deeper than a one-liner while staying focused.",
}

const KIND_INSTRUCTION: Record<MarketContentKind, string> = {
  copy:
    "Write 4 ready-to-publish copy options. For each option give a short label and 1–2 lines of copy. Keep every line specific to the brief.",
  email:
    "Write one complete marketing email. First line exactly 'Subject: <subject>'. Second line exactly 'Preview: <preview text>'. Then a blank line and the body, ending with ONE clear call to action.",
  social:
    "Write one platform-native post for EACH requested channel, labelled with the channel name. Include relevant hashtags only where the platform expects them. Keep each post under 120 words.",
  timeline:
    "Build a practical 14-day content calendar. Output exactly one line per day in the form 'Day N — <idea> — <channel> — <call to action>'. Mix formats (short video, carousel, text post, email, story) and build toward the campaign goal.",
  blog:
    "Write one complete blog article for this business. Start with a single '# ' H1 line, then 3–5 '## ' sections with short paragraphs. Aim for 600–900 words. Do not invent statistics, studies, quotes, or external sources — if evidence was not supplied, explain the idea without citing anything.",
  brief:
    "Write a concise marketing strategy brief with these labelled sections: Summary, Audience, Customer problem, Value proposition, Objective, Messaging, Channels, Content ideas, Next steps, Assumptions. Keep it practical and under 500 words. Put anything not supplied under Assumptions instead of inventing it.",
  voice:
    "Write a spoken voiceover script of about 20–45 seconds (roughly 50–110 words) in natural spoken language. End with one call to action. Return ONLY the spoken words — no headings, labels, camera directions, or stage notes.",
  image:
    "Describe a single marketing image. Focus on subject, setting, composition, light, colour, and mood. Do not include text overlays.",
  video:
    "Describe one short marketing video shot. Focus on subject, motion, camera, setting, light, and mood. Do not include on-screen text.",
}

/**
 * Build the system + user messages for a text-producing studio kind.
 * Image and video kinds use buildVisualPrompt instead.
 */
export function buildMarketMessages(input: {
  kind: MarketContentKind
  projectName: string
  brandVoice: string
  brief: MarketBrief
}): { system: string; prompt: string } {
  const meta = MARKET_KIND_META[input.kind]
  const brief = clean(input.brief.brief, 2000)
  const tone = input.brief.tone ?? "professional"
  const language = input.brief.language ?? "English"
  const length = input.brief.length ?? "medium"
  const channels =
    input.brief.channels && input.brief.channels.length > 0
      ? input.brief.channels.join(", ")
      : input.brief.channel
        ? input.brief.channel
        : "the channels that best fit the audience"

  const system =
    "You are the marketing engine inside a founder's product workspace. " +
    `${KIND_INSTRUCTION[input.kind]}\n` +
    "Write original, concrete copy in the provided brand voice and requested language. " +
    "Never invent numbers, prices, statistics, rankings, reviews, testimonials, guarantees, or claims about results. " +
    "If a concrete fact is not provided, write around it instead of fabricating it. " +
    "Do not mention that you are an AI. Return only the requested deliverable — no preamble, no markdown fences."

  const parts = [
    `Product: ${clean(input.projectName, 200)}`,
    `Brand voice (derived from this project's plan):\n${clean(input.brandVoice, 2000) || "(none on file — stay neutral and specific to the product)"}`,
    `Requested deliverable: ${meta.label}.`,
    `Language: ${language}`,
    `Tone: ${tone}`,
    `Length: ${length} — ${LENGTH_GUIDANCE[length]}`,
    `Audience: ${clean(input.brief.audience ?? "", 400) || "the product's target users"}`,
    `Channels: ${channels}`,
  ]
  if (brief) parts.push(`Founder brief:\n${brief}`)
  parts.push(`Now write the deliverable. ${KIND_INSTRUCTION[input.kind]}`)

  return { system, prompt: parts.join("\n\n") }
}

/** Build a rich generation prompt for the image/video models. */
export function buildVisualPrompt(input: {
  kind: "image" | "video"
  projectName: string
  brandVoice: string
  brief: MarketBrief
}): string {
  const tone = input.brief.tone ?? "professional"
  const aspect = input.brief.aspectRatio ?? (input.kind === "video" ? "16:9" : "1:1")
  const voice = clean(input.brandVoice, 900)
  const subject = clean(input.brief.brief, 2000)
  const common = [
    `Professional marketing ${input.kind} for the product "${clean(input.projectName, 200)}".`,
    `Subject and scene: ${subject || "a clear, premium product-focused scene"}.`,
    voice ? `Brand and visual direction: ${voice}.` : "",
    `Mood: ${tone}.`,
    `Composition: designed for a ${aspect} frame with a strong focal point and uncluttered space.`,
    "No text overlays, no logos, no watermarks, no user-interface chrome.",
  ].filter(Boolean)

  if (input.kind === "video") {
    const seconds = input.brief.durationSeconds ?? 4
    common.push(
      `One continuous shot, approximately ${seconds} seconds, with subtle natural camera motion and smooth pacing.`,
    )
  }
  return common.join(" ")
}

/** Clean user text: strip control characters, collapse blank runs, bound length. */
export function clean(value: string, max: number): string {
  const normalized = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return normalized.length <= max ? normalized : normalized.slice(0, max)
}

/** Bounded max output tokens for each text asset length. */
export function maxTokensFor(length: MarketLength | undefined): number {
  switch (length) {
    case "short":
      return 350
    case "long":
      return 1_600
    default:
      return 900
  }
}

/** A short, human title for a generated asset. */
export function marketTitle(kind: MarketContentKind, projectName: string): string {
  return `${MARKET_KIND_META[kind].shortLabel} for ${projectName}`
}
