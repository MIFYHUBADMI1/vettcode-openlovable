"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  Volume2,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Structured viewer for runtime responses.
 *
 * The contract is provider-neutral but not uniform across capabilities. Rather
 * than dumping JSON, the viewer recognises the shapes the runtime actually
 * returns and leads with the useful part:
 *
 *   error        → code, human message, next step
 *   speech       → player, download, model/voice/format metadata
 *   image        → inline preview + download per image
 *   chat/vision  → answer prose, model, finish reason, usage
 *   transcript   → the transcript text
 *   embeddings   → dimensions/count and a bounded vector preview (never a dump)
 *   video job    → job status and polling instructions
 *   everything else → stacked field cards / collapsible JSON
 *
 * It reads the body only — never re-fetches, never executes anything.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
type Rec = { [key: string]: Json }

const COLLAPSE_STRING_LIMIT = 1200

function isRecord(value: Json): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function inlineDataSize(value: string): string | null {
  if (!value.startsWith("data:")) return null
  const comma = value.indexOf(",")
  if (comma < 0) return null
  return `${Math.max(1, Math.round((value.length - comma - 1) / 1024))} KB`
}

function shortLabel(value: Json): string {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`
  if (isRecord(value)) return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`
  return "value"
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Byte length of base64 without allocating the decoded buffer. */
function base64Size(value: string): number {
  const clean = value.replace(/[\s=]/g, "")
  return Math.max(0, Math.floor((clean.length * 3) / 4))
}

function isUsableBase64(value: string): boolean {
  return value.length > 64 && /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(value.trim())
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ""))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

interface AudioMimeParts {
  baseMime: string
  rate: number
  channels: number
  pcm: boolean
}

function parseAudioMime(mimeType: string): AudioMimeParts {
  const baseMime = (mimeType.split(";")[0] || "audio/mpeg").trim().toLowerCase()
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1] ?? 24_000)
  const channels = Number(/channels=(\d+)/i.exec(mimeType)?.[1] ?? 1)
  return {
    baseMime,
    rate: Number.isFinite(rate) && rate >= 8_000 && rate <= 192_000 ? rate : 24_000,
    channels: Number.isFinite(channels) && channels >= 1 && channels <= 8 ? channels : 1,
    pcm: /^audio\/(pcm|l16|x-pcm|raw)$/.test(baseMime),
  }
}

/**
 * OpenRouter speech returns headerless 16-bit PCM for pcm models. Browsers
 * cannot play that as-is, so wrap it in a minimal RIFF/WAVE container — same
 * bytes, now seekable and playable.
 */
function wrapPcmAsWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const bitsPerSample = 16
  const blockAlign = channels * (bitsPerSample / 8)
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, "RIFF")
  view.setUint32(4, 36 + pcm.byteLength, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  write(36, "data")
  view.setUint32(40, pcm.byteLength, true)
  const out = new Uint8Array(44 + pcm.byteLength)
  out.set(new Uint8Array(header), 0)
  out.set(pcm, 44)
  return out
}

interface PlayableAudio {
  src: string | null
  mimeType: string
  bytes: number
  wrappedPcm: boolean
  extension: string
}

function buildPlayableAudio(base64: string, mimeType: string): PlayableAudio {
  const parts = parseAudioMime(mimeType)
  const bytes = base64Size(base64)
  if (!isUsableBase64(base64)) {
    return { src: null, mimeType: parts.baseMime, bytes, wrappedPcm: false, extension: "audio" }
  }
  try {
    if (parts.pcm) {
      const wav = wrapPcmAsWav(base64ToBytes(base64), parts.rate, parts.channels)
      return {
        src: `data:audio/wav;base64,${bytesToBase64(wav)}`,
        mimeType: "audio/wav",
        bytes: wav.byteLength,
        wrappedPcm: true,
        extension: "wav",
      }
    }
    return {
      src: `data:${parts.baseMime};base64,${base64.replace(/\s/g, "")}`,
      mimeType: parts.baseMime,
      bytes,
      wrappedPcm: false,
      extension: parts.baseMime === "audio/mpeg" ? "mp3" : (parts.baseMime.split("/")[1] ?? "audio"),
    }
  } catch {
    return { src: null, mimeType: parts.baseMime, bytes, wrappedPcm: false, extension: "audio" }
  }
}

