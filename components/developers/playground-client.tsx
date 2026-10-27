"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jsonFetcher } from "@/lib/client/api"
import { formatWhen } from "@/components/runtime-control/format"
import { cn } from "@/lib/utils"
import { ResponseView } from "./playground-response-view"
import { MapsResultView, type MapsCallOutcome } from "./playground-maps-view"
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  FALLBACK_CAPABILITY_OPERATIONS,
  MEDIA_MODEL_CAPABILITIES,
  OPERATION_LABELS,
  RECOMMENDED_MODEL,
  REQUEST_HINTS,
  SIDE_EFFECT_OPERATIONS,
  sampleInputs,
} from "./playground-catalog"

/**
 * Live playground console — makes REAL /api/runtime/v1 calls with a REAL key
 * the user pastes. Calls are billed to credits exactly like SDK traffic. The
 * key lives only in component memory and is sent in the Authorization header
 * of the request being fired; it is never persisted (including in the session
 * log, which stores request bodies without headers).
 *
 * Layout follows the admin/design conventions: a capability rail (the deployment's
 * own registry, from GET /api/runtime/v1), a contextual composer that only shows
 * controls relevant to the selected operation, a response inspector, and a
 * per-project session log. Everything not immediately relevant is collapsed
 * under "Advanced".
 */

interface Availability {
  provider: string | null
  configured: boolean | null
  missingEnvVars: string[]
  operations: { name: string; available: boolean }[]
}

/** GET /api/runtime/v1 — public capability discovery + deployment availability. */
interface CapabilityDiscovery {
  capabilities: { id: string; operations: readonly string[] }[]
  availability: Record<string, Availability>
}

interface CapabilityEntry {
  id: string
  operations: readonly string[]
}

interface RunRecord {
  id: string
  at: number
  ok: boolean
  status: number
  latencyMs: number
  capability: string
  operation: string
  requestId?: string
  requestJson: string
  responseJson: string
  debug: boolean
}

type Tone = "ready" | "setup" | "unwired" | "unknown"

const SAMPLES = sampleInputs()

const HISTORY_KEY_PREFIX = "atai.playground.history.v1:"
const MAX_HISTORY = 40
/** The live inspector keeps the full body so media can be played/previewed. */
const MAX_ACTIVE_BODY = 16_000_000
/** The browser log keeps metadata + text, never multi-megabyte media. */
const STORED_BODY_CAP = 12_000
const STORED_STRING_CAP = 2_000
const MEDIA_KEYS = new Set(["audiobase64", "b64", "b64_json", "base64", "data", "file_data", "dataurl"])

function formatBodyBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function approxBase64Bytes(value: string): number {
  const clean = value.replace(/[\s=]/g, "")
  return Math.floor((clean.length * 3) / 4)
}

/**
 * Replace large binary fields with a readable note before a run is written to
 * localStorage. Audio/image payloads are commonly megabytes and would blow the
 * ~5 MB origin quota after a couple of runs; the in-memory active run keeps
 * the full body for playback and previews.
 */
function compactForStorage(json: string): string {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return json.slice(0, STORED_BODY_CAP)
  }

  const compact = (node: unknown, key: string, depth: number): unknown => {
    if (typeof node === "string") {
      const lowerKey = key.toLowerCase()
      if (node.startsWith("data:") && node.includes(";base64,")) {
        const comma = node.indexOf(",")
        return `${node.slice(0, comma)},[${formatBodyBytes(approxBase64Bytes(node.slice(comma + 1)))} omitted from the saved log]`
      }
      if (MEDIA_KEYS.has(lowerKey) && node.length > 256) {
        return `[${formatBodyBytes(approxBase64Bytes(node))} omitted from the saved log]`
      }
      if (node.length > 4_000 && /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(node)) {
        return `[${formatBodyBytes(approxBase64Bytes(node))} of binary data omitted from the saved log]`
      }
      if (node.length > STORED_BODY_CAP) {
        return `${node.slice(0, STORED_STRING_CAP)}… [${(node.length - STORED_STRING_CAP).toLocaleString()} characters omitted from the saved log]`
      }
      return node
    }
    if (Array.isArray(node)) {
      return depth >= 6 ? node.slice(0, 20) : node.slice(0, 100).map((item) => compact(item, key, depth + 1))
    }
    if (node !== null && typeof node === "object") {
      if (depth >= 6) return "[nested value omitted from the saved log]"
      const out: Record<string, unknown> = {}
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        out[childKey] = compact(child, childKey, depth + 1)
      }
      return out
    }
    return node
  }

  const out = JSON.stringify(compact(value, "", 0), null, 2)
  if (out.length <= STORED_BODY_CAP) return out
  return JSON.stringify(
    {
      note: `Response omitted from the saved log (${out.length.toLocaleString()} characters). Re-run the request to see the full body.`,
    },
    null,
    2,
  )
}

