"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  Coins,
  Copy,
  Download,
  FileText,
  History,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Mail,
  Megaphone,
  Mic,
  PenLine,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  Video,
  Wand2,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  MARKET_ASPECT_RATIOS,
  MARKET_CHANNELS,
  MARKET_IMAGE_QUALITIES,
  MARKET_KIND_META,
  MARKET_LANGUAGES,
  MARKET_LENGTHS,
  MARKET_TONES,
  MARKET_VIDEO_DURATIONS,
  MARKET_VOICE_STYLES,
  MARKET_CONTENT_KINDS,
  type MarketChannel,
  type MarketContentKind,
} from "@/lib/marketing/studio/market-content"

/**
 * Market & Grow — AI content studio (client).
 *
 * Briefs are executed by the project's own runtime identity on the server:
 * a real project API key when one exists, otherwise the signed-in owner's
 * workspace identity. Every generation is metered and charged by the runtime,
 * so there are no client-side price guesses and no hidden free tier.
 */

interface CapabilityState {
  capability: string
  available: boolean
  provider: string | null
  missingEnvVars: string[]
}

interface StudioState {
  enabled: boolean
  capabilities: CapabilityState[]
  creditsAvailable: number | null
  key: { source: "project_api_key" | "workspace"; label: string }
  textConfigured: boolean
  items: MarketItem[]
}

interface MarketCall {
  requestId: string
  capability: string
  operation: string
  creditsCharged: number
  model?: string
}

interface MarketMedia {
  kind: "image" | "audio" | "video"
  dataUrl?: string
  mimeType?: string
  jobId?: string
  status?: string
  providerOutput?: unknown
  notPersisted?: boolean
}

interface MarketItem {
  id: string
  projectId: string
  kind: MarketContentKind
  title: string
  body: string
  model?: string
  creditsCharged: number
  createdAt: number
  updatedAt: number
  media?: MarketMedia
  runtime: {
    keySource: "project_api_key" | "workspace"
    keyLabel: string
    totalCreditsCharged: number
    calls: MarketCall[]
  }
  brief: {
    brief: string
    tone?: string
    language?: string
    channel?: string
    audience?: string
    aspectRatio?: string
    durationSeconds?: number
    voiceStyle?: string
  }
}

const KIND_ICON: Record<MarketContentKind, LucideIcon> = {
  copy: PenLine,
  email: Mail,
  social: Share2,
  timeline: CalendarDays,
  blog: BookOpen,
  brief: Megaphone,
  image: ImageIcon,
  voice: Mic,
  video: Video,
}

const KIND_ORDER = MARKET_CONTENT_KINDS