function omit(value: Rec, keys: readonly string[]): Rec {
  const skip = new Set(keys)
  return Object.fromEntries(Object.entries(value).filter(([key]) => !skip.has(key)))
}

// ─── Shared presentation ────────────────────────────────────────────────────

function Chips({ items }: { items: readonly (string | null | undefined)[] }) {
  const visible = items.filter((item): item is string => Boolean(item))
  if (visible.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1">
      {visible.map((chip) => (
        <li
          key={chip}
          className="max-w-full truncate rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {chip}
        </li>
      ))}
    </ul>
  )
}

function CardHeader({
  icon,
  title,
  detail,
  action,
  tone = "default",
}: {
  icon: ReactNode
  title: string
  detail?: string
  action?: ReactNode
  tone?: "default" | "destructive"
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-2 border-b px-4 py-3",
        tone === "destructive"
          ? "border-destructive/20 bg-destructive/5"
          : "border-border bg-muted/30",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {detail ? <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">{detail}</p> : null}
      </div>
      {action}
    </header>
  )
}

function DownloadLink({ href, filename }: { href: string; filename: string }) {
  return (
    <a
      href={href}
      download={filename}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
    >
      <Download className="size-3.5" aria-hidden />
      Download
    </a>
  )
}

function OmittedNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  )
}

// ─── Generic tree renderer ──────────────────────────────────────────────────

function Disclosure({ label, value }: { label: string; value: Json }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} aria-hidden />
        {label}
      </button>
      {open ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-5">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

function Leaf({ value }: { value: Json }) {
  const [expanded, setExpanded] = useState(true)

  if (value === null) return <span className="font-mono text-[11px] text-muted-foreground">null</span>
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono text-[11px] tabular-nums">{String(value)}</span>
  }
  if (typeof value !== "string") return <Disclosure label={shortLabel(value)} value={value} />

  const data = inlineDataSize(value)
  if (data) return <span className="font-mono text-[11px] text-muted-foreground">inline payload · {data}</span>
  if (looksLikeUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 break-all font-mono text-[11px] text-primary underline-offset-2 hover:underline"
      >
        {value}
        <ExternalLink className="size-3 shrink-0" aria-hidden />
      </a>
    )
  }
  if (value.length > COLLAPSE_STRING_LIMIT) {
    return (
      <div className="flex flex-col gap-1">
        <span className="whitespace-pre-wrap break-words text-[13px] leading-6">
          {expanded ? value : `${value.slice(0, COLLAPSE_STRING_LIMIT)}…`}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn("size-3 transition-transform", !expanded && "-rotate-90")} aria-hidden />
          {expanded ? "Show less" : `Show all · ${value.length.toLocaleString()} characters`}
        </button>
      </div>
    )
  }
  return <span className="whitespace-pre-wrap break-words text-[13px] leading-6">{value}</span>
}

function ValueCards({ items, depth }: { items: readonly Rec[]; depth: number }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={index} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            item {index + 1} / {items.length}
          </div>
          <FieldList value={item} depth={depth} bare />
        </li>
      ))}
    </ol>
  )
}

