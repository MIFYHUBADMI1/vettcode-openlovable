"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Copy, Download, Loader2, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jsonFetcher } from "@/lib/client/api"
import { formatWhen } from "@/components/runtime-control/format"

/**
 * Owner-only Cal.com console — exercise the platform's Cal.com v2 integration
 * live: every documented endpoint family (me, bookings incl. cancel/
 * reschedule/instance, event types, availability + timeslots, schedules,
 * calendars) plus raw custom calls. Requests run through the admin-gated
 * /api/admin/calcom/console route with the SERVER-side platform credential;
 * the browser never sees or sends it. Full logging per call: status, latency,
 * content type, request id (correlates with server logs), provider error
 * bodies, and a persisted session history with re-run.
 *
 * This is deliberately NOT the tenant runtime: project API keys keep the
 * closed contract (listBookings/createBooking) in /developers/playground.
 */

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

interface CatalogEndpoint {
  id: string
  label: string
  method: HttpMethod
  /** Path template; `id`/`uid` placeholders are prefilled for GETs. */
  path: string
  query?: string
  body?: string
  note?: string
  /** Real-world effect on the platform Cal.com account. */
  sideEffect?: boolean
}

interface CatalogGroup {
  name: string
  blurb: string
  endpoints: CatalogEndpoint[]
}

const FUTURE_START = (() => {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 19) + "Z"
})()