function requiredCapabilities(kind: MarketContentKind): string[] {
  const primary = MARKET_KIND_META[kind].capability
  return kind === "voice" ? ["ai.text", primary] : [primary]
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US")
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

/** Pull a playable/downloadable URL out of an untrusted provider job payload. */
function findMediaUrl(value: unknown, depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) return null
  if (typeof value === "string") {
    if (!/^https?:\/\//i.test(value)) return null
    return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(value) || /video/i.test(value) ? value : null
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findMediaUrl(entry, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["url", "video_url", "download_url", "output", "result", "data"]) {
      if (key in record) {
        const found = findMediaUrl(record[key], depth + 1)
        if (found) return found
      }
    }
  }
  return null
}

export function MarketStudio({
  projectId,
  projectName,
  enabled,
}: {
  projectId: string
  projectName: string
  enabled: boolean
}) {
  const [state, setState] = useState<StudioState | null>(null)
  const [loadingState, setLoadingState] = useState(true)
  const [stateError, setStateError] = useState<string | null>(null)
  const [kind, setKind] = useState<MarketContentKind>("copy")
  const [brief, setBrief] = useState("")
  const [tone, setTone] = useState<string>("professional")
  const [language, setLanguage] = useState<string>("English")
  const [channel, setChannel] = useState<MarketChannel>("instagram")
  const [channels, setChannels] = useState<MarketChannel[]>(["instagram", "linkedin"])
  const [audience, setAudience] = useState("")
  const [length, setLength] = useState<string>("medium")
  const [aspectRatio, setAspectRatio] = useState<string>("1:1")
  const [quality, setQuality] = useState<string>("medium")
  const [voiceStyle, setVoiceStyle] = useState<string>("warm")
  const [duration, setDuration] = useState<number>(4)
  const [script, setScript] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MarketItem | null>(null)
  const [polling, setPolling] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const resultRef = useRef<HTMLDivElement | null>(null)

  const loadState = useCallback(
    async (quiet: boolean) => {
      if (!quiet) setLoadingState(true)
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/market/studio`, {
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message || "Couldn't load the content studio.")
        }
        setState(json.data as StudioState)
        setStateError(null)
      } catch (e) {
        setStateError(e instanceof Error ? e.message : "Couldn't load the content studio.")
      } finally {
        if (!quiet) setLoadingState(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    void loadState(false)
  }, [loadState])

  const meta = MARKET_KIND_META[kind]
  const readiness = new Map((state?.capabilities ?? []).map((row) => [row.capability, row]))
  const kindReady = requiredCapabilities(kind).every((capability) => readiness.get(capability)?.available)
  const missingEnv = Array.from(
    new Set(
      (state?.capabilities ?? [])
        .filter((row) => !row.available)
        .flatMap((row) => row.missingEnvVars),
    ),
  )
  const outOfCredits = state?.creditsAvailable !== null && state?.creditsAvailable !== undefined && state.creditsAvailable <= 0
  const canGenerate =
    enabled &&
    Boolean(state?.enabled) &&
    kindReady &&
    !generating &&
    !outOfCredits &&
    (brief.trim().length > 0 || (kind === "voice" && script.trim().length > 0))

  function resetForKind(next: MarketContentKind) {
    setKind(next)
    setError(null)
    if (next === "image") setAspectRatio("1:1")
    if (next === "video") setAspectRatio("16:9")
  }

  function toggleChannel(value: MarketChannel) {
    setChannels((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    )
  }

  async function generate() {
    if (!canGenerate) return
    setGenerating(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        action: "generate",
        kind,
        brief: brief.trim(),
        tone,
        language,
      }
      if (audience.trim()) payload.audience = audience.trim()
      if (kind === "social") {
        payload.channels = channels.length > 0 ? channels : [channel]
      } else if (kind === "copy" || kind === "timeline") {
        payload.channel = channel
      }
      if (kind === "copy" || kind === "email" || kind === "social" || kind === "timeline") {
        payload.length = length
      }
      if (kind === "image") {
        payload.aspectRatio = aspectRatio
        payload.quality = quality
      }
      if (kind === "video") {
        payload.aspectRatio = aspectRatio
        payload.durationSeconds = duration
      }
      if (kind === "voice") {
        payload.voiceStyle = voiceStyle
        if (script.trim()) payload.script = script.trim()
      }

      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/market/studio`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code as string | undefined
        const message = json?.error?.message as string | undefined
        throw new Error(
          code === "INSUFFICIENT_CREDITS" || code === "runtime_insufficient_entitlement"
            ? message || "Not enough credits for this generation. Add credits and try again."
            : message || "Generation failed. Please try again.",
        )
      }
      const item = json.data as MarketItem
      setResult(item)
      setState((current) =>
        current
          ? {
              ...current,
              items: [item, ...current.items.filter((entry) => entry.id !== item.id)].slice(0, 30),
              creditsAvailable:
                current.creditsAvailable === null
                  ? null
                  : Math.max(0, current.creditsAvailable - item.creditsCharged),
            }
          : current,
      )
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }))
      void loadState(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function openItem(id: string) {
    setOpeningId(id)
    setError(null)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/market/studio?contentId=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Couldn't open this asset.")
      setResult(json.data as MarketItem)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this asset.")
    } finally {
      setOpeningId(null)
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/market/studio?contentId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Couldn't delete this asset.")
      setState((current) =>
        current ? { ...current, items: current.items.filter((entry) => entry.id !== id) } : current,
      )
      setResult((current) => (current?.id === id ? null : current))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this asset.")
    } finally {
      setDeletingId(null)
    }
  }

  async function pollVideo() {
    if (!result || result.kind !== "video") return
    setPolling(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/market/studio`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pollVideo", contentId: result.id }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Couldn't check the video job.")
      const item = json.data as MarketItem
      setResult(item)
      setState((current) =>
        current
          ? {
              ...current,
              items: current.items.map((entry) => (entry.id === item.id ? item : entry)),
              creditsAvailable:
                current.creditsAvailable === null
                  ? null
                  : Math.max(0, current.creditsAvailable - Math.max(0, item.creditsCharged - result.creditsCharged)),
            }
          : current,
      )
      void loadState(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the video job.")
    } finally {
      setPolling(false)
    }
  }

  async function copyBody() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError("Your browser blocked clipboard access.")
    }
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-5xl px-6 pb-4" aria-label="AI content studio">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wand2 aria-hidden className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">AI content studio</h2>
                <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
                  Create copy, emails, social posts, timelines, images, voiceovers, and videos. Every
                  generation runs through this project&apos;s own runtime and is charged from its credit
                  balance.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                <KeyRound aria-hidden className="size-3" />
                {state?.key.source === "project_api_key" ? "Project API key" : "Workspace session"}
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
                title={state?.key.label}
              >
                <Coins aria-hidden className="size-3" />
                {state?.creditsAvailable === null || state?.creditsAvailable === undefined
                  ? "Balance unavailable"
                  : `${formatNumber(state.creditsAvailable)} credits`}
              </span>
            </div>
          </div>
          {state?.key.label ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Runtime identity: <span className="font-mono">{state.key.label}</span>
            </p>
          ) : null}
        </header>

        <div className="p-5">
          {!enabled ? (
            <Notice tone="amber" title="The AI content studio is turned off">
              An operator disabled this surface with <code>MARKET_STUDIO_ENABLED=false</code>.
            </Notice>
          ) : null}

          {missingEnv.length > 0 ? (
            <Notice tone="amber" title="Some AI capabilities are not configured on this deployment">
              Missing server configuration: <span className="font-mono">{missingEnv.join(", ")}</span>. The
              affected studio tabs stay disabled until the operator adds it.
            </Notice>
          ) : null}

          {stateError ? (
            <Notice tone="red" title="Studio unavailable">
              {stateError}
            </Notice>
          ) : null}

          {/* Kind tabs */}
          <div
            className="mt-1 flex gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Content type"
          >
            {KIND_ORDER.map((entry) => {
              const Icon = KIND_ICON[entry]
              const ready = requiredCapabilities(entry).every(
                (capability) => readiness.get(capability)?.available,
              )
              const active = kind === entry
              return (
                <button
                  key={entry}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={!ready}
                  title={ready ? MARKET_KIND_META[entry].description : "Not configured on this deployment"}
                  onClick={() => resetForKind(entry)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    !ready && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Icon aria-hidden className="size-3.5" />
                  {MARKET_KIND_META[entry].shortLabel}
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* Brief form */}
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void generate()
              }}
            >
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium">{meta.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.description}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-brief">Brief</Label>
                <Textarea
                  id="market-brief"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder={meta.promptPlaceholder}
                  maxLength={2000}
                  rows={4}
                  className="min-h-24 resize-y"
                />
                <p className="text-right text-[10px] text-muted-foreground">{brief.length}/2000</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tone" htmlFor="market-tone">
                  <select
                    id="market-tone"
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    className={selectClass}
                  >
                    {MARKET_TONES.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Language" htmlFor="market-language">
                  <select
                    id="market-language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className={selectClass}
                  >
                    {MARKET_LANGUAGES.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {kind === "social" ? (
                <Field label="Channels" htmlFor="market-channels">
                  <div id="market-channels" className="flex flex-wrap gap-1.5">
                    {MARKET_CHANNELS.map((entry) => {
                      const active = channels.includes(entry)
                      return (
                        <button
                          key={entry}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleChannel(entry)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            active
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {entry}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              ) : kind === "copy" || kind === "timeline" ? (
                <Field label="Primary channel" htmlFor="market-channel">
                  <select
                    id="market-channel"
                    value={channel}
                    onChange={(event) => setChannel(event.target.value as MarketChannel)}
                    className={selectClass}
                  >
                    {MARKET_CHANNELS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {kind === "copy" || kind === "email" || kind === "social" || kind === "timeline" ? (
                <Field label="Length" htmlFor="market-length">
                  <select
                    id="market-length"
                    value={length}
                    onChange={(event) => setLength(event.target.value)}
                    className={selectClass}
                  >
                    {MARKET_LENGTHS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {kind === "image" || kind === "video" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Aspect ratio" htmlFor="market-aspect">
                    <select
                      id="market-aspect"
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value)}
                      className={selectClass}
                    >
                      {MARKET_ASPECT_RATIOS.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {kind === "image" ? (
                    <Field label="Quality" htmlFor="market-quality">
                      <select
                        id="market-quality"
                        value={quality}
                        onChange={(event) => setQuality(event.target.value)}
                        className={selectClass}
                      >
                        {MARKET_IMAGE_QUALITIES.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Duration" htmlFor="market-duration">
                      <select
                        id="market-duration"
                        value={duration}
                        onChange={(event) => setDuration(Number(event.target.value))}
                        className={selectClass}
                      >
                        {MARKET_VIDEO_DURATIONS.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry} seconds
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              ) : null}

              {kind === "voice" ? (
                <>
                  <Field label="Voice style" htmlFor="market-voice">
                    <select
                      id="market-voice"
                      value={voiceStyle}
                      onChange={(event) => setVoiceStyle(event.target.value)}
                      className={selectClass}
                    >
                      {MARKET_VOICE_STYLES.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Optional script (leave blank to write one)"
                    htmlFor="market-script"
                  >
                    <Textarea
                      id="market-script"
                      value={script}
                      onChange={(event) => setScript(event.target.value)}
                      placeholder="Paste a script to perform it as-is, or leave this blank and the studio will write one from your brief."
                      maxLength={4000}
                      rows={3}
                    />
                  </Field>
                </>
              ) : null}

              <Field label="Audience (optional)" htmlFor="market-audience">
                <Input
                  id="market-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder={`Who should this ${meta.shortLabel.toLowerCase()} speak to?`}
                  maxLength={400}
                />
              </Field>

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={!canGenerate} className="gap-1.5">
                  {generating ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <Sparkles aria-hidden />
                  )}
                  {generating ? "Generating…" : `Generate ${meta.shortLabel.toLowerCase()}`}
                </Button>
                {!kindReady ? (
                  <span className="text-[11px] text-muted-foreground">
                    This capability isn&apos;t configured on this deployment.
                  </span>
                ) : outOfCredits ? (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    No credits left. Add credits to generate.
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Charged from this project&apos;s balance per runtime call.
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Generation uses this project&apos;s runtime identity automatically.{" "}
                {state?.key.source === "project_api_key"
                  ? "Usage is attributed to the selected project API key."
                  : "No project API key was found, so the workspace session is used. Create a key in the developer page to attribute usage to it."}
              </p>
            </form>

            {/* Result */}
            <div ref={resultRef} className="min-w-0">
              <div className="rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <History aria-hidden className="size-4 text-muted-foreground" />
                    <h3 className="text-xs font-medium">Latest result</h3>
                  </div>
                  {result ? (
                    <div className="flex items-center gap-1">
                      <span className="mr-1 text-[10px] text-muted-foreground">
                        {formatNumber(result.creditsCharged)} credits
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void copyBody()}
                        title="Copy text"
                        aria-label="Copy text"
                      >
                        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void deleteItem(result.id)}
                        disabled={deletingId === result.id}
                        title="Delete asset"
                        aria-label="Delete asset"
                      >
                        {deletingId === result.id ? (
                          <Loader2 aria-hidden className="animate-spin" />
                        ) : (
                          <Trash2 aria-hidden />
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="p-4">
                  {!result ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 py-10 text-center">
                      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles aria-hidden className="size-5" />
                      </span>
                      <p className="mt-3 text-sm font-medium">Your studio output appears here</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Pick a format, write a brief, and generate. Text, images, audio, and video are
                        rendered with previews and download controls.
                      </p>
                    </div>
                  ) : (
                    <ResultBody
                      item={result}
                      polling={polling}
                      onPoll={() => void pollVideo()}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History aria-hidden className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Recent creations</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {state?.items.length ?? 0} saved asset{state?.items.length === 1 ? "" : "s"}
              </span>
            </div>

            {loadingState && !state ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((entry) => (
                  <div key={entry} className="h-20 animate-pulse rounded-lg bg-muted/30" />
                ))}
              </div>
            ) : (state?.items.length ?? 0) === 0 ? (
              <p className="mt-3 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                Nothing created yet. Generate your first asset above — it will be saved here for this
                project.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {state?.items.map((item) => {
                  const Icon = KIND_ICON[item.kind] ?? FileText
                  const active = result?.id === item.id
                  return (
                    <li key={item.id}>
                      <div
                        className={cn(
                          "flex h-full flex-col gap-2 rounded-lg border p-3 transition-colors",
                          active ? "border-primary/40 bg-primary/5" : "border-border bg-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-medium">
                            <Icon aria-hidden className="size-3.5 text-muted-foreground" />
                            {MARKET_KIND_META[item.kind]?.shortLabel ?? item.kind}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatNumber(item.creditsCharged)} cr
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void openItem(item.id)}
                          className="line-clamp-2 text-left text-xs text-foreground hover:underline"
                          disabled={openingId === item.id}
                        >
                          {item.title}
                        </button>
                        <div className="mt-auto flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>{formatWhen(item.createdAt)}</span>
                          <span className="flex items-center gap-1">
                            {openingId === item.id ? (
                              <Loader2 aria-hidden className="size-3 animate-spin" />
                            ) : (
                              <Megaphone aria-hidden className="size-3" />
                            )}
                            {item.media?.kind ?? "text"}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

const selectClass =
  "h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  )
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "amber" | "red"
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
        tone === "red"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-amber-500/25 bg-amber-500/5 text-muted-foreground",
      )}
      role="status"
    >
      <AlertCircle
        aria-hidden
        className={cn("mt-0.5 size-3.5 shrink-0", tone === "amber" && "text-amber-600 dark:text-amber-400")}
      />
      <span>
        <strong className={tone === "amber" ? "text-foreground" : undefined}>{title}.</strong> {children}
      </span>
    </div>
  )
}

function ResultBody({
  item,
  polling,
  onPoll,
}: {
  item: MarketItem
  polling: boolean
  onPoll: () => void
}) {
  const videoUrl = item.media?.providerOutput ? findMediaUrl(item.media.providerOutput) : null
  const kindLabel = MARKET_KIND_META[item.kind]?.label ?? item.kind

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium">{kindLabel}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatWhen(item.createdAt)}
            {item.model ? ` · ${item.model}` : ""}
            {` · ${item.runtime.keySource === "project_api_key" ? "project API key" : "workspace session"}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {item.media?.dataUrl ? (
            <a
              href={item.media.dataUrl}
              download={`${item.id}.${item.media.kind === "image" ? "webp" : "mp3"}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Download aria-hidden className="size-3.5" />
              Download
            </a>
          ) : null}
          {item.media?.notPersisted ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              Media too large to store — download now
            </span>
          ) : null}
        </div>
      </div>

      {item.kind === "image" && item.media?.dataUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.media.dataUrl}
            alt={`Generated marketing image: ${item.brief.brief.slice(0, 120)}`}
            className="h-auto w-full object-contain"
          />
        </div>
      ) : null}

      {item.kind === "voice" && item.media?.dataUrl ? (
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <audio controls src={item.media.dataUrl} className="w-full">
            Your browser does not support audio playback.
          </audio>
        </div>
      ) : null}

      {item.kind === "video" ? (
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Video aria-hidden className="size-4 text-muted-foreground" />
              <span className="font-medium">Job status: {item.media?.status ?? "submitted"}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPoll}
              disabled={polling}
              className="gap-1"
            >
              {polling ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
              {polling ? "Checking…" : "Check status"}
            </Button>
          </div>
          {videoUrl ? (
            <video controls src={videoUrl} className="mt-3 w-full rounded-lg">
              <track kind="captions" />
            </video>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Video generation is asynchronous. Checking the status is itself a runtime call and is
              charged from your balance; keep checking until the provider returns a finished clip.
            </p>
          )}
          {item.media?.jobId ? (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">job {item.media.jobId}</p>
          ) : null}
          {item.media?.providerOutput ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                Provider job output
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[10px] text-muted-foreground">
                {JSON.stringify(item.media.providerOutput, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {item.kind !== "image" && item.kind !== "video" ? (
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
            {item.body}
          </pre>
        </div>
      ) : item.kind === "image" ? (
        <details>
          <summary className="cursor-pointer text-[11px] text-muted-foreground">Generation prompt</summary>
          <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{item.body}</p>
        </details>
      ) : null}

      {item.brief.brief ? (
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Your brief</p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] text-foreground">{item.brief.brief}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span>{item.runtime.calls.length} runtime call{item.runtime.calls.length === 1 ? "" : "s"}</span>
        <span>{formatNumber(item.runtime.totalCreditsCharged)} credits charged</span>
        <span title={item.runtime.keyLabel}>{item.runtime.keyLabel}</span>
      </div>
    </div>
  )
}
