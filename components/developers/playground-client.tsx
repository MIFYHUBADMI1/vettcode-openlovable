"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jsonFetcher } from "@/lib/client/api"
import { formatWhen } from "@/components/runtime-control/format"

/**
 * Live playground — makes REAL /api/runtime/v1 calls with a REAL key the user
 * pastes. Calls are billed to credits exactly like SDK traffic (decided with
 * the product owner). The key never leaves the browser's memory except inside
 * the Authorization header of the request being run; it is never stored.
 *
 * Capability coverage (GET /api/runtime/v1) is displayed so users can see at
 * a glance which capabilities are testable on this deployment — wiring and
 * server-side provider configuration are reported separately.
 */

interface RunResult {
  id: number
  at: number
  ok: boolean
  status: number
  latencyMs: number
  requestId?: string
  summary: string
  capability: string
  operation: string
  requestJson?: string
  debug?: boolean
  responseJson?: string
}

/** GET /api/runtime/v1 — public capability discovery + deployment availability. */
interface CapabilityDiscovery {
  capabilities: { id: string; operations: readonly string[] }[]
  availability: Record<
    string,
    {
      provider: string | null
      configured: boolean | null
      missingEnvVars: string[]
      operations: { name: string; available: boolean }[]
    }
  >
}

/** The platform-recommended default — mirrors RECOMMENDED_DEFAULT_MODEL in the OpenRouter adapter. */
const RECOMMENDED_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"

/** The registry subset exposed here mirrors runtime/contracts/router.ts. */
const CAPABILITY_LABELS: Record<string, string> = {
  "ai.text": "AI — text & chat",
  "ai.embed": "AI — embeddings",
  "ai.speak": "AI — voice (ElevenLabs)",
  "ai.image": "AI — image generation",
  "ai.video": "AI — video generation",
  "ai.speech": "AI — text-to-speech",
  "ai.transcribe": "AI — transcription",
  "ai.vision": "AI — vision input",
  "search.web": "Web search",
  "web.scrape": "Web scraping",
  "email": "Email",
  "sms": "SMS",
  "whatsapp": "WhatsApp",
  "notifications": "Push notifications",
  "maps": "Maps (Mapbox) — geocoding, search, routing, tiles, styles",
  "calendar": "Scheduling (Cal.com)",
  "vectors": "Vector storage",
  "db": "App database",
  "payments": "Payments (checkout · subscriptions · payment feed · payouts)",
}

/** Fallback registry snapshot used until GET /api/runtime/v1 resolves. */
const FALLBACK_CAPABILITY_OPERATIONS: Record<string, readonly string[]> = {
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
  "maps": [
    "geocode",
    "reverseGeocode",
    "search",
    "placeDetails",
    "isochrone",
    "directions",
    "matrix",
    "tilesMetadata",
    "styleSchema",
    "staticImage",
    "tokens",
  ],
  "calendar": ["listBookings", "createBooking"],
  "vectors": ["upsert", "search", "delete"],
  "db": ["query", "create", "edit", "delete"],
  "payments": ["createCheckout", "createSubscription", "listPayments", "listPayouts"],
}

const OPERATION_LABELS: Record<string, string> = {
  chat: "Chat",
  completion: "Completion",
  embed: "Embed",
  synthesize: "Synthesize",
  generateImage: "Generate image",
  generateVideo: "Generate video",
  speak: "Speak",
  transcribe: "Transcribe",
  visionInput: "Vision input",
  web: "Web search",
  scrape: "Scrape",
  send: "Send",
  geocode: "Geocode",
  reverseGeocode: "Reverse geocode",
  // "search" exists as an operation under BOTH maps and vectors — its label is
  // resolved through the `${capability}/${operation}` key below, not here.
  "maps/search": "Search box",
  placeDetails: "Place details",
  isochrone: "Isochrone",
  directions: "Directions",
  matrix: "Travel matrix",
  tilesMetadata: "Tile reachability",
  styleSchema: "Style schema",
  staticImage: "Static image",
  tokens: "List tokens",
  listBookings: "List bookings",
  createBooking: "Create booking",
  upsert: "Upsert",
  search: "Search",
  delete: "Delete",
  query: "Query",
  create: "Create",
  edit: "Edit",
  createCheckout: "Create checkout",
  createSubscription: "Create subscription",
  listPayments: "List payments",
  listPayouts: "List payouts",
}