function compactRun(run: RunRecord): RunRecord {
  return {
    ...run,
    requestJson: compactForStorage(run.requestJson),
    responseJson: compactForStorage(run.responseJson),
  }
}

/** The inspector can render the full body; only pathological payloads are replaced. */
function activeBody(json: string): string {
  if (json.length <= MAX_ACTIVE_BODY) return json
  return JSON.stringify(
    {
      note: `Response body is ${formatBodyBytes(json.length)} — too large to render here. Call the API directly to read it.`,
    },
    null,
    2,
  )
}

function toneOf(a: Availability | null | undefined): Tone {
  if (!a) return "unknown"
  if (a.provider === null) return "unwired"
  if (a.configured === false) return "setup"
  return "ready"
}

function toneClass(tone: Tone): string {
  if (tone === "ready") return "bg-emerald-500"
  if (tone === "setup") return "bg-amber-500"
  if (tone === "unwired") return "bg-muted-foreground/40"
  return "bg-border"
}

function opLabel(capability: string, operation: string): string {
  return (
    OPERATION_LABELS[`${capability}/${operation}`] ??
    OPERATION_LABELS[operation] ??
    operation
  )
}

function maskKey(key: string): string {
  const value = key.trim()
  if (!value) return ""
  if (value.length <= 16) return `${value.slice(0, 6)}…`
  return `${value.slice(0, 14)}…${value.slice(-4)}`
}

/** Debug runs echo the raw provider body under `raw`; the inspector shows it separately. */
function splitRaw(json: string): { clean: string; raw: string | null } {
  if (!json) return { clean: "", raw: null }
  try {
    const parsed = JSON.parse(json) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>
      if (typeof record.raw === "string") {
        const { raw, ...rest } = record
        return { clean: JSON.stringify(rest, null, 2), raw }
      }
    }
  } catch {
    /* fall through — show the body verbatim */
  }
  return { clean: json, raw: null }
}

/** Returns a parse problem for the editor, or null when the body is usable. */
function jsonIssue(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid JSON"
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "The input must be a JSON object, e.g. {}"
  }
  return null
}

/**
 * The runtime route caps the whole request body at 256 KB (Phase 11 resource
 * guard), so only short audio clips can be transcribed from the playground.
 * Guard on raw file bytes: base64 inflates ~4/3, leaving room for the JSON
 * envelope under the cap.
 */
const MAX_AUDIO_UPLOAD_BYTES = 170_000

/** Map a file's extension/MIME to the `input_audio.format` the contract wants. */
function audioFormatFromName(name: string, mime: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const byExt: Record<string, string> = {
    wav: "wav", wave: "wav", mp3: "mp3", mpeg: "mp3", flac: "flac",
    ogg: "ogg", opus: "opus", m4a: "m4a", mp4: "m4a", aac: "aac",
    aiff: "aiff", aif: "aiff", webm: "webm", wma: "wma",
  }
  if (byExt[ext]) return byExt[ext]!
  if (mime.includes("wav")) return "wav"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("flac")) return "flac"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("webm")) return "webm"
  return ext || "wav"
}

