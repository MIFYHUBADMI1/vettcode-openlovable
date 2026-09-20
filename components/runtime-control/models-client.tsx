"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface ModelEntry { id: string; label: string; family: string }
interface ConfigPayload {
  config: {
    defaultModel?: string
    allowedModels: string[]
    fallbackModels: string[]
    allowEndUserModelSelection: boolean
  }
  platform: { defaultModel: string | null; catalog: ModelEntry[] }
}

export function RuntimeModelsClient({ projectId }: { projectId: string }) {
  const { data, error, isLoading, mutate } = useSWR<ConfigPayload>(
    `/api/projects/${projectId}/runtime/config`,
    jsonFetcher,
  )
  const [allowed, setAllowed] = useState<string[]>([])
  const [defaultModel, setDefaultModel] = useState("")
  const [fallback, setFallback] = useState<string[]>([])
  const [allowEndUser, setAllowEndUser] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setAllowed(data.config.allowedModels)
    setDefaultModel(data.config.defaultModel ?? "")
    setFallback(data.config.fallbackModels)
    setAllowEndUser(data.config.allowEndUserModelSelection)
  }, [data])

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/runtime/config`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          defaultModel,
          allowedModels: allowed,
          fallbackModels: fallback,
          allowEndUserModelSelection: allowEndUser,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!body?.ok) throw new Error(body?.error?.message ?? "Could not save")
      await mutate()
      setMsg("Saved. New requests use this policy immediately.")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string) {
    setAllowed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleFallback(id: string) {
    setFallback((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading models…</p>
  if (error || !data) return <p role="alert" className="text-sm text-destructive">Could not load model settings.</p>

  const catalog = data.platform.catalog

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        These settings are enforced on the server. An empty allowlist means any valid model id is accepted (current platform behavior).
        Billing uses Atai runtime rates — this list is not a price sheet.
      </p>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Default model</h2>
        <Label htmlFor="default-model" className="mt-3">Used when the app does not send a model</Label>
        <select
          id="default-model"
          className="mt-1 flex h-8 w-full max-w-md rounded-lg border border-border bg-background px-2 text-sm"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
        >
          <option value="">Platform default{data.platform.defaultModel ? ` (${data.platform.defaultModel})` : ""}</option>
          {catalog.map((m) => (
            <option key={m.id} value={m.id}>{m.label} · {m.id}</option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Allowed models</h2>
        <p className="mt-1 text-xs text-muted-foreground">Leave none checked to keep the platform unrestricted.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {catalog.map((m) => (
            <li key={m.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={allowed.includes(m.id)} onChange={() => toggle(m.id)} className="mt-1" />
                <span>
                  <span className="font-medium">{m.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{m.id}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Fallback chain</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Used only when no model is specified (after the default). Automatic retry after a provider failure is not enabled, so a failed call is not billed twice.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {catalog.map((m) => (
            <li key={m.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={fallback.includes(m.id)} onChange={() => toggleFallback(m.id)} className="mt-1" />
                <span className="font-mono text-xs">{m.id}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={allowEndUser} onChange={(e) => setAllowEndUser(e.target.checked)} className="mt-1" />
        <span>
          Allow the generated app to choose a model
          <span className="block text-xs text-muted-foreground">
            When off, request <code>input.model</code> is ignored and the default/fallback chain is used.
          </span>
        </span>
      </label>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <div>
        <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save model policy"}</Button>
      </div>
    </div>
  )
}
