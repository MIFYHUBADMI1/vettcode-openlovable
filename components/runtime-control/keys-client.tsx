"use client"

import { useState } from "react"
import useSWR from "swr"
import { jsonFetcher, postJson } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SecretOnceBanner } from "./secret-once"
import { formatWhen } from "./format"

interface ApiKey {
  id: string
  environment: "development" | "production"
  name?: string
  keyPrefix: string
  scopes: string[]
  status: string
  createdAt: number
  lastUsedAt?: number
  expiresAt?: number
}

export function RuntimeKeysClient({ projectId }: { projectId: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ keys: ApiKey[] }>(
    `/api/runtime/keys?projectId=${encodeURIComponent(projectId)}`,
    jsonFetcher,
  )
  const [name, setName] = useState("")
  const [environment, setEnvironment] = useState<"development" | "production">("development")
  const [secret, setSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function createKey() {
    setBusy(true)
    setFormError(null)
    try {
      const created = await postJson<ApiKey & { secret: string }>(
        `/api/runtime/keys?projectId=${encodeURIComponent(projectId)}`,
        { name: name.trim() || undefined, environment },
      )
      setSecret(created.secret)
      setName("")
      await mutate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create key")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Existing apps using it will stop working immediately.")) return
    setBusy(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/runtime/keys/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ reason: "revoked_from_control_center" }),
      })
      const body = await res.json().catch(() => null)
      if (!body?.ok) throw new Error(body?.error?.message ?? "Could not revoke key")
      await mutate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not revoke key")
    } finally {
      setBusy(false)
    }
  }

  async function rotate(id: string) {
    if (!confirm("Rotate this key? The old secret stops working immediately. The new secret is shown once.")) return
    setBusy(true)
    setFormError(null)
    try {
      const rotated = await postJson<ApiKey & { secret: string }>(`/api/runtime/keys/${id}/rotate`)
      setSecret(rotated.secret)
      await mutate()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not rotate key")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {secret ? <SecretOnceBanner secret={secret} onDismiss={() => setSecret(null)} /> : null}
      {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Create key</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The plaintext secret is shown once. Empty scopes grant every runtime capability.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="key-name">Name</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production app" />
          </div>
          <div>
            <Label htmlFor="key-env">Environment</Label>
            <select
              id="key-env"
              className="flex h-8 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "development" | "production")}
            >
              <option value="development">development</option>
              <option value="production">production</option>
            </select>
          </div>
          <Button type="button" onClick={createKey} disabled={busy}>Create key</Button>
        </div>
      </section>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading keys…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">Could not load keys.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Prefix</th>
              <th className="px-3 py-2 font-medium">Env</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last used</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(data?.keys ?? []).map((key) => (
              <tr key={key.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs">{key.keyPrefix}</div>
                  {key.name ? <div className="text-xs text-muted-foreground">{key.name}</div> : null}
                </td>
                <td className="px-3 py-2 text-xs">{key.environment}</td>
                <td className="px-3 py-2 text-xs">{key.status}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatWhen(key.lastUsedAt)}</td>
                <td className="px-3 py-2 text-right">
                  {key.status === "active" ? (
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => rotate(key.id)}>
                        Rotate
                      </Button>
                      <Button type="button" size="xs" variant="destructive" disabled={busy} onClick={() => revoke(key.id)}>
                        Revoke
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.keys.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No keys yet.</p>
        ) : null}
      </div>
    </div>
  )
}