function FieldList({ value, depth, bare = false }: { value: Rec; depth: number; bare?: boolean }) {
  const entries = Object.entries(value)
  if (entries.length === 0) return <span className="font-mono text-[11px] text-muted-foreground">{"{}"}</span>
  return (
    <dl className={cn("divide-y divide-border", !bare && "rounded-lg border border-border")}>
      {entries.map(([key, nested]) => (
        <div
          key={key}
          className={cn(
            "flex flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:gap-3",
            !bare && "px-2",
          )}
        >
          <dt className="break-words font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase sm:w-40 sm:shrink-0">
            {key}
          </dt>
          <dd className="min-w-0 flex-1">
            <Node value={nested} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Node({ value, depth }: { value: Json; depth: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="font-mono text-[11px] text-muted-foreground">[]</span>
    if (value.every((item) => item === null || typeof item !== "object")) {
      return (
        <ul className="flex flex-wrap gap-1">
          {value.map((item, index) => (
            <li key={index} className="rounded-md bg-muted/40 px-1.5 py-0.5">
              <Leaf value={item} />
            </li>
          ))}
        </ul>
      )
    }
    if (value.every(isRecord)) return <ValueCards items={value as Rec[]} depth={depth + 1} />
    return <Disclosure label={shortLabel(value)} value={value} />
  }
  if (isRecord(value)) {
    if (depth >= 2) return <Disclosure label={shortLabel(value)} value={value} />
    return <FieldList value={value} depth={depth} />
  }
  return <Leaf value={value} />
}

// ─── Capability-aware cards ─────────────────────────────────────────────────

/** Chat/completion/vision normalize to { content, model, finishReason, usage }. */
function AnswerCard({ value }: { value: Rec }) {
  const content = value.content as string
  const consumed = new Set(["content", "model", "finishReason", "usage"])
  const chips: string[] = []
  if (typeof value.model === "string") chips.push(value.model)
  if (typeof value.finishReason === "string") chips.push(`finish ${value.finishReason}`)
  if (isRecord(value.usage)) {
    for (const [key, metric] of Object.entries(value.usage)) {
      if (typeof metric === "number") chips.push(`${key} ${metric.toLocaleString()}`)
    }
  }
  const rest = Object.fromEntries(Object.entries(value).filter(([key]) => !consumed.has(key)))

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <CardHeader icon={<FileText className="size-3.5" />} title="Answer" detail={chips[0]} />
      <div className="flex flex-col gap-3 p-4">
        <p className="whitespace-pre-wrap break-words text-[13px] leading-6">{content}</p>
        <Chips items={chips.slice(1)} />
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={0} /> : null}
      </div>
    </section>
  )
}

function AudioCard({ value }: { value: Rec }) {
  const base64 = typeof value.audioBase64 === "string" ? value.audioBase64 : ""
  const declaredMime = typeof value.mimeType === "string" && value.mimeType ? value.mimeType : "audio/mpeg"
  const audio = useMemo(() => buildPlayableAudio(base64, declaredMime), [base64, declaredMime])

  const chips = [
    typeof value.model === "string" ? value.model : null,
    typeof value.voice === "string" ? `voice ${value.voice}` : null,
    typeof value.format === "string" ? value.format.toUpperCase() : null,
    audio.wrappedPcm ? "PCM → WAV" : audio.mimeType,
    audio.bytes > 0 ? formatBytes(audio.bytes) : null,
    typeof value.generationId === "string" ? value.generationId : null,
  ]
  const rest = omit(value, ["audioBase64", "mimeType", "model", "voice", "format", "bytes", "generationId"])

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <CardHeader
        icon={<Volume2 className="size-3.5" />}
        title="Speech"
        detail={declaredMime}
        action={audio.src ? <DownloadLink href={audio.src} filename={`atai-speech.${audio.extension}`} /> : undefined}
      />
      <div className="flex flex-col gap-3 p-4">
        {audio.src ? (
          <audio controls preload="metadata" src={audio.src} aria-label="Play synthesized speech" className="w-full" />
        ) : (
          <OmittedNote>
            The audio bytes are not in this saved entry (large media is stripped from the browser log). Re-run the
            request to play it — API clients receive the same bytes in <code className="font-mono">audioBase64</code>.
          </OmittedNote>
        )}
        <Chips items={chips} />
        {audio.wrappedPcm ? (
          <p className="text-[11px] leading-5 text-muted-foreground">
            Raw 16-bit PCM was wrapped in a WAV header so the browser can play and seek it. Download keeps the same
            samples.
          </p>
        ) : null}
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={1} /> : null}
      </div>
    </section>
  )
}

interface ImageItem {
  b64: string
  mediaType: string
}

function imageItems(value: Rec): ImageItem[] | null {
  if (Array.isArray(value.images)) {
    const items = value.images
      .filter((item): item is Rec => isRecord(item) && typeof item.b64 === "string")
      .map((item) => ({
        b64: item.b64 as string,
        mediaType: typeof item.mediaType === "string" ? item.mediaType : "image/png",
      }))
    if (items.length > 0) return items
  }
  if (typeof value.dataUrl === "string" && value.dataUrl.startsWith("data:image/")) {
    const comma = value.dataUrl.indexOf(",")
    if (comma > 0) {
      const meta = value.dataUrl.slice(5, comma)
      return [{ b64: value.dataUrl.slice(comma + 1), mediaType: meta.split(";")[0] || "image/png" }]
    }
  }
  return null
}

function ImageCard({ value, items }: { value: Rec; items: ImageItem[] }) {
  const rest = omit(value, ["images", "dataUrl", "model", "count"])
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <CardHeader
        icon={<ImageIcon className="size-3.5" />}
        title={items.length === 1 ? "Generated image" : `${items.length} generated images`}
        detail={typeof value.model === "string" ? value.model : undefined}
      />
      <div className="flex flex-col gap-3 p-4">
        <ul className={cn("grid gap-3", items.length > 1 && "sm:grid-cols-2")}>
          {items.map((item, index) => {
            const usable = isUsableBase64(item.b64)
            const src = usable ? `data:${item.mediaType};base64,${item.b64.replace(/\s/g, "")}` : null
            const extension = (item.mediaType.split("/")[1] ?? "png").split("+")[0] || "png"
            return (
              <li key={index} className="overflow-hidden rounded-lg border border-border bg-muted/20">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`Generated result ${index + 1} of ${items.length}`}
                    className="max-h-80 w-full bg-muted/20 object-contain"
                  />
                ) : (
                  <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">
                    Image bytes are not in this saved entry. Re-run to preview it.
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
                    {item.mediaType} · {formatBytes(base64Size(item.b64))}
                    {items.length > 1 ? ` · ${index + 1}/${items.length}` : ""}
                  </span>
                  {src ? <DownloadLink href={src} filename={`atai-image-${index + 1}.${extension}`} /> : null}
                </div>
              </li>
            )
          })}
        </ul>
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={1} /> : null}
      </div>
    </section>
  )
}

