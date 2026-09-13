"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, KeyRound } from "lucide-react"

interface Secret {
  id: string
  name: string
  environment: string
  createdAt?: string
}

interface RequiredKey {
  isProvided: boolean
  description: string
}

interface EnvManagerProps {
  projectId: string
  initialRequiredKeys: Record<string, RequiredKey>
}

export function EnvManager({ projectId, initialRequiredKeys }: EnvManagerProps) {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [requiredKeys, setRequiredKeys] = useState(initialRequiredKeys)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  // New secret form state
  const [newName, setNewName] = useState("")
  const [newValue, setNewValue] = useState("")
  const [newEnv, setNewEnv] = useState("production")
  const [showValue, setShowValue] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchSecrets() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/secrets`)
      const data = await res.json()
      if (res.ok) {
        setSecrets(data.data.secrets)
        setRequiredKeys(data.data.requiredKeys ?? {})
      }
    } catch {
      toast.error("Failed to load secrets")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSecrets() }, [projectId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newValue.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/secrets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), value: newValue, environment: newEnv }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "Failed to add secret"); return }
      toast.success(`${data.data.secret.name} added`)
      setNewName(""); setNewValue(""); setAdding(false)
      await fetchSecrets()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(secretId: string, secretName: string) {
    setDeletingId(secretId)
    try {
      const res = await fetch(`/api/projects/${projectId}/secrets/${secretId}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); toast.error(d.message || "Failed to delete"); return }
      toast.success(`${secretName} removed`)
      setSecrets(prev => prev.filter(s => s.id !== secretId))
    } finally {
      setDeletingId(null)
    }
  }

  // Keys that are required but not yet set
  const missingRequired = Object.entries(requiredKeys).filter(
    ([key, val]) => !val.isProvided && !secrets.some(s => s.name === key)
  )

  // Pre-fill form when clicking a required key
  function fillRequired(key: string) {
    setNewName(key)
    setNewValue("")
    setAdding(true)
    setTimeout(() => document.getElementById("env-value-input")?.focus(), 100)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Required keys alert */}
      {missingRequired.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex flex-col gap-3 w-full min-w-0">
              <div>
                <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                  {missingRequired.length} required variable{missingRequired.length > 1 ? "s" : ""} missing
                </p>
                <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
                  The AI identified these as required for your app to function. Click any to add it.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {missingRequired.map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => fillRequired(key)}
                    className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-left transition-colors hover:bg-amber-500/15 w-full"
                  >
                    <div className="min-w-0">
                      <code className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">{key}</code>
                      <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/70">{meta.description}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">+ Add</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All keys provided confirmation */}
      {Object.keys(requiredKeys).length > 0 && missingRequired.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            All required variables are set — your app should be fully functional
          </p>
        </div>
      )}

      {/* Current secrets list */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Environment Variables
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {secrets.length} variable{secrets.length !== 1 ? "s" : ""} set
            </p>
          </div>
          <button
            onClick={() => { setAdding(v => !v); setNewName(""); setNewValue("") }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Add variable
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <form onSubmit={handleAdd} className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">New variable</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="env-name-input" className="text-xs font-medium text-muted-foreground">Key name</label>
                <input
                  id="env-name-input"
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                  placeholder="MY_API_KEY"
                  autoFocus
                  className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="env-value-input" className="text-xs font-medium text-muted-foreground">Value</label>
                <div className="relative">
                  <input
                    id="env-value-input"
                    type={showValue ? "text" : "password"}
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showValue ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Environment</label>
              <div className="flex gap-2">
                {["production", "development", "preview"].map(env => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => setNewEnv(env)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${newEnv === env ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting || !newName.trim() || !newValue.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {submitting ? "Saving…" : "Save variable"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Secrets list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading variables…
          </div>
        ) : secrets.length === 0 && !adding ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <KeyRound className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No variables set yet</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs">
              Add your first environment variable to inject secrets like API keys, database URLs, and tokens into your app.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {secrets.map(secret => {
              const isRequired = secret.name in requiredKeys
              return (
                <div key={secret.id} className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${isRequired ? "bg-green-500/15" : "bg-muted"}`}>
                      <KeyRound className={`size-3.5 ${isRequired ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-sm font-semibold text-foreground">{secret.name}</code>
                        {isRequired && (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">required ✓</span>
                        )}
                        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground capitalize">{secret.environment}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground/50">••••••••••••  (value hidden)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(secret.id, secret.name)}
                    disabled={deletingId === secret.id}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    aria-label={`Delete ${secret.name}`}
                  >
                    {deletingId === secret.id
                      ? <Loader2 className="size-4 animate-spin" />
                      : <Trash2 className="size-4" />
                    }
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">How it works</p>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />Variables are stored encrypted in Totalum and injected at runtime — they are never exposed in your code or logs.</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />Values are write-only — once saved, they cannot be read back. To update, delete and re-add.</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />Access via <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">process.env.MY_KEY</code> or <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Bun.env.MY_KEY</code> in your app.</li>
          <li className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />After adding variables, restart or redeploy your app for changes to take effect.</li>
        </ul>
      </div>

    </div>
  )
}