/** A helper email/phone for placeholder credentials used by side-effect samples. */
const DEMO_EMAIL = "you@example.com"
const DEMO_PHONE = "+15551234567"
const DEMO_SUCCESS_URL = "https://example.com/success"
const DEMO_CANCEL_URL = "https://example.com/cancel"
const DEMO_IMAGE_URL = "https://example.com/photo.jpg"

function futureDateIso(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 19) + "Z"
}

const SAMPLE_INPUTS = (): Record<string, string> => ({
  "ai.text/chat": JSON.stringify({ messages: [{ role: "user", content: "Say hello in one short sentence." }] }, null, 2),
  "ai.text/completion": JSON.stringify({ prompt: "Explain quantum computing in one short sentence." }, null, 2),
  "ai.embed/embed": JSON.stringify({ input: "hello world" }, null, 2),
  "ai.speak/synthesize": JSON.stringify({ text: "Hello from Atai!", model: "eleven_flash_v2_5" }, null, 2),
  "ai.image/generateImage": JSON.stringify({ prompt: "A red panda astronaut floating in space", model: "google/gemini-2.5-flash-image", aspect_ratio: "16:9" }, null, 2),
  "ai.video/generateVideo": JSON.stringify({ prompt: "A timelapse of a city skyline at dusk", model: "google/veo-3", duration: 5 }, null, 2),
  "ai.speech/speak": JSON.stringify({ input: "Hello from Atai!", model: "openai/gpt-4o-mini-tts-2025-12-15", voice: "alloy", response_format: "mp3" }, null, 2),
  "ai.transcribe/transcribe": JSON.stringify({ input_audio: { data: "<base64 audio>", format: "wav" }, model: "openai/whisper-large-v3" }, null, 2),
  "ai.vision/visionInput": JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: "Describe this image." }, { type: "image_url", image_url: { url: DEMO_IMAGE_URL } }] }] }, null, 2),
  "search.web/web": JSON.stringify({ query: "best coffee in Kampala", limit: 3 }, null, 2),
  "web.scrape/scrape": JSON.stringify({ url: "https://example.com" }, null, 2),
  "email/send": JSON.stringify({ to: [DEMO_EMAIL], subject: "Hello from Atai", text: "This email was delivered through the Atai runtime." }, null, 2),
  "sms/send": JSON.stringify({ to: DEMO_PHONE, body: "Hello from Atai!" }, null, 2),
  "whatsapp/send": JSON.stringify({ to: DEMO_PHONE, body: "Hello from Atai on WhatsApp!" }, null, 2),
  "notifications/send": JSON.stringify({ token: "<device FCM token>", title: "Hello from Atai", body: "This push was sent through the runtime." }, null, 2),
  "maps/geocode": JSON.stringify({ query: "Kampala", limit: 3 }, null, 2),
  "maps/reverseGeocode": JSON.stringify({ longitude: 32.5828, latitude: 0.3136, limit: 1 }, null, 2),
  "maps/search": JSON.stringify({ query: "coffee shops in Kampala", limit: 5, longitude: 32.5828, latitude: 0.3136 }, null, 2),
  "maps/placeDetails": JSON.stringify({ poiId: "<feature id from maps/search>" }, null, 2),
  "maps/isochrone": JSON.stringify({ coordinates: [32.5828, 0.3136], profile: "driving", minutes: [10, 20, 30] }, null, 2),
  "maps/directions": JSON.stringify({ coordinates: [[32.5828, 0.3136], [32.5729, 0.3476]], profile: "driving" }, null, 2),
  "maps/matrix": JSON.stringify({ coordinates: [[32.5828, 0.3136], [32.5729, 0.3476], [32.6005, 0.3002]], profile: "driving" }, null, 2),
  "maps/tilesMetadata": JSON.stringify({ styleId: "mapbox.streets", z: 12, x: 2292, y: 1836 }, null, 2),
  "maps/styleSchema": JSON.stringify({ username: "mapbox", styleId: "streets-v12" }, null, 2),
  "maps/staticImage": JSON.stringify({ longitude: 32.5828, latitude: 0.3136, zoom: 11, width: 600, height: 400, marker: true }, null, 2),
  "maps/tokens": JSON.stringify({}, null, 2),
  "calendar/listBookings": JSON.stringify({ limit: 10, status: "upcoming" }, null, 2),
  "calendar/createBooking": JSON.stringify({ start: futureDateIso(), attendee: { name: "Ada Tester", email: DEMO_EMAIL, timeZone: "Africa/Kampala" } }, null, 2),
  "vectors/upsert": JSON.stringify({ vectors: [{ id: "doc-1", values: [0.1, 0.2, 0.3], metadata: { kind: "demo" } }] }, null, 2),
  "vectors/search": JSON.stringify({ vector: [0.1, 0.2, 0.3], topK: 3, returnMetadata: "indexed" }, null, 2),
  "vectors/delete": JSON.stringify({ ids: ["doc-1"] }, null, 2),
  "db/query": JSON.stringify({ tableName: "customers", limit: 5 }, null, 2),
  "db/create": JSON.stringify({ tableName: "customers", data: { name: "Ada Tester", email: DEMO_EMAIL } }, null, 2),
  "db/edit": JSON.stringify({ tableName: "customers", recordId: "<record id>", data: { name: "Ada Tester (edited)" } }, null, 2),
  "db/delete": JSON.stringify({ tableName: "customers", recordId: "<record id>" }, null, 2),
  "payments/createCheckout": JSON.stringify({ items: [{ name: "Pro Plan", quantity: 1, price: 29.9 }], idempotencyKey: "demo-checkout", successUrl: DEMO_SUCCESS_URL, cancelUrl: DEMO_CANCEL_URL, currency: "USD" }, null, 2),
  "payments/createSubscription": JSON.stringify({ productId: "prdtxxxxxxxxxxxx", quantity: 1, customer: { email: DEMO_EMAIL, name: "Ada Tester" }, billing: { country: "US", city: "Kampala" }, returnUrl: DEMO_SUCCESS_URL }, null, 2),
  "payments/listPayments": JSON.stringify({ limit: 20, status: "succeeded" }, null, 2),
  "payments/listPayouts": JSON.stringify({ limit: 10 }, null, 2),
})