function TranscriptCard({ value }: { value: Rec }) {
  const text = value.text as string
  const chips = [
    typeof value.model === "string" ? value.model : null,
    typeof value.language === "string" ? `language ${value.language}` : null,
    typeof value.duration === "number" ? `${value.duration.toFixed(1)} s` : null,
    typeof value.characters === "number" ? `${value.characters.toLocaleString()} chars` : null,
  ]
  const rest = omit(value, ["text", "model", "language", "duration", "characters"])
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <CardHeader icon={<FileText className="size-3.5" />} title="Transcript" detail={text.length.toLocaleString() + " characters"} />
      <div className="flex flex-col gap-3 p-4">
        <blockquote className="rounded-lg border-l-2 border-primary/40 bg-muted/20 px-3 py-2 text-[13px] leading-6 whitespace-pre-wrap break-words">
          {text}
        </blockquote>
        <Chips items={chips} />
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={1} /> : null}
      </div>
    </section>
  )
}

function EmbeddingCard({ value }: { value: Rec }) {
  const rows = (value.embeddings as Json[])
    .filter(Array.isArray)
    .map((row) => (row as Json[]).filter((n): n is number => typeof n === "number" && Number.isFinite(n)))
    .filter((row) => row.length > 0)
  const dimensions =
    typeof value.dimensions === "number" ? value.dimensions : rows[0] ? rows[0].length : null
  const preview = rows[0]?.slice(0, 8) ?? []
  const rest = omit(value, ["embeddings", "dimensions", "model"])
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <CardHeader
        icon={<Layers className="size-3.5" />}
        title="Embeddings"
        detail={typeof value.model === "string" ? value.model : undefined}
      />
      <div className="flex flex-col gap-3 p-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Vectors</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums">{rows.length.toLocaleString()}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <dt className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Dimensions</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums">{dimensions?.toLocaleString() ?? "—"}</dd>
          </div>
          {typeof value.model === "string" ? (
            <div className="col-span-2 rounded-lg border border-border bg-muted/20 px-3 py-2 sm:col-span-1">
              <dt className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Model</dt>
              <dd className="mt-0.5 truncate font-mono text-[11px]">{value.model}</dd>
            </div>
          ) : null}
        </dl>
        {preview.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Vector 1 preview</p>
            <div className="flex flex-wrap gap-1">
              {preview.map((number, index) => (
                <span key={index} className="rounded-md border border-border bg-muted/20 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                  {number.toFixed(4)}
                </span>
              ))}
              {(rows[0]?.length ?? 0) > preview.length ? (
                <span className="px-1 font-mono text-[10px] text-muted-foreground">
                  +{(rows[0]?.length ?? 0) - preview.length} more
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Full vectors are intentionally not rendered — copy the JSON view for the complete array.
            </p>
          </div>
        ) : null}
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={1} /> : null}
      </div>
    </section>
  )
}

