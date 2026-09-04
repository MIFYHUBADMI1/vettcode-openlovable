"use client"

import useSWR from "swr"
import type { Project, ProjectSummary } from "@/lib/types/project"

export interface SessionUser {
  id: string
  email: string
  name: string
  authProvider: "password" | "google"
  emailVerified: boolean
  imageUrl?: string
  credits: number
  isAdmin?: boolean
  onboarding?: { source?: string; role?: string; signalType?: string; completedAt: number }
  suspended?: boolean
  banned?: boolean
  createdAt: number
}

export interface SessionInfo {
  userId: string
  user: SessionUser
  credits: {
    balance: number
    reserved: number
    available: number
  }
}

export interface CreditCostTable {
  configured: boolean
  mirrorSite: {
    initialBuild: { reserve: number; low: number; high: number; basis: string }
    followup: { reserve: number; low: number; high: number; basis: string }
  }
  provider: unknown
}

/** Every API route responds with the `{ ok, data }` / `{ ok: false, error }`
 * envelope from `lib/api/respond.ts`. These helpers unwrap it once so call
 * sites can work with plain payloads. */
type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code?: string; message?: string } }

function unwrap<T>(body: unknown, status: number): T {
  if (body && typeof body === "object" && "ok" in body) {
    const envelope = body as Envelope<T>
    if (envelope.ok) return envelope.data
    const err = new Error(envelope.error?.message ?? `Request failed (${status})`) as Error & { code?: string }
    err.code = envelope.error?.code
    throw err
  }
  throw new Error(`Request failed (${status})`)
}

export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } })
  const body = await res.json().catch(() => null)
  return unwrap<T>(body, res.status)
}

export async function postJson<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)
  return unwrap<T>(body, res.status)
}

export async function patchJson<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)
  return unwrap<T>(body, res.status)
}

export async function deleteJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { accept: "application/json" },
  })
  const body = await res.json().catch(() => null)
  return unwrap<T>(body, res.status)
}

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<SessionInfo>("/api/me", jsonFetcher, {
    // Refresh every 30s instead of 15s — half the MongoDB load.
    // SWR also respects the browser's Cache-Control max-age, so the server
    // can serve stale data while revalidating in the background.
    refreshInterval: 30000,
    // Prevent multiple SWR instances from firing within 15s of each other.
    dedupingInterval: 15000,
    // Revalidate when the tab regains focus (e.g. returning from another tab
    // after a build completed) without hammering the server.
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    // Keep previous data visible while revalidating — no loading spinners.
    keepPreviousData: true,
  })
  return { session: data, error, isLoading, refresh: mutate }
}

export function useCreditCosts() {
  const { data, error, isLoading } = useSWR<CreditCostTable>("/api/credit-costs", jsonFetcher)
  return { costs: data, error, isLoading }
}

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR<{ projects: ProjectSummary[] }>("/api/projects", jsonFetcher, {
    dedupingInterval: 10000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
  return { projects: data?.projects ?? [], error, isLoading, refresh: mutate }
}

export function useProject(id: string | null, options?: { pollWhileBuilding?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<{ project: Project }>(
    id ? `/api/projects/${id}` : null,
    jsonFetcher,
    {
      refreshInterval: (latest) => {
        if (!options?.pollWhileBuilding) return 0
        const state = latest?.project?.state
        return state === "building" || state === "analyzing" ? 3000 : 0
      },
    },
  )
  return { project: data?.project ?? null, error, isLoading, refresh: mutate }
}