const REQUEST_HINTS: Record<string, string> = {
  "ai.text/chat": "messages[] with role/content. The model comes from the Model chooser below (recommended default or custom).",
  "ai.text/completion": "A single-shot prompt. Optional generation params (temperature, max_tokens, stop…). Model comes from the Model chooser — resolved the same way as chat.",
  "ai.text/embed": "input (string or string[]) → embeddings (768-dim by default via the platform's Workers AI embedding model; override server-side with CLOUDFLARE_EMBEDDING_MODEL).",
  "ai.embed/embed": "input (string or string[]) → { embeddings, model, dimensions }. Same embedding provider as ai.text/embed.",
  "ai.speak/synthesize": "text (1–5,000 chars). Optional voiceId/model from the ElevenLabs allowlist; both default to server config.",
  "ai.image/generateImage": "prompt and an OpenRouter image-capable model are required. aspect_ratio optional.",
  "ai.video/generateVideo": "prompt + model. Returns { jobId, status } — poll the SAME operation with { jobId } until it completes.",
  "ai.speech/speak": "input text + an OpenRouter TTS model. voice and response_format optional.",
  "ai.transcribe/transcribe": "input_audio { data (base64), format } + an OpenRouter transcription model.",
  "ai.vision/visionInput": "messages[] whose content mixes text parts and image_url parts.",
  "search.web/web": "query plus optional limit. Results are normalized title/url/snippet items.",
  "web.scrape/scrape": "url to fetch and return as markdown/text.",
  "email/send": "to[] + subject + text and/or html (at least one). The platform sender is injected server-side — never include a from.",
  "sms/send": "to must be E.164 (e.g. +15551234567) and body ≤ 1,600 chars. Platform sender is injected server-side.",
  "whatsapp/send": "Same input shape as SMS; the platform WhatsApp sender is injected server-side.",
  "notifications/send": "token (FCM device token), title and body — one device per request.",
  "maps/geocode": "query plus optional limit (≤5), country (ISO 3166, e.g. \"us\") and language tags.",
  "maps/reverseGeocode": "longitude (−180..180) and latitude (−90..90); optional limit.",
  "maps/search": "Mapbox Search Box: query plus optional limit (≤10), lng/lat bias (ars), types[], bbox, country, language. Results normalize to the same shape as geocode.",
  "maps/placeDetails": "poiId — a feature id from maps/search. Optional lng/lat proximity bias and language.",
  "maps/isochrone": "coordinates [lng, lat], profile (driving|walking|cycling), minutes[] (1..240, ≤6). Returns Mapbox GeoJSON under payload — polygons are provider-reported.",
  "maps/directions": "coordinates — 2..6 ordered [lng, lat] pairs; profile incl. driving-traffic. Optional alternatives. Routes come back under payload.",
  "maps/matrix": "coordinates — 2..5 [lng, lat] pairs; profile (driving|walking). durations/distance matrices under payload (POST to Mapbox, form-encoded).",
  "maps/tilesMetadata": "styleId + z/x/y tile coords (0 ≤ x,y < 2^z). Proves the key reaches the tile endpoint; returns byte-size metadata, not the tile content.",
  "maps/styleSchema": "username + styleId — fetches the full style JSON from Mapbox (layers, sources, glyphs, sprite).",
  "maps/staticImage": "longitude/latitude/zoom + width/height (≤1280). marker:true drops a pin. The PNG comes back inline as a data URL and renders below.",
  "maps/tokens": "Lists the tokens on the Mapbox account (verification/diagnostics only — the raw token never appears in any response).",
  "calendar/listBookings": "Read-only. Optional limit (≤50) and status (upcoming | past | cancelled).",
  "calendar/createBooking": "Real side effect — books a meeting in the platform Cal.com account. start must be a future ISO timestamp; eventTypeId defaults to the server-configured event type.",
  "vectors/upsert": "vectors[] of { id, values } — values must match the Cloudflare Vectorize index dimensions. The namespace is derived from your project automatically.",
  "vectors/search": "vector to query with, optional topK and returnMetadata (none | indexed | all).",
  "vectors/delete": "ids[] of vector ids to remove from your project's namespace.",
  "db/query": "This is YOUR project's database (Totalum). tableName + optional filter/limit/skip/sortBy (sortDirection asc|desc).",
  "db/create": "tableName + a data object — a new record is written to your project's database.",
  "db/edit": "tableName, recordId, and a data object of fields to update.",
  "db/delete": "tableName + recordId — permanently removes the record.",
  "payments/createCheckout": "items[] with name/quantity/price. Returns a hosted checkoutUrl to redirect the customer to (test mode by default). Project attribution is stamped server-side.",
  "payments/createSubscription": "Real recurring charge: productId (a Dodo product id), quantity, customer {email,name} and billing {country}. Returns subscriptionId + paymentLink for the customer's first payment.",
  "payments/listPayments": "Read-only feed of the platform's payment records. Optional limit (≤100), status filter, subscriptionId or customerId.",
  "payments/listPayouts": "Read-only, ACCOUNT-LEVEL: settlement payouts of the platform's merchant account (not attributable to a single project). Optional limit.",
}