function VideoJobCard({ value }: { value: Rec }) {
  const status = String(value.status)
  const normalized = status.toLowerCase()
  const statusTone =
    normalized === "completed" || normalized === "succeeded"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : normalized === "failed" || normalized === "error"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  const raw = typeof value.raw === "string" ? value.raw : isRecord(value.raw) ? (value.raw as Json) : null
  const rest = omit(value, ["jobId", "status", "raw"])
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <CardHeader
        icon={<Film className="size-3.5" />}
        title="Video job"
        detail={typeof value.jobId === "string" ? value.jobId : undefined}
        action={
          <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase", statusTone)}>
            {status}
          </span>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[11px] leading-5 text-muted-foreground">
          Video generation is asynchronous. Poll the same operation with{" "}
          <code className="rounded bg-muted px-1 font-mono">{`{ "jobId": "${typeof value.jobId === "string" ? value.jobId : "…"}" }`}</code>{" "}
          until the status is terminal.
        </p>
        {raw ? <Disclosure label="Provider job payload" value={raw} /> : null}
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={1} /> : null}
      </div>
    </section>
  )
}

const ERROR_NEXT_STEP: Record<string, string> = {
  runtime_model_unavailable:
    "Pick a model that exists for this capability — the sample input in the composer is a known-working id.",
  runtime_invalid_request: "Adjust the request body using the message above, then send again.",
  runtime_capability_not_allowed: "Use a key whose scopes include this capability, or issue a new key.",
  runtime_provider_not_entitled:
    "This is a platform account problem (the provider has no credits for it). Retrying will not help — an administrator must top up or repoint the provider credential.",
  runtime_provider_rate_limited: "Wait a moment and retry — the upstream provider is throttling requests.",
  runtime_provider_timeout: "The provider took too long. Retry, or reduce the request size.",
  runtime_provider_error: "The upstream provider failed. Retry; if it persists, check the server logs.",
  runtime_capability_unavailable: "No provider is wired for this capability on this deployment.",
  runtime_pricing_unconfigured: "An administrator must add a pricing rule for this operation under Runtime → Pricing.",
  runtime_insufficient_entitlement: "Top up credits, then retry.",
  runtime_billing_unavailable: "Billing could not complete the charge; retry shortly.",
}