/** Browser-side ArrayBuffer → base64 (chunked to avoid call-stack limits). */
function arrayBufferToBase64Client(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function PlaygroundClient() {
  const params = useSearchParams()
  const projectId = params.get("project")

  const { data: discovery } = useSWR<CapabilityDiscovery>("/api/runtime/v1", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const [apiKey, setApiKey] = useState("")
  const [capability, setCapability] = useState("ai.text")
  const [operation, setOperation] = useState("chat")
  const [inputText, setInputText] = useState(SAMPLES["ai.text/chat"] ?? "{}")
  const [metadataText, setMetadataText] = useState("{}")
  const [debugMode, setDebugMode] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [filter, setFilter] = useState("")
  // Below lg the rail is a disclosure so the composer stays within thumb reach.
  const [railOpen, setRailOpen] = useState(false)
  const inspectorRef = useRef<HTMLDivElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)
  const [running, setRunning] = useState(false)
  const [activeRun, setActiveRun] = useState<RunRecord | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"data" | "request" | "debug">("data")
  const [dataView, setDataView] = useState<"formatted" | "json">("formatted")
  const [history, setHistory] = useState<RunRecord[]>([])
  const [historyReady, setHistoryReady] = useState(false)
  const [logFilter, setLogFilter] = useState<"all" | "ok" | "failed">("all")
  // Model choice (ai.text chat/completion only): the recommended default or a
  // custom OpenRouter model id. One of the two is required before firing.
  const [modelMode, setModelMode] = useState<"recommended" | "custom">("recommended")
  const [customModel, setCustomModel] = useState("")

  const historyKey = projectId ? `${HISTORY_KEY_PREFIX}${projectId}` : null

  useEffect(() => {
    if (!historyKey) return
    try {
      const raw = localStorage.getItem(historyKey)
      if (raw) setHistory(JSON.parse(raw) as RunRecord[])
    } catch {
      /* a corrupt log starts fresh rather than blocking the console */
    }
    setHistoryReady(true)
  }, [historyKey])

  useEffect(() => {
    if (!historyReady || !historyKey) return
    try {
      localStorage.setItem(historyKey, JSON.stringify(history.slice(0, MAX_HISTORY)))
    } catch {
      /* quota full — the log stays in memory for this tab */
    }
  }, [history, historyReady, historyKey])

  // Discovery-driven registry: GET /api/runtime/v1 is the source of truth; the
  // static snapshot only covers the window before it resolves.
  const capabilities = useMemo<CapabilityEntry[]>(() => {
    if (discovery?.capabilities?.length) {
      return discovery.capabilities
        .filter((c) => c.id !== "test")
        .map((c) => ({ id: c.id, operations: c.operations }))
    }
    return Object.entries(FALLBACK_CAPABILITY_OPERATIONS).map(([id, ops]) => ({ id, operations: ops }))
  }, [discovery])

  const operationsById = useMemo(
    () => Object.fromEntries(capabilities.map((c) => [c.id, c.operations])) as Record<string, readonly string[]>,
    [capabilities],
  )

  const railGroups = useMemo(() => {
    const byId = new Map(capabilities.map((c) => [c.id, c]))
    const used = new Set<string>()
    const groups: { id: string; label: string; items: CapabilityEntry[] }[] = []
    for (const group of CAPABILITY_GROUPS) {
      const items: CapabilityEntry[] = []
      for (const member of group.members) {
        const entry = byId.get(member)
        if (entry) items.push(entry)
      }
      items.forEach((i) => used.add(i.id))
      if (items.length > 0) groups.push({ id: group.id, label: group.label, items })
    }
    const rest = capabilities.filter((c) => !used.has(c.id))
    if (rest.length > 0) groups.push({ id: "more", label: "More", items: rest })
    return groups
  }, [capabilities])

  const readyCount = useMemo(
    () => capabilities.filter((c) => toneOf(discovery?.availability?.[c.id]) === "ready").length,
    [capabilities, discovery],
  )

  const status = discovery?.availability?.[capability] ?? null
  const operations = operationsById[capability] ?? []
  const requestKey = `${capability}/${operation}`
  const shapeHint = REQUEST_HINTS[requestKey]
  const capabilityTone = toneOf(status)
  const opAvailable = status
    ? (status.operations.find((o) => o.name === operation)?.available ?? status.provider !== null)
    : true
  const supportsModel = capability === "ai.text" && (operation === "chat" || operation === "completion")
  const needsMediaModel = MEDIA_MODEL_CAPABILITIES.has(capability)
  const hasSideEffect = SIDE_EFFECT_OPERATIONS.has(requestKey)
  const isTranscribe = capability === "ai.transcribe" && operation === "transcribe"
  const parseIssue = jsonIssue(inputText)
  const metadataIssue = showAdvanced ? jsonIssue(metadataText) : null

  const inspected = activeRun
  // Audio/image bodies are megabytes; parsing them on every composer keystroke
  // would make the console lag. Only re-derive when the inspected run changes.
  const inspectedBody = useMemo(
    () => (inspected ? splitRaw(inspected.responseJson) : { clean: "", raw: null as string | null }),
    [inspected],
  )

  useEffect(() => {
    if (inspectorTab === "debug" && !(activeRun?.debug && inspectedBody.raw)) setInspectorTab("data")
  }, [inspectorTab, activeRun, inspectedBody.raw])

  const stats = useMemo(() => {
    const total = history.length
    const succeeded = history.filter((r) => r.ok).length
    const latencies = history.map((r) => r.latencyMs).sort((a, b) => a - b)
    return {
      total,
      succeeded,
      failed: total - succeeded,
      avg: total > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / total) : null,
      p95: total >= 2 ? latencies[Math.min(latencies.length - 1, Math.floor(total * 0.95))] : null,
    }
  }, [history])

  const visibleHistory = useMemo(() => {
    if (logFilter === "ok") return history.filter((r) => r.ok)
    if (logFilter === "failed") return history.filter((r) => !r.ok)
    return history
  }, [history, logFilter])

  const query = filter.trim().toLowerCase()
  const railGroupsFiltered = useMemo(() => {
    if (!query) return railGroups
    return railGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (c) =>
            c.id.toLowerCase().includes(query) ||
            (CAPABILITY_LABELS[c.id] ?? c.id).toLowerCase().includes(query) ||
            c.operations.some((o) => opLabel(c.id, o).toLowerCase().includes(query)),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [railGroups, query])

  const loadSample = useCallback((cap: string, op: string) => {
    setInputText(SAMPLES[`${cap}/${op}`] ?? "{}")
  }, [])

  function pickCapability(next: string) {
    setCapability(next)
    const ops = operationsById[next] ?? []
    const op = ops[0] ?? "chat"
    setOperation(op)
    loadSample(next, op)
  }

  function pickOperation(next: string) {
    setOperation(next)
    loadSample(capability, next)
  }

  /**
   * Map renders from the response view: a real maps/staticImage call with the
   * same in-memory key, returned to the panel instead of logged. The session
   * log stays a record of what YOU sent, not of every preview fired for you.
   */
  const runMaps = useCallback(
    async (op: string, input: Record<string, unknown>): Promise<MapsCallOutcome> => {
      if (!apiKey.trim()) {
        return { ok: false, error: { message: "Paste an API key above before loading a map." } }
      }
      try {
        const res = await fetch("/api/runtime/v1", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({ capability: "maps", operation: op, input }),
        })
        const body = (await res.json().catch(() => null)) as
          | { ok: true; data: { data?: unknown } }
          | { ok: false; error?: { code?: string; message?: string } }
          | null
        if (res.ok && body?.ok) return { ok: true, data: body.data.data ?? body.data }
        const err = (body as { error?: { code?: string; message?: string } } | null)?.error
        return { ok: false, error: err ?? { message: `Map render failed (${res.status})` } }
      } catch (e) {
        return { ok: false, error: { message: e instanceof Error ? e.message : "Network error" } }
      }
    },
    [apiKey],
  )

  /** Lets a result drive the next request (copy a place id, re-send endpoints). */
  const useInRequest = useCallback((op: string, input: Record<string, unknown>) => {
    setCapability("maps")
    setOperation(op)
    setInputText(JSON.stringify(input, null, 2))
    toast.success(`maps/${op} loaded into the request body`)
  }, [])

  function record(run: RunRecord) {
    setActiveRun(run)
    setInspectorTab("data")
    // Keep the full body for the live inspector; store a media-stripped copy.
    setHistory((h) => [compactRun(run), ...h].slice(0, MAX_HISTORY))
    // Stacked layouts put the response under the composer; bring it into view.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches) {
      requestAnimationFrame(() => {
        inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Your browser blocked clipboard access")
    }
  }

  /**
   * Load a local audio file into the transcribe body as base64, so a tester
   * never has to hand-encode the `input_audio.data` field. Merges into the
   * current body to preserve any extra fields they added (e.g. `language`).
   */
  async function onAudioFile(file: File) {
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      toast.error(
        `That file is ${(file.size / 1024).toFixed(0)} KB — the runtime caps request bodies at 256 KB, so use a short clip (a few seconds of WAV, longer if compressed).`,
      )
      return
    }
    const format = audioFormatFromName(file.name, file.type)
    try {
      const base64 = arrayBufferToBase64Client(await file.arrayBuffer())
      let body: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(inputText) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>
        }
      } catch {
        /* replace an unusable body rather than blocking the upload */
      }
      setInputText(JSON.stringify({ ...body, input_audio: { data: base64, format } }, null, 2))
      toast.success(`Loaded ${file.name} as ${format} — press Send to transcribe.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.")
    }
  }

  async function run() {
    const key = apiKey.trim()
    if (!key) {
      toast.error("Paste an API key first — create one under the API keys tab.")
      return
    }
    if (parseIssue) {
      toast.error("Fix the request body first — it is not valid JSON.")
      return
    }
    let input: unknown = inputText.trim() ? JSON.parse(inputText) : {}
    if (supportsModel) {
      if (modelMode === "custom" && !customModel.trim()) {
        toast.error("Enter a model id, or switch back to the recommended default.")
        return
      }
      const base = input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}
      input = { ...base, model: modelMode === "custom" ? customModel.trim() : RECOMMENDED_MODEL }
    }
    if (needsMediaModel) {
      const body = input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}
      const model = (body as { model?: unknown }).model
      if (typeof model !== "string" || !model.trim()) {
        toast.error(`Set a model for ${capability} — the sample input shows an example.`)
        return
      }
    }
    let metadata: Record<string, unknown> | undefined
    if (showAdvanced && metadataText.trim()) {
      let parsed: unknown
      try {
        parsed = JSON.parse(metadataText)
      } catch {
        toast.error("The Advanced metadata field is not valid JSON.")
        return
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        toast.error("The Advanced metadata field must be a JSON object.")
        return
      }
      metadata = { ...(parsed as Record<string, unknown>) }
    }
    if (debugMode) metadata = { ...(metadata ?? {}), debug: true }

    const requestJson = JSON.stringify(
      {
        capability,
        operation,
        input,
        ...(metadata ? { metadata } : {}),
      },
      null,
      2,
    )
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setRunning(true)
    const started = performance.now()
    try {
      const res = await fetch("/api/runtime/v1", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: requestJson,
      })
      const latencyMs = Math.round(performance.now() - started)
      const body = (await res.json().catch(() => null)) as
        | { ok: true; data: { requestId?: string; data?: unknown } }
        | { ok: false; error?: { code?: string; message?: string } }
        | null

      if (res.ok && body?.ok) {
        const fullJson = JSON.stringify(body.data.data ?? body.data, null, 2)
        record({
          id,
          at: Date.now(),
          ok: true,
          status: res.status,
          latencyMs,
          capability,
          operation,
          requestId: body.data.requestId,
          requestJson,
          responseJson: activeBody(fullJson),
          debug: debugMode,
        })
        toast.success(`${requestKey} → ${res.status} in ${latencyMs} ms`)
      } else {
        const errBody = body as { error?: { code?: string; message?: string } } | null
        record({
          id,
          at: Date.now(),
          ok: false,
          status: res.status,
          latencyMs,
          capability,
          operation,
          requestJson,
          responseJson: JSON.stringify(errBody?.error ?? body, null, 2),
          debug: debugMode,
        })
        if (errBody?.error?.code === "runtime_capability_unavailable") {
          toast.error("No provider is wired for this capability on this deployment — see the rail status.")
        } else if (errBody?.error?.code === "runtime_pricing_unconfigured") {
          toast.error("No pricing rule for this operation yet — an admin must add one under Runtime → Pricing.")
        } else {
          toast.error(errBody?.error?.message ?? `Request failed (${res.status})`)
        }
      }
    } catch (e) {
      record({
        id,
        at: Date.now(),
        ok: false,
        status: 0,
        latencyMs: Math.round(performance.now() - started),
        capability,
        operation,
        requestJson,
        responseJson: e instanceof Error ? e.message : String(e),
        debug: debugMode,
      })
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setRunning(false)
    }
  }

  // Standard console shortcut: ⌘/Ctrl + Enter fires from anywhere in the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (!running) void run()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!projectId) {
    return (
      <div className="rounded-2xl bg-card p-10 text-center shadow-sm ring-1 ring-foreground/10">
        <p className="text-sm font-medium">Select a project to use the playground</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The playground makes real, billed runtime calls with one of your project&apos;s API keys.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Context bar: the three things that must be true before any call ── */}
      <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase sm:basis-auto">
            Credentials
          </span>
          <Input
            aria-label="API key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="atai_development_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-8 min-w-0 flex-1 font-mono md:max-w-xs"
          />
          <Badge variant={apiKey.trim() ? "secondary" : "destructive"} className="max-w-full shrink-0">
            {apiKey.trim() ? "key attached" : "no key"}
            {apiKey.trim() ? <span className="hidden sm:inline"> · {maskKey(apiKey)}</span> : null}
          </Badge>
          <span className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <Badge variant="outline" className="hidden font-mono min-[400px]:inline-flex">
              POST /api/runtime/v1
            </Badge>
            <Badge variant="outline" className="font-mono">
              project {projectId.slice(0, 8)}
            </Badge>
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          The key is held in memory only and sent as the Authorization header of the request you fire — never stored,
          never written to the session log. Real calls consume real credits.
        </p>
      </div>

      <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_minmax(0,24rem)] 2xl:grid-cols-[17rem_minmax(0,1fr)_minmax(0,28rem)]">
        {/* ── Capability rail ── */}
        <aside className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Capabilities
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {readyCount}/{capabilities.length} ready
            </span>
          </div>
          <button
            type="button"
            aria-expanded={railOpen}
            aria-controls="playground-rail"
            onClick={() => setRailOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted lg:hidden"
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted-foreground">Pick: </span>
              {CAPABILITY_LABELS[capability] ?? capability}
            </span>
            <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !railOpen && "-rotate-90")} aria-hidden />
          </button>
          <div id="playground-rail" className={cn("min-w-0", !railOpen && "hidden lg:block")}>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Filter capabilities"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              className="h-7 pl-7 text-base md:text-xs"
            />
          </div>
          <nav aria-label="Runtime capabilities" className="mt-2 max-h-[26rem] overflow-y-auto lg:max-h-none lg:overflow-visible">
            {railGroupsFiltered.length === 0 ? (
              <p className="px-1 py-3 text-xs text-muted-foreground">No capability matches “{filter}”.</p>
            ) : null}
            {railGroupsFiltered.map((group) => (
              <div key={group.id} className="mb-2 last:mb-0">
                <p className="px-1 pb-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70 uppercase">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-px">
                  {group.items.map((c) => {
                    const tone = toneOf(discovery?.availability?.[c.id])
                    const active = c.id === capability
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            pickCapability(c.id)
                            setRailOpen(false)
                          }}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            active ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", toneClass(tone))} aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{CAPABILITY_LABELS[c.id] ?? c.id}</span>
                          <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/70">
                            {c.operations.length}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
          {discovery ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border pt-2 text-[10px] leading-4 text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                ready
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                needs setup
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                unwired
              </span>
            </p>
          ) : (
            <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
              Reading the deployment registry…
            </p>
          )}
          </div>
        </aside>

        {/* ── Composer ── */}
        <section className="min-w-0 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Request</h2>
            <p className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">{requestKey}</p>
          </div>

          {capabilityTone === "unwired" ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-muted-foreground">
                <strong className="text-foreground">
                  {CAPABILITY_LABELS[capability] ?? capability}
                </strong>{" "}
                is in the contract but no production provider is wired — calls return{" "}
                <code className="rounded bg-muted px-1 font-mono">runtime_capability_unavailable</code>.
              </p>
            </div>
          ) : capabilityTone === "setup" && status ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-muted-foreground">
                <strong className="text-foreground">Not configured here:</strong> this deployment is missing{" "}
                <code className="rounded bg-muted px-1 font-mono">
                  {status.missingEnvVars.length > 0 ? status.missingEnvVars.join(", ") : "provider credentials"}
                </code>
                .
              </p>
            </div>
          ) : null}

          {/* Operation picker — chips for short lists, a select for long ones. */}
          <div className="mt-3">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Operation</p>
            {operations.length <= 6 ? (
              <div role="group" aria-label="Operation" className="mt-1.5 flex flex-wrap gap-1">
                {operations.map((o) => {
                  const active = o === operation
                  const wired = status ? (status.operations.find((s) => s.name === o)?.available ?? true) : true
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => pickOperation(o)}
                      aria-pressed={active}
                      title={wired ? `${capability}/${o}` : `${capability}/${o} — no provider wired`}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                        !wired && !active && "opacity-60",
                      )}
                    >
                      {opLabel(capability, o)}
                      {!wired ? <span className="ml-1 text-[10px] opacity-70">· unwired</span> : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <select
                aria-label="Operation"
                className="mt-1.5 h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-base text-foreground md:h-8 md:text-sm"
                value={operation}
                onChange={(e) => pickOperation(e.target.value)}
              >
                {operations.map((o) => {
                  const wired = status ? (status.operations.find((s) => s.name === o)?.available ?? true) : true
                  return (
                    <option key={o} value={o}>
                      {opLabel(capability, o)}
                      {wired ? "" : " — no provider wired"}
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          {/* Contextual controls — only what this operation actually needs. */}
          {supportsModel ? (
            <fieldset className="mt-3 rounded-lg border border-border p-3">
              <legend className="px-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Model (required)
              </legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <label className="flex shrink-0 items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="playground-model"
                    checked={modelMode === "recommended"}
                    onChange={() => setModelMode("recommended")}
                    className="mt-1 size-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">Recommended default</span>
                    <span className="block break-all font-mono text-[11px] text-muted-foreground">{RECOMMENDED_MODEL}</span>
                  </span>
                </label>
                <label className="flex flex-1 items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="playground-model"
                    checked={modelMode === "custom"}
                    onChange={() => setModelMode("custom")}
                    className="mt-1 size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">Custom model</span>
                    <Input
                      aria-label="Custom model id"
                      placeholder="openai/gpt-5.2"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      disabled={modelMode !== "custom"}
                      className="mt-1 h-8 font-mono text-xs"
                    />
                  </span>
                </label>
              </div>
            </fieldset>
          ) : needsMediaModel ? (
            <p className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Model goes in the body.</strong> {capability} requires an OpenRouter
              model id — set <code className="rounded bg-muted px-1 font-mono">&quot;model&quot;</code> below. The sample
              is prefilled with one.
            </p>
          ) : null}

          {shapeHint ? (
            <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
              <span className="font-mono text-[10px] tracking-[0.16em] uppercase">Shape</span> · {shapeHint}
            </p>
          ) : null}

          {/* Body editor */}
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="playground-body" className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Input body
              </label>
              <div className="flex items-center gap-1">
                {isTranscribe ? (
                  <>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*,.wav,.mp3,.flac,.ogg,.opus,.m4a,.webm"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void onAudioFile(f)
                        e.target.value = "" // allow re-picking the same file
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => audioInputRef.current?.click()}
                      title="Load a local audio file into the body as base64 (short clips — the runtime caps bodies at 256 KB)"
                    >
                      <Upload aria-hidden />
                      Upload audio
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => loadSample(capability, operation)}
                  title="Reload the prefilled example for this operation"
                >
                  <RotateCcw aria-hidden />
                  Reset to sample
                </Button>
              </div>
            </div>
            <textarea
              id="playground-body"
              aria-label="Request input JSON"
              aria-invalid={parseIssue ? true : undefined}
              spellCheck={false}
              className={cn(
                "mt-1.5 min-h-40 w-full resize-y rounded-lg border bg-background p-3 font-mono text-base leading-6 text-foreground md:min-h-44 md:text-xs md:leading-5",
                parseIssue ? "border-destructive/60" : "border-border",
              )}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <p role="status" aria-live="polite" className="mt-1 min-h-4 text-[11px]">
              {parseIssue ? (
                <span className="text-destructive">{parseIssue}</span>
              ) : (
                <span className="text-muted-foreground">
                  {inputText.trim() ? "Valid JSON." : "Empty body sends {}."}
                </span>
              )}
            </p>
          </div>

          {hasSideEffect ? (
            <p className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                <strong className="text-foreground">This changes real state.</strong> {requestKey} can send a message,
                write a record, book a meeting or create a charge. The sample uses placeholder targets — edit them
                before sending.
              </span>
            </p>
          ) : null}

          {/* Progressive disclosure */}
          <div className="mt-3 border-t border-border pt-2">
            <button
              type="button"
              aria-expanded={showAdvanced}
              aria-controls="playground-advanced"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", !showAdvanced && "-rotate-90")}
                aria-hidden
              />
              <Wrench className="size-3.5" aria-hidden />
              Advanced
              {!showAdvanced && debugMode ? (
                <Badge variant="secondary" className="ml-1">
                  debug on
                </Badge>
              ) : null}
            </button>
            {showAdvanced ? (
              <div id="playground-advanced" className="mt-2 flex flex-col gap-3">
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                    className="mt-0.5 size-3.5"
                  />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Debug payload</strong> — send{" "}
                    <code className="rounded bg-muted px-1 font-mono">metadata.debug = true</code> so the runtime echoes
                    the raw provider body in a Debug tab. Supported by the maps adapter; capped server-side.
                  </span>
                </label>
                <div>
                  <label
                    htmlFor="playground-metadata"
                    className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase"
                  >
                    Metadata (JSON)
                  </label>
                  <textarea
                    id="playground-metadata"
                    aria-label="Request metadata JSON"
                    spellCheck={false}
                    className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-base leading-6 text-foreground md:text-xs md:leading-5"
                    value={metadataText}
                    onChange={(e) => setMetadataText(e.target.value)}
                  />
                  {metadataIssue ? (
                    <p className="mt-1 text-[11px] text-destructive">{metadataIssue}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Optional attribution/trace fields. Leave as <code className="font-mono">{"{}"}</code> unless you
                      know what a key does.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              onClick={() => void run()}
              disabled={running || !!parseIssue}
              className="w-full md:h-9 md:w-auto"
            >
              {running ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Running…
                </>
              ) : (
                <>
                  <Play aria-hidden />
                  Send request
                </>
              )}
            </Button>
            <span className="hidden text-[11px] text-muted-foreground md:inline">⌘ / Ctrl + Enter</span>
            {!opAvailable && capabilityTone !== "unwired" ? (
              <span className="min-w-0 text-[11px] text-amber-600 dark:text-amber-400">
                {requestKey} has no wired provider — it will fail.
              </span>
            ) : null}
          </div>
        </section>

        {/* ── Inspector ── */}
        <aside
          ref={inspectorRef}
          className="min-w-0 scroll-mt-3 lg:col-span-2 xl:col-span-1 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Response</span>
              {inspected ? (
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {inspected.capability}/{inspected.operation}
                </p>
              ) : null}
            </div>
            {inspected ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
                    inspected.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {inspected.ok ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <AlertTriangle className="size-3" aria-hidden />
                  )}
                  {inspected.status || "network"} {inspected.ok ? "OK" : "failed"}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {inspected.latencyMs} ms
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {formatBodyBytes(inspected.responseJson.length)}
                </span>
              </div>
            ) : null}
          </div>

          {inspected?.requestId ? (
            <div className="mt-2 flex items-center gap-1 rounded-lg border border-border bg-muted/20 px-2 py-1">
              <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                request
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">{inspected.requestId}</code>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label="Copy request id"
                title="Copy request id"
                onClick={() => void copyToClipboard(inspected.requestId ?? "")}
              >
                <Copy aria-hidden />
              </Button>
            </div>
          ) : null}

          {!inspected ? (
            <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No response yet. Pick a capability, check the prefilled body, then send.
            </p>
          ) : (
            <Tabs value={inspectorTab} onValueChange={(v) => setInspectorTab(v as "data" | "request" | "debug")} className="mt-3 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <TabsList variant="default" className="shrink-0">
                  <TabsTrigger value="data">Data</TabsTrigger>
                  <TabsTrigger value="request">Sent</TabsTrigger>
                  {inspected.debug && inspectedBody.raw ? <TabsTrigger value="debug">Debug</TabsTrigger> : null}
                </TabsList>
                <span className="text-[10px] text-muted-foreground">
                  {inspected.ok ? "Normalized result" : "Error envelope"}
                </span>
              </div>

              <TabsContent value="data" className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5">
                  {(["formatted", "json"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDataView(mode)}
                      aria-pressed={dataView === mode}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                        dataView === mode
                          ? "border-transparent bg-muted font-medium text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-auto"
                    onClick={() => void copyToClipboard(inspectedBody.clean)}
                  >
                    <Copy aria-hidden />
                    Copy
                  </Button>
                </div>
                {dataView === "formatted" ? (
                  <div className="rounded-lg p-0.5">
                    {inspected.capability === "maps" ? (
                      <MapsResultView
                        json={inspectedBody.clean}
                        operation={inspected.operation}
                        requestJson={inspected.requestJson}
                        runMaps={runMaps}
                        useInRequest={useInRequest}
                        onCopy={(text) => void copyToClipboard(text)}
                      />
                    ) : (
                      <ResponseView json={inspectedBody.clean} ok={inspected.ok} />
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                    {inspectedBody.clean || "{}"}
                  </pre>
                )}
              </TabsContent>
              <TabsContent value="request" className="flex flex-col gap-3">
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                  {inspected.requestJson}
                </pre>
                <Button type="button" variant="outline" size="xs" onClick={() => void copyToClipboard(inspected.requestJson)}>
                  <Copy aria-hidden />
                  Copy request
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Headers are not shown — the Authorization header is never recorded.
                </p>
              </TabsContent>
              {inspected.debug && inspectedBody.raw ? (
                <TabsContent value="debug" className="flex flex-col gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    Verbatim provider body, capped server-side. Provider payloads are not part of the normalized
                    contract — they appear only because <code className="font-mono">metadata.debug</code> was set.
                  </p>
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                    {inspectedBody.raw}
                  </pre>
                  <Button type="button" variant="outline" size="xs" onClick={() => void copyToClipboard(inspectedBody.raw ?? "")}>
                    <Copy aria-hidden />
                    Copy raw
                  </Button>
                </TabsContent>
              ) : null}
            </Tabs>
          )}
        </aside>
      </div>

      {/* ── Session log ── */}
      <section className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Session log</span>
          <p className="text-[11px] text-muted-foreground">
            {stats.total} run{stats.total === 1 ? "" : "s"} ·{" "}
            <span className="text-emerald-600 dark:text-emerald-400">{stats.succeeded} ok</span> ·{" "}
            <span className={stats.failed > 0 ? "text-destructive" : ""}>{stats.failed} failed</span>
            {stats.avg !== null ? ` · avg ${stats.avg} ms` : ""}
            {stats.p95 !== null ? ` · p95 ${stats.p95} ms` : ""}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(["all", "ok", "failed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setLogFilter(f)}
              aria-pressed={logFilter === f}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                logFilter === f
                  ? "border-transparent bg-muted font-medium text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
          {history.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto"
              onClick={() => {
                setHistory([])
                setActiveRun(null)
              }}
            >
              <Trash2 aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing yet. Runs are kept for this project in your browser only — they never leave it.
          </p>
        ) : visibleHistory.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No {logFilter} runs in this session.</p>
        ) : (
          <ul className="mt-2 max-h-[26rem] divide-y divide-border overflow-y-auto">
            {visibleHistory.map((r) => {
              const selected = activeRun?.id === r.id
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRun(r)
                      setInspectorTab("data")
                    }}
                    className={cn(
                      "flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 overflow-hidden py-1.5 text-left text-xs transition-colors hover:bg-muted/40",
                      selected && "bg-muted/60",
                    )}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", r.ok ? "bg-emerald-500" : "bg-destructive")} aria-hidden />
                    <span className="min-w-0 max-w-full truncate font-mono">
                      {r.capability}/{r.operation}
                    </span>
                    <span className={cn("shrink-0", r.ok ? "text-muted-foreground" : "text-destructive")}>{r.status || "net"}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.latencyMs} ms</span>
                    {r.debug ? (
                      <Badge variant="outline" className="hidden font-mono text-[10px] sm:inline-flex">
                        raw
                      </Badge>
                    ) : null}
                    <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{formatWhen(r.at)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Saved entries keep metadata and text; large audio/image payloads are stripped so {MAX_HISTORY} runs fit in
          browser storage. The live response above keeps the full body.
        </p>
      </section>
    </div>
  )
}