const CATALOG: CatalogGroup[] = [
  {
    name: "Me",
    blurb: "The account behind the platform credential — the fastest connectivity check.",
    endpoints: [
      { id: "me", label: "Get authenticated user", method: "GET", path: "/v2/me", note: "Confirms the credential, team type, and profile of the account CALCOM_API_KEY belongs to." },
    ],
  },
  {
    name: "Bookings",
    blurb: "Core scheduling records. Reads are safe; writes touch real meetings.",
    endpoints: [
      { id: "bookings-list", label: "List bookings", method: "GET", path: "/v2/bookings", query: "bookingStatus=UPCOMING&limit=20&offset=0", note: "bookingStatus: UPCOMING | PAST | CANCELLED | ALL (older deploys use &status=)." },
      { id: "bookings-get", label: "Get booking by UID", method: "GET", path: "/v2/bookings/{uid}", note: "Replace {uid} with a real booking UID from a list call." },
      { id: "bookings-create", label: "Create booking", method: "POST", path: "/v2/bookings", body: JSON.stringify({ start: FUTURE_START, eventTypeId: 7618341, attendee: { name: "Ada Tester", email: "you@example.com", timeZone: "Africa/Kampala" }, metadata: {} }, null, 2), note: "Needs start, eventTypeId, attendee. eventTypeId 7618341 is the platform 15min type — swap in your own or list via /v2/event-types. Cal.com rejects placeholder emails like example.com — use a real address.", sideEffect: true },
      { id: "bookings-cancel", label: "Cancel booking", method: "POST", path: "/v2/bookings/{uid}/cancel", body: JSON.stringify({ cancellationReason: "Debug console test — cancelling my own booking", noShow: false }, null, 2), note: "Cancels a real booking on the platform account.", sideEffect: true },
      { id: "bookings-confirm", label: "Confirm booking", method: "POST", path: "/v2/bookings/{uid}/confirm", note: "Confirms a pending-approval booking.", sideEffect: true },
      { id: "bookings-reschedule-request", label: "Request reschedule", method: "POST", path: "/v2/bookings/{uid}/reschedule", body: JSON.stringify({ start: FUTURE_START, reducedEventTypeId: 7618341 }, null, 2), note: "Starts a reschedule; the attendee (or requireConfirmation flow) completes it.", sideEffect: true },
      { id: "bookings-reschedule-confirm", label: "Confirm reschedule", method: "POST", path: "/v2/bookings/{uid}/instance", body: JSON.stringify({ action: "ACCEPT" }, null, 2), note: "Completes a pending reschedule on the booking instance.", sideEffect: true },
      { id: "bookings-instance", label: "Get booking instances", method: "GET", path: "/v2/bookings/{uid}/instance", note: "Video/conferencing instances attached to a booking." },
    ],
  },
  {
    name: "Event types",
    blurb: "The bookable types behind every booking — the bridge into playground createBooking calls.",
    endpoints: [
      { id: "eventtypes-list", label: "List event types", method: "GET", path: "/v2/event-types", note: "Requires cal-api-version 2026-06-12 — prefilled when you pick this." },
      { id: "eventtypes-get", label: "Get event type", method: "GET", path: "/v2/event-types/{id}" },
      { id: "eventtypes-create", label: "Create event type", method: "POST", path: "/v2/event-types", body: JSON.stringify({ title: "Console debug event", slug: "console-debug-event", schedulingType: "ROUND_ROBIN", length: 15, slotInterval: 15 }, null, 2), note: "Creates a real event type on the platform account.", sideEffect: true },
      { id: "eventtypes-update", label: "Update event type", method: "PATCH", path: "/v2/event-types/{id}", body: JSON.stringify({ metadata: { consoleTest: "true" } }, null, 2), note: "Partial update; metadata is the safest field to poke.", sideEffect: true },
    ],
  },
  {
    name: "Availability",
    blurb: "Pure reads — the right way to debug slot logic before anything books.",
    endpoints: [
      { id: "availability-get", label: "User availability", method: "GET", path: "/v2/availability/slot", query: "dateFrom=2026-10-26T00:00:00.000Z&dateTo=2026-10-30T00:00:00.000Z&timeZone=UTC&eventTypeId=7618341", note: "Takes userIds or eventTypeId + dateFrom/dateTo (+ teamId for round-robin/batching)." },
      { id: "availability-grouped", label: "Grouped availability", method: "GET", path: "/v2/availability/slot/grouped-availability", query: "dateFrom=2026-10-26T00:00:00.000Z&dateTo=2026-10-30T00:00:00.000Z&t1=UTC", note: "Common availability across multiple users/event types." },
      { id: "timeslots", label: "Get available time slots", method: "POST", path: "/v2/availability/timeslots", body: JSON.stringify({ slotConfig: { start: FUTURE_START, end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + "Z", eventTypeId: 7618341, timeZone: "UTC" } }, null, 2), note: "Body-shaped slot query; returns the concrete bookable slots." },
    ],
  },
  {
    name: "Schedules",
    blurb: "Availability schedules that drive when slots exist.",
    endpoints: [
      { id: "schedules-list", label: "List schedules", method: "GET", path: "/v2/schedules" },
      { id: "schedules-get", label: "Get schedule", method: "GET", path: "/v2/schedules/{id}" },
    ],
  },
  {
    name: "Calendars",
    blurb: "Connected calendars — which provider each event type writes to.",
    endpoints: [
      { id: "calendars-list", label: "List connected calendars", method: "GET", path: "/v2/calendars" },
      { id: "calendars-get", label: "Get connected calendar", method: "GET", path: "/v2/calendars/{id}" },
    ],
  },
]

const PLACEHOLDERS_NOTE = "Paths may contain {uid} / {id} — replace them with real resource ids before sending."

interface ConsoleResult {
  requestId: string
  status: number
  statusText: string
  ok: boolean
  latencyMs: number
  contentType: string | null
  bodyPretty: string
  bodyIsJson: boolean
  truncated: boolean
}

interface HistoryEntry {
  id: string
  at: number
  method: HttpMethod
  path: string
  query: string
  body: string
  apiVersion: string
  result?: ConsoleResult
  errorText?: string
}

interface DiscoveryAvailability {
  availability: Record<string, { provider: string | null; configured: boolean | null; missingEnvVars: string[] }>
}

const HISTORY_KEY = "atai.calcom-console.history.v1"
const MAX_HISTORY = 50