function ErrorCard({ value }: { value: Rec }) {
  const inner = isRecord(value.error) ? value.error : value
  const code = typeof inner.code === "string" ? inner.code : "request_failed"
  const message =
    typeof inner.message === "string" && inner.message.trim()
      ? inner.message
      : "The request failed without a message."
  const next = ERROR_NEXT_STEP[code]
  const rest = omit(value, ["code", "message", "error"])

  return (
    <section className="overflow-hidden rounded-xl border border-destructive/30 bg-card" role="alert">
      <CardHeader
        icon={<AlertTriangle className="size-3.5" />}
        title="Request failed"
        tone="destructive"
        action={
          <code className="shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-mono text-[10px] text-destructive">
            {code}
          </code>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] leading-6 text-foreground">{message}</p>
        {next ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase">Next step</span>
            <p className="mt-1">{next}</p>
          </div>
        ) : null}
        {Object.keys(rest).length > 0 ? <FieldList value={rest} depth={1} /> : null}
      </div>
    </section>
  )
}

function detectError(value: Json, ok: boolean | undefined): value is Rec {
  if (!isRecord(value)) return false
  if (ok === false) return true
  const inner = isRecord(value.error) ? value.error : value
  return typeof inner.code === "string" && inner.code.startsWith("runtime_")
}

export function ResponseView({ json, ok }: { json: string; ok?: boolean }) {
  const parsed = useMemo(
    (): { ok: true; value: Json } | { ok: false } => {
      if (!json.trim()) return { ok: true, value: {} }
      try {
        return { ok: true, value: JSON.parse(json) as Json }
      } catch {
        return { ok: false }
      }
    },
    [json],
  )

  const audioBase64 = useMemo(() => {
    if (!parsed.ok || !isRecord(parsed.value)) return ""
    return typeof parsed.value.audioBase64 === "string" ? parsed.value.audioBase64 : ""
  }, [parsed])
  const audioMime = useMemo(() => {
    if (!parsed.ok || !isRecord(parsed.value)) return ""
    return typeof parsed.value.mimeType === "string" ? parsed.value.mimeType : ""
  }, [parsed])
  const images = useMemo(() => {
    if (!parsed.ok || !isRecord(parsed.value)) return null
    return imageItems(parsed.value)
  }, [parsed])

  if (!parsed.ok) {
    // Network failures and HTML error pages arrive as plain text, not JSON.
    if (ok === false) {
      return (
        <ErrorCard
          value={{
            code: "response_not_json",
            message: json.trim().slice(0, 2_000) || "The request failed without a response body.",
          }}
        />
      )
    }
    return (
      <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        This body is not valid JSON (the provider returned text or a truncated payload). Use the JSON tab to read it
        verbatim.
      </p>
    )
  }

  const value = parsed.value
  if (detectError(value, ok)) return <ErrorCard value={value} />

  if (isRecord(value) && (audioBase64 || audioMime.startsWith("audio/"))) return <AudioCard value={value} />
  if (isRecord(value) && images) return <ImageCard value={value} items={images} />
  if (isRecord(value) && typeof value.content === "string" && value.content.length > 0) {
    return <AnswerCard value={value} />
  }
  if (
    isRecord(value) &&
    Array.isArray(value.embeddings) &&
    value.embeddings.some((row) => Array.isArray(row))
  ) {
    return <EmbeddingCard value={value} />
  }
  if (
    isRecord(value) &&
    typeof value.text === "string" &&
    Object.keys(value).every((key) => ["text", "model", "language", "duration", "characters", "usage"].includes(key))
  ) {
    return <TranscriptCard value={value} />
  }
  if (isRecord(value) && typeof value.jobId === "string" && typeof value.status === "string") {
    return <VideoJobCard value={value} />
  }
  return <Node value={value} depth={0} />
}
