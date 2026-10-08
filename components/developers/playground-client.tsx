"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatWhen } from "@/components/runtime-control/format"

/**
 * Live playground — makes REAL /api/runtime/v1 calls with a REAL key the user
 * pastes. Calls are billed to credits exactly like SDK traffic (decided with
 * the product owner). The key never leaves the browser's memory except inside
 * the Authorization header of the request being run; it is never stored.
 */

interface RunResult {
  id: number
  at: number
  ok: boolean
  status: number
  latencyMs: number
  requestId?: string
  summary: string
  responseJson?: string
}

/** The platform-recommended default — mirrors RECOMMENDED_DEFAULT_MODEL in the OpenRouter adapter. */
const RECOMMENDED_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"

/** The registry subset exposed here mirrors runtime/contracts/router.ts. */
const CAPABILITY_OPERATIONS: Record<string, readonly string[]> = {
  "ai.text": ["chat", "completion", "embed"],
  "ai.embed": ["embed"],
  "ai.speak": ["synthesize"],
  // Multimodal wave — OpenRouter full modality coverage.
  "ai.image": ["generateImage"],
  "ai.video": ["generateVideo"],
  "ai.speech": ["speak"],
  "ai.transcribe": ["transcribe"],
  "ai.vision": ["visionInput"],
  "search.web": ["web"],
  "web.scrape": ["scrape"],
  "email": ["send"],
  "sms": ["send"],
  "whatsapp": ["send"],
  "notifications": ["send"],
  "maps": ["geocode", "reverseGeocode"],
  "calendar": ["listBookings", "createBooking"],
  "vectors": ["upsert", "search", "delete"],
  "db": ["query", "create", "edit", "delete"],
  "payments": ["createCheckout"],
}

const SAMPLE_INPUTS: Record<string, string> = {
  "ai.text/chat": JSON.stringify({ messages: [{ role: "user", content: "Say hello in one short sentence." }] }, null, 2),
  "ai.text/embed": JSON.stringify({ input: "hello world" }, null, 2),
  "ai.embed/embed": JSON.stringify({ input: "hello world" }, null, 2),
  "search.web/web": JSON.stringify({ query: "best coffee in Kampala", limit: 3 }, null, 2),
  "web.scrape/scrape": JSON.stringify({ url: "https://example.com" }, null, 2),
  "maps/geocode": JSON.stringify({ query: "Kampala", limit: 3 }, null, 2),
  // Multimodal samples — models shown are OpenRouter examples; switch freely.
  "ai.image/generateImage": JSON.stringify({ prompt: "A red panda astronaut floating in space", model: "google/gemini-2.5-flash-image", aspect_ratio: "16:9" }, null, 2),
  "ai.video/generateVideo": JSON.stringify({ prompt: "A timelapse of a city skyline at dusk", model: "google/veo-3", duration: 5 }, null, 2),
  "ai.speech/speak": JSON.stringify({ input: "Hello from Atai!", model: "openai/gpt-4o-mini-tts-2025-12-15", voice: "alloy", response_format: "mp3" }, null, 2),
  "ai.transcribe/transcribe": JSON.stringify({ input_audio: { data: "<base64 audio>", format: "wav" }, model: "openai/whisper-large-v3" }, null, 2),
  "ai.vision/visionInput": JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: "Describe this image." }, { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } }] }] }, null, 2),
}

/** Capabilities that generate media and need a specific model (chat uses the model chooser instead). */
const MEDIA_MODEL_CAPABILITIES = new Set(["ai.image", "ai.video", "ai.speech", "ai.transcribe"])

