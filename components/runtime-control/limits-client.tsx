"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ConfigPayload {
  config: { limits: { requestsPerMinute?: number; requestsPerDay?: number } }
  platform: { requestsPerMinute: number; requestsPerDayMax: number; maxInFlightPerProcess: number }
}

export function RuntimeLimitsClient({ projectId }: { projectId: string }) {
  const { data, error, isLoading, mutate } = useSWR<ConfigPayload>(
    `/api/projects/${projectId}/runtime/config`,
    jsonFetcher,
  )
  const [rpm, setRpm] = useState("")
  const [rpd, setRpd] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setRpm(data.config.limits.requestsPerMinute?.toString() ?? "")
    setRpd(data.config.limits.requestsPerDay?.toString() ?? "")
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
          limits: {
            requestsPerMinute: rpm.trim() === "" ? null : Number(rpm),
            requestsPerDay: rpd.trim() === "" ? null : Number(rpd),
          },
        }),
      })
      const body = await res.json().catch(() => null)
      if (!body?.ok) throw new Error(body?.error?.message ?? "Could not save")
      await mutate()
      setMsg("Saved. Limits apply to new runtime requests.")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading limits…</p>
  if (error || !data) return <p role="alert" className="text-sm text-destructive">Could not load limits.</p>

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Leave a field empty to use platform defaults. Project limits can only be stricter than the platform, never looser.
      </p>

      <div>
        <Label htmlFor="rpm">Requests per minute</Label>
        <Input
          id="rpm"
          inputMode="numeric"
          placeholder={`Platform default: ${data.platform.requestsPerMinute} per key`}
          value={rpm}
          onChange={(e) => setRpm(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">Maximum {data.platform.requestsPerMinute}. Enforced with the existing rate limiter.</p>
      </div>

      <div>
        <Label htmlFor="rpd">Requests per day</Label>
        <Input
          id="rpd"
          inputMode="numeric"
          placeholder="No extra daily cap"
          value={rpd}
          onChange={(e) => setRpd(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">Optional. Maximum {data.platform.requestsPerDayMax.toLocaleString()}.</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Concurrent requests</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Per-project concurrency is not independently configurable. The platform caps in-flight work at{" "}
          {data.platform.maxInFlightPerProcess} requests per runtime process (fail-fast 429).
        </p>
      </div>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <div>
        <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save limits"}</Button>
      </div>
    </div>
  )
}