export function CalComConsoleClient() {
  const { data: discovery } = useSWRishDiscovery()

  const [method, setMethod] = useState<HttpMethod>("GET")
  const [path, setPath] = useState("/v2/me")
  const [query, setQuery] = useState("")
  const [body, setBody] = useState("")
  const [apiVersion, setApiVersion] = useState("2024-08-13")
  const [running, setRunning] = useState(false)
  const [last, setLast] = useState<ConsoleResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyReady, setHistoryReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) setHistory(JSON.parse(raw) as HistoryEntry[])
    } catch {
      /* corrupt history starts a fresh log */
    }
    setHistoryReady(true)
  }, [])

  useEffect(() => {
    if (!historyReady) return
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
    } catch {
      /* storage full — logging stays in-memory for this tab */
    }
  }, [history, historyReady])

  const calendarStatus = discovery?.availability?.["calendar"] ?? null

  function fullUrl(targetPath: string, targetQuery: string): string {
    const qs = targetQuery.trim().replace(/^\?/, "")
    return `https://api.cal.com${targetPath}${qs ? `?${qs}` : ""}`
  }

  function pickEndpoint(ep: CatalogEndpoint) {
    setMethod(ep.method)
    setPath(ep.path)
    setQuery(ep.query ?? "")
    setBody(ep.body ?? (ep.method === "GET" ? "" : "{}"))
    // Create-booking is documented against the dated v2 version; event-types
    // only resolve under the 2026-06-12 header. Keep the configured default
    // for everything else.
    if (ep.id === "bookings-create") setApiVersion("2024-08-13")
    if (ep.id.startsWith("eventtypes-")) setApiVersion("2026-06-12")
  }

  function resolvePlaceholders(): { resolvedPath: string; missing: string[] } {
    const missing: string[] = []
    let resolved = path
    const fill = (token: string, label: string) => {
      if (!resolved.includes(token)) return
      resolved = resolved.replace(token, label)
    }
    fill("{uid}", "REPLACE_WITH_BOOKING_UID")
    fill("{id}", "REPLACE_WITH_ID")
    if (/REPLACE_WITH_/.test(resolved)) missing.push("a real resource id in the path")
    if (/REPLACE_WITH_/.test(body)) missing.push("a real resource id in the body")
    return { resolvedPath: resolved, missing }
  }

  async function run() {
    const { resolvedPath, missing } = resolvePlaceholders()
    if (missing.length > 0) {
      toast.error(`Replace the placeholder${missing.length > 1 ? "s" : ""} first: ${missing.join(", ")}.`)
      return
    }

    let parsedBody: unknown = undefined
    if (method !== "GET") {
      if (!body.trim()) {
        toast.error(`${method} needs a JSON body — write {} if the endpoint takes none.`)
        return
      }
      try {
        parsedBody = JSON.parse(body)
      } catch {
        toast.error("Request body is not valid JSON.")
        return
      }
    }

    const entry: HistoryEntry = {
      id: `${Date.now()}`,
      at: Date.now(),
      method,
      path: resolvedPath,
      query,
      body,
      apiVersion,
    }

    setRunning(true)
    try {
      const res = await fetch("/api/admin/calcom/console", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method,
          path: `${resolvedPath}${query.trim() ? `?${query.trim().replace(/^\?/, "")}` : ""}`,
          ...(parsedBody !== undefined ? { body: parsedBody } : {}),
          ...(apiVersion.trim() ? { apiVersion: apiVersion.trim() } : {}),
        }),
      })
      const envelope = (await res.json().catch(() => null)) as
        | ({ ok: true } & { data: ConsoleResult })
        | { ok: false; error?: { code?: string; message?: string } }
        | null

      if (envelope?.ok && "data" in envelope) {
        entry.result = envelope.data
        setLast(envelope.data)
        if (envelope.data.ok) toast.success(`${resolvedPath} → ${envelope.data.status} in ${envelope.data.latencyMs} ms`)
        else toast.error(`Cal.com returned ${envelope.data.status}`)
      } else {
        const err = (envelope as { error?: { code?: string; message?: string } } | null)?.error
        entry.errorText = JSON.stringify(err ?? { httpStatus: res.status }, null, 2)
        toast.error(err?.message ?? `Console request failed (${res.status})`)
      }
    } catch (e) {
      entry.errorText = e instanceof Error ? e.message : String(e)
      toast.error(entry.errorText)
    } finally {
      setRunning(false)
      setHistory((h) => [entry, ...h].slice(0, MAX_HISTORY))
    }
  }

  function rerun(entry: HistoryEntry) {
    setMethod(entry.method)
    setPath(entry.path)
    setQuery(entry.query)
    setBody(entry.body)
    setApiVersion(entry.apiVersion)
    toast.success("Loaded into the editor — press Send to run it again.")
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Clipboard blocked by the browser."),
    )
  }

  function copyCurl() {
    if (!last) return
    const lines = [
      `curl -X ${method} '${fullUrl(path, query)}' \\`,
      `  -H 'Authorization: Bearer <your Cal.com API key>' \\`,
      `  -H 'cal-api-version: ${apiVersion || "2024-08-13"}' \\`,
      `  -H 'content-type: application/json'`,
    ]
    if (body.trim() && method !== "GET") lines.push(`  --data '${body.replace(/'/g, "'\\''")}'`)
    copyText(lines.join("\n"), "cURL command")
  }

  function downloadHistory() {
    const payload = JSON.stringify(
      history.map((h) => ({
        at: new Date(h.at).toISOString(),
        method: h.method,
        url: fullUrl(h.path, h.query),
        apiVersion: h.apiVersion,
        body: h.body || undefined,
        requestId: h.result?.requestId,
        status: h.result?.status,
        latencyMs: h.result?.latencyMs,
        response: h.result?.bodyPretty ?? h.errorText,
      })),
      null,
      2,
    )
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `calcom-console-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => {
    const run2 = history.filter((h) => h.result || h.errorText)
    const ok = run2.filter((h) => h.result?.ok).length
    const errors = run2.filter((h) => !h.result || !h.result.ok).length
    const avg = run2.length
      ? Math.round(run2.reduce((acc, h) => acc + (h.result?.latencyMs ?? 0), 0) / run2.length)
      : 0
    return { total: run2.length, ok, errors, avg }
  }, [history])

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Cal.com console — platform account</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Owner-only debugging surface. Calls run server-side with the platform&apos;s Cal.com credential against
              the live v2 API. This never touches your projects&apos; runtime contract — project API keys still only
              see listBookings/createBooking in the playground.
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: "color-mix(in oklab, amber 12%, transparent)" }}
          >
            admin session
          </span>
        </div>
        {calendarStatus ? (
          calendarStatus.configured === false ? (
            <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              <strong className="text-foreground">Not configured:</strong> this deployment is missing
              {" "}
              <code className="rounded bg-muted px-1 font-mono">{calendarStatus.missingEnvVars.join(", ") || "CALCOM_API_KEY"}</code>{" "}
              — console calls will fail with PROVIDER_NOT_CONFIGURED until it is set.
            </p>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Provider wiring reported by the runtime: {calendarStatus.provider ?? "calcom"} — every call below runs
              through the same credential the runtime uses.
            </p>
          )
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Endpoint catalog</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Click to load into the editor. GETs are safe; anything marked <span className="font-medium text-foreground">write</span> changes real data on the platform Cal.com account.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {CATALOG.map((group) => (
            <div key={group.name}>
              <p className="text-xs font-medium text-foreground">{group.name}</p>
              <p className="text-[11px] text-muted-foreground">{group.blurb}</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {group.endpoints.map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => pickEndpoint(ep)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      path === ep.path && method === ep.method
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/20 hover:border-primary/40"
                    }`}
                  >
                    <MethodBadge method={ep.method} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {ep.label}
                        {ep.sideEffect ? <span className="ml-1.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">write</span> : null}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{ep.path}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Request</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{PLACEHOLDERS_NOTE}</p>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              aria-label="HTTP method"
              className="h-8 shrink-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
            >
              {(["GET", "POST", "PATCH", "PUT", "DELETE"] as HttpMethod[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <Input
              aria-label="Path"
              className="flex-1 font-mono text-xs"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/v2/bookings"
            />
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Query string
            <Input
              className="font-mono text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="limit=10&offset=0"
              spellCheck={false}
            />
          </label>
          {method !== "GET" ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              JSON body
              <textarea
                className="min-h-32 rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:max-w-xs">
            cal-api-version (override)
            <Input
              className="font-mono text-xs"
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              placeholder="empty = server default"
            />
            <span className="text-[11px]">
              Server default: <code className="rounded bg-muted px-1 font-mono">2024-08-13</code> (env CALCOM_API_VERSION). Clear to use it.
            </span>
          </label>
        </div>

        {method !== "GET" ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">This is a write call.</strong> It changes real data on the
            platform&apos;s Cal.com account — only run it against bookings or event types you created for testing.
          </p>
        ) : null}

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
                Send to Cal.com
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">POST /api/admin/calcom/console → {method} {path}</p>
        </div>
      </section>

      {last ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Last response</h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyCurl}>
                <Copy className="mr-1.5 size-3.5" aria-hidden />
                Copy as cURL
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => copyText(last.bodyPretty, "Response")}>
                <Copy className="mr-1.5 size-3.5" aria-hidden />
                Copy response
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className={last.ok ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>
              {last.status} {last.statusText}
            </span>
            <span>{last.latencyMs} ms</span>
            <span>content-type: {last.contentType ?? "—"}</span>
            <span className="font-mono" title="Correlate with server logs by this id">x-request-id: {last.requestId}</span>
          </div>
          {last.truncated ? (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">Response truncated at 200 KB.</p>
          ) : null}
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
            {last.bodyPretty || "(empty body)"}
          </pre>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Session log</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} call{stats.total === 1 ? "" : "s"} · {stats.ok} ok · {stats.errors} error
              {stats.errors === 1 ? "" : "s"} · avg {stats.avg} ms
            </p>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <MethodBadge method={h.method} />
                    <span className="truncate font-mono text-foreground">{h.path}{h.query ? `?${h.query}` : ""}</span>
                    {h.result ? (
                      <span className={h.result.ok ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>
                        {h.result.status}
                      </span>
                    ) : (
                      <span className="font-medium text-destructive">failed</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {h.result ? `${h.result.latencyMs} ms · ` : ""}
                    {formatWhen(h.at)}
                    <button type="button" className="rounded p-1 hover:bg-muted" title="Load into editor" onClick={() => rerun(h)}>
                      <RotateCcw className="size-3.5" aria-hidden />
                    </button>
                  </span>
                </div>
                {h.result ? (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-muted-foreground">
                      response{h.result.requestId ? ` · x-request-id ${h.result.requestId}` : ""}
                    </summary>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px] leading-5">
                      {h.result.bodyPretty}
                    </pre>
                  </details>
                ) : (
                  <pre className="mt-1 rounded-lg bg-destructive/5 p-2 font-mono text-[11px] leading-5 text-destructive">
                    {h.errorText}
                  </pre>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadHistory}>
              <Download className="mr-1.5 size-3.5" aria-hidden />
              Export log
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setHistory([])}>
              Clear session log
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-600 dark:text-emerald-400",
  POST: "text-sky-600 dark:text-sky-400",
  PATCH: "text-amber-600 dark:text-amber-400",
  PUT: "text-amber-600 dark:text-amber-400",
  DELETE: "text-destructive",
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return <span className={`shrink-0 font-mono text-[10px] font-semibold ${METHOD_COLORS[method]}`}>{method}</span>
}

/** GET /api/runtime/v1 availability — only the calendar entry matters here. */
function useSWRishDiscovery() {
  const [data, setData] = useState<DiscoveryAvailability | null>(null)
  useEffect(() => {
    let cancelled = false
    void jsonFetcher<DiscoveryAvailability>("/api/runtime/v1")
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        /* discovery is informational — the console still runs without it */
      })
    return () => {
      cancelled = true
    }
  }, [])
  return { data }
}