export function PlaygroundClient() {
  const params = useSearchParams()
  const projectId = params.get("project")

  const [apiKey, setApiKey] = useState("")
  const [capability, setCapability] = useState("ai.text")
  const [operation, setOperation] = useState("chat")
  const [inputText, setInputText] = useState(SAMPLE_INPUTS["ai.text/chat"] ?? "{}")
  const [running, setRunning] = useState(false)
  const [runs, setRuns] = useState<RunResult[]>([])
  // Model choice (ai.text chat/completion only): use the platform-recommended
  // default, or configure a custom OpenRouter model id. One of the two is
  // always required before a chat/completion request can fire.
  const [modelMode, setModelMode] = useState<"recommended" | "custom">("recommended")
  const [customModel, setCustomModel] = useState("")

  const supportsModel = capability === "ai.text" && (operation === "chat" || operation === "completion")
  const needsMediaModel = MEDIA_MODEL_CAPABILITIES.has(capability)

  const operations = CAPABILITY_OPERATIONS[capability] ?? []
  const stats = useMemo(() => {
    const total = runs.length
    const succeeded = runs.filter((r) => r.ok).length
    const latencies = runs.map((r) => r.latencyMs)
    const avg = total > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / total) : null
    const p95 =
      total >= 2
        ? latencies.slice().sort((a, b) => a - b)[Math.min(latencies.length - 1, Math.floor(total * 0.95))]
        : null
    return { total, succeeded, failed: total - succeeded, avg, p95 }
  }, [runs])

  function pickCapability(next: string) {
    setCapability(next)
    const ops = CAPABILITY_OPERATIONS[next] ?? []
    const op = ops[0] ?? "chat"
    setOperation(op)
    setInputText(SAMPLE_INPUTS[`${next}/${op}`] ?? "{}")
  }

  function pickOperation(next: string) {
    setOperation(next)
    setInputText(SAMPLE_INPUTS[`${capability}/${next}`] ?? "{}")
  }

  async function run() {
    const key = apiKey.trim()
    if (!key) {
      toast.error("Paste an API key first — create one under the API keys tab.")
      return
    }
    let input: unknown = {}
    if (inputText.trim()) {
      try {
        input = JSON.parse(inputText)
      } catch {
        toast.error("Input is not valid JSON.")
        return
      }
    }
    // Model is REQUIRED for chat/completion: either the recommended default
    // or a configured custom model. A model left in an invalid custom state
    // is caught here — before any network call.
    if (supportsModel) {
      if (modelMode === "custom" && !customModel.trim()) {
        toast.error("Enter a model id, or switch back to the recommended default.")
        return
      }
      const base = input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}
      input = {
        ...base,
        model: modelMode === "custom" ? customModel.trim() : RECOMMENDED_MODEL,
      }
    }
    // Media capabilities (image/video/speech/transcribe) require a specific
    // model — validate one is present before any network call.
    if (needsMediaModel) {
      const body = input !== null && typeof input === "object" && !Array.isArray(input) ? input : {}
      const model = (body as { model?: unknown }).model
      if (typeof model !== "string" || !model.trim()) {
        toast.error(`Set a model for ${capability} — see the sample input for an example.`)
        return
      }
    }

    setRunning(true)
    const started = performance.now()
    try {
      const res = await fetch("/api/runtime/v1", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ capability, operation, input }),
      })
      const latencyMs = Math.round(performance.now() - started)
      const body = (await res.json().catch(() => null)) as
        | { ok: true; data: { requestId?: string; data?: unknown } }
        | { ok: false; error?: { code?: string; message?: string } }
        | null

      if (res.ok && body?.ok) {
        const data = body.data
        setRuns((r) => [
          {
            id: Date.now(),
            at: Date.now(),
            ok: true,
            status: res.status,
            latencyMs,
            requestId: data.requestId,
            summary: `${capability}/${operation} · ${res.status}`,
            responseJson: JSON.stringify(data.data ?? data, null, 2).slice(0, 4000),
          },
          ...r,
        ])
        toast.success(`Success — ${latencyMs} ms`)
      } else {
        const errBody = body as { error?: { code?: string; message?: string } } | null
        const summary = `${capability}/${operation} · ${res.status}${errBody?.error?.code ? ` ${errBody.error.code}` : ""}`
        setRuns((r) => [
          {
            id: Date.now(),
            at: Date.now(),
            ok: false,
            status: res.status,
            latencyMs,
            summary,
            responseJson: JSON.stringify(errBody?.error ?? body, null, 2).slice(0, 4000),
          },
          ...r,
        ])
        toast.error(errBody?.error?.message ?? `Request failed (${res.status})`)
      }
    } catch (e) {
      const latencyMs = Math.round(performance.now() - started)
      setRuns((r) => [
        {
          id: Date.now(),
          at: Date.now(),
          ok: false,
          status: 0,
          latencyMs,
          summary: "network error",
          responseJson: String(e),
        },
        ...r,
      ])
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setRunning(false)
    }
  }

  if (!projectId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium">Select a project to use the playground</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The playground makes real, billed runtime calls with one of your project's API keys.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Credentials</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a real key (atai_development_… / atai_production_…). It is used only for the requests you fire and is
          never stored. Real calls consume real credits.
        </p>
        <div className="mt-3">
          <label htmlFor="playground-key" className="mb-1 block text-xs text-muted-foreground">API key</label>
          <Input
            id="playground-key"
            type="password"
            autoComplete="off"
            placeholder="atai_development_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Request</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Capability
            <select
              aria-label="Capability"
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              value={capability}
              onChange={(e) => pickCapability(e.target.value)}
            >
              {Object.keys(CAPABILITY_OPERATIONS).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Operation
            <select
              aria-label="Operation"
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              value={operation}
              onChange={(e) => pickOperation(e.target.value)}
            >
              {operations.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        {supportsModel ? (
          <fieldset className="mt-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Model (required)</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <label className="flex shrink-0 items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="playground-model"
                  checked={modelMode === "recommended"}
                  onChange={() => setModelMode("recommended")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-foreground">Use default recommended</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{RECOMMENDED_MODEL}</span>
                </span>
              </label>
              <label className="flex flex-1 items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="playground-model"
                  checked={modelMode === "custom"}
                  onChange={() => setModelMode("custom")}
                  className="mt-1"
                />
                <span className="flex-1">
                  <span className="font-medium text-foreground">Configure a model</span>
                  <Input
                    aria-label="Custom model id"
                    placeholder="openai/gpt-5.2"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    disabled={modelMode !== "custom"}
                    className="mt-1 font-mono text-xs"
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Any OpenRouter model id, e.g. openai/gpt-5.2 or anthropic/claude-sonnet-4.5.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : null}
        {needsMediaModel ? (
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Model required:</strong> {capability} needs a specific OpenRouter model id —
            set <code className="rounded bg-muted px-1 font-mono">"model"</code> in the input JSON below. The prefilled
            sample shows an example model; browse more at openrouter.ai/models.
          </p>
        ) : null}
        <label className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          Input (JSON)
          <textarea
            aria-label="Request input JSON"
            className="min-h-40 rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={() => void run()} disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Running…
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" aria-hidden />
                Send request
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            POST /api/runtime/v1 — {capability}/{operation}
          </p>
        </div>
      </section>

      {runs.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Session results</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} run{stats.total === 1 ? "" : "s"} · {stats.succeeded} succeeded · {stats.failed} failed
              {stats.avg !== null ? ` · avg ${stats.avg} ms` : ""}
              {stats.p95 !== null ? ` · p95 ${stats.p95} ms` : ""}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={r.ok ? "font-medium text-success" : "font-medium text-destructive"}>
                    {r.ok ? "✓" : "✕"} {r.summary}
                  </span>
                  <span className="text-muted-foreground">
                    {r.latencyMs} ms · {formatWhen(r.at)}
                    {r.requestId ? ` · ${r.requestId}` : ""}
                  </span>
                </div>
                {r.responseJson ? (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px] leading-5">
                    {r.responseJson}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => setRuns([])}>
            Clear session results
          </Button>
        </section>
      ) : null}
    </div>
  )
}