/** Capabilities that generate media and need a specific model (chat uses the model chooser instead). */
const MEDIA_MODEL_CAPABILITIES = new Set(["ai.image", "ai.video", "ai.speech", "ai.transcribe"])

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
  const [inputText, setInputText] = useState(SAMPLE_INPUTS()["ai.text/chat"] ?? "{}")
  const [running, setRunning] = useState(false)
  const [runs, setRuns] = useState<RunResult[]>([])
  // Debug mode: attaches metadata.debug so the runtime echoes the raw
  // provider body (capped) alongside the normalized data — playground only.
  const [debugMode, setDebugMode] = useState(false)
  // Model choice (ai.text chat/completion only): use the platform-recommended
  // default, or configure a custom OpenRouter model id. One of the two is
  // always required before a chat/completion request can fire.
  const [modelMode, setModelMode] = useState<"recommended" | "custom">("recommended")
  const [customModel, setCustomModel] = useState("")

  const supportsModel = capability === "ai.text" && (operation === "chat" || operation === "completion")
  const needsMediaModel = MEDIA_MODEL_CAPABILITIES.has(capability)

  // Discovery-driven registry: GET /api/runtime/v1 is the source of truth;
  // the static snapshot only covers the window before it resolves.
  const capabilities = useMemo(() => {
    if (discovery?.capabilities?.length) {
      return discovery.capabilities
        .filter((c) => c.id !== "test")
        .map((c) => ({ id: c.id, operations: c.operations as readonly string[] }))
    }
    return Object.entries(FALLBACK_CAPABILITY_OPERATIONS).map(([id, ops]) => ({ id, operations: ops }))
  }, [discovery])
  const operationsById = useMemo(
    () => Object.fromEntries(capabilities.map((c) => [c.id, c.operations])) as Record<string, readonly string[]>,
    [capabilities],
  )

  const status = discovery?.availability?.[capability] ?? null
  const operations = operationsById[capability] ?? []
  const requestKey = `${capability}/${operation}`
  const shapeHint = REQUEST_HINTS[requestKey]
  const opAvailable = status
    ? (status.operations.find((o) => o.name === operation)?.available ?? status.provider !== null)
    : true
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
    const ops = operationsById[next] ?? []
    const op = ops[0] ?? "chat"
    setOperation(op)
    setInputText(SAMPLE_INPUTS()[`${next}/${op}`] ?? "{}")
  }

  function pickOperation(next: string) {
    setOperation(next)
    setInputText(SAMPLE_INPUTS()[`${capability}/${next}`] ?? "{}")
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
    const requestJson = JSON.stringify(
      {
        capability,
        operation,
        input,
        ...(debugMode ? { metadata: { debug: true } } : {}),
      },
      null,
      2,
    )
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
            capability,
            operation,
            requestJson,
            debug: debugMode,
            responseJson: JSON.stringify(data.data ?? data, null, 2).slice(0, 16_000),
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
            capability,
            operation,
            requestJson,
            debug: debugMode,
            responseJson: JSON.stringify(errBody?.error ?? body, null, 2).slice(0, 16_000),
          },
          ...r,
        ])
        if (errBody?.error?.code === "runtime_capability_unavailable") {
          toast.error(
            "This capability's provider isn't available on this deployment — check the capability coverage panel above for what's missing.",
          )
        } else if (errBody?.error?.code === "runtime_pricing_unconfigured") {
          toast.error(
            "This operation has no pricing rule yet — an admin must add one under Runtime → Pricing before it can be billed and executed.",
          )
        } else {
          toast.error(errBody?.error?.message ?? `Request failed (${res.status})`)
        }
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
          capability,
          operation,
          requestJson,
          debug: debugMode,
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
        <h2 className="text-sm font-medium">Capability coverage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          What this deployment can exercise with your key.
        </p>
        <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
          {capabilities.map((cap) => {
            const a = discovery?.availability?.[cap.id] ?? null
            return (
              <li key={cap.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 px-3 py-1.5">
                <span className="truncate font-medium text-foreground">{CAPABILITY_LABELS[cap.id] ?? cap.id}</span>
                {a?.provider === null ? (
                  <span className="shrink-0 text-muted-foreground">no provider yet</span>
                ) : a?.configured === false ? (
                  <span
                    className="shrink-0 text-amber-600 dark:text-amber-400"
                    title={a.missingEnvVars.length > 0 ? `Missing server env: ${a.missingEnvVars.join(", ")}` : undefined}
                  >
                    needs setup
                  </span>
                ) : (
                  <span className="shrink-0 text-emerald-600 dark:text-emerald-400">
                    ready{a?.provider ? ` · ${a.provider}` : ""}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {discovery ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            “needs setup” shows capabilities whose platform provider credentials are missing on this deployment
            (hover for the missing server environment variables). “no provider yet” marks capabilities that exist in
            the contract but have no integration wired yet.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Request</h2>
        {status?.provider === null ? (
          <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Heads up:</strong> {CAPABILITY_LABELS[capability] ?? capability} is in
            the contract but no production provider is wired for it yet — requests will fail with{" "}
            <code className="rounded bg-muted px-1 font-mono">runtime_capability_unavailable</code>.
          </p>
        ) : status?.configured === false ? (
          <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Not configured yet:</strong> this deployment is missing the server
            environment variables {status.missingEnvVars.length > 0 ? <code className="rounded bg-muted px-1 font-mono">{status.missingEnvVars.join(", ")}</code> : "—"} —
            the request will fail until they are set.
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Capability
            <select
              aria-label="Capability"
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              value={capability}
              onChange={(e) => pickCapability(e.target.value)}
            >
              {capabilities.map((c) => {
                const a = discovery?.availability?.[c.id] ?? null
                const suffix = a?.provider === null ? " — no provider yet" : a?.configured === false ? " — needs setup" : ""
                return (
                  <option key={c.id} value={c.id}>{`[${c.id}] ${CAPABILITY_LABELS[c.id] ?? c.id}${suffix}`}</option>
                )
              })}
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
              {operations.map((o) => {
                const opOk = status ? (status.operations.find((s) => s.name === o)?.available ?? true) : true
                return (
                  <option key={o} value={o}>{`${OPERATION_LABELS[`${capability}/${o}`] ?? OPERATION_LABELS[o] ?? o}${opOk ? "" : " — no provider yet"}`}</option>
                )
              })}
            </select>
          </label>
        </div>
        {shapeHint ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Request shape:</strong> {shapeHint}
          </p>
        ) : null}
        {!opAvailable && status?.provider !== null ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            The operation <code className="font-mono">{requestKey}</code> is in the contract but no provider is wired
            for it — pick another operation or capability.
          </p>
        ) : null}
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
            set <code className="rounded bg-muted px-1 font-mono">&quot;model&quot;</code> in the input JSON below. The prefilled
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="size-3.5"
            />
            Debug mode — attach raw provider payload (supported capabilities, e.g. maps)
          </label>
          <p className="text-xs text-muted-foreground">
            POST /api/runtime/v1 — {requestKey}
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
                {r.debug ? (
                  <p className="text-[11px] text-muted-foreground">
                    Debug mode on — the response below includes the raw provider payload under <code className="font-mono">raw</code>.
                  </p>
                ) : null}
                {(() => {
                  const m = r.responseJson?.match(/"dataUrl":\s*"(data:image\/[^"]+)"/)
                  return m ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m[1]} alt={`${r.capability}/${r.operation} result`} className="mt-1 max-h-72 rounded-lg border border-border" />
                  ) : null
                })()}
                <details className="text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none">Request sent</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted/30 p-2 font-mono text-[11px] leading-5">
                    {r.requestJson}
                  </pre>
                </details>
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
