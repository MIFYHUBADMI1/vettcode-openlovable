"use client"

import { useEffect, useRef } from "react"
import useSWR from "swr"
import { useClientStore } from "@/lib/store/client-store"
import type { Project, ProjectSummary } from "@/lib/types/project"

export interface SessionUser {
  id: string
  email: string
  name: string
  authProvider: "password" | "google"
  emailVerified: boolean
  imageUrl?: string
  /** Connection STATUS only — the GitHub access token never leaves the server. */
  githubConnected?: boolean
  /** Non-secret GitHub login name, for display when githubConnected. */
  githubUsername?: string
  credits: number
  isAdmin?: boolean
  onboarding?: {
    /** Legacy fields */
    source?: string
    signalType?: "url" | "idea"
    /** New founder-focused fields (Requirement 6) */
    businessDescription?: string
    role?: string
    destination?: string
    /** Always set when onboarding is complete */
    completedAt?: number
    dismissedAt?: number
  }
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

export type BuildTier = "simple" | "medium" | "complex"

export interface CreditCostTable {
  configured: boolean
  Atai: {
    initialBuild: { reserve: number; low: number; high: number; basis: string }
    followup: { reserve: number; low: number; high: number; basis: string }
  }
  provider: unknown
  /** Structured per-tier build costs (legacy/heavy pipeline modes) for client display. */
  buildTiers?: Record<BuildTier, { label: string; legacy: number; heavy: number }>
  /** Per-tier follow-up edit costs (matches the server's getBuildCost). */
  followupByTier?: Record<BuildTier, number>
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
  const res = await fetch(url, { headers: { accept: "application/json" }, credentials: "include" })
  const body = await res.json().catch(() => null)
  return unwrap<T>(body, res.status)
}

export async function postJson<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
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

// ─── useSession ───────────────────────────────────────────────────────────────
//
// Backed by Zustand instead of a raw SWR subscription.
//
// Previous behaviour: SWR polled /api/me every 30s from EVERY component that
// called useSession (account-menu, credit-meter, edit-workspace, etc.), each
// creating its own subscription with a 15s dedup window. Under load with many
// concurrent users that's a lot of unnecessary DB reads.
//
// New behaviour:
// - Data lives in the Zustand store — one fetch shared across all components.
// - Background refresh runs once per tab every 120s (not per component).
// - Any action that changes credits calls invalidateSession() for an immediate
//   targeted re-fetch instead of waiting for the next poll cycle.
// - On logout, clearAll() wipes the store so no data bleeds to the next session.

export function useSession() {
  const session = useClientStore((s) => s.session)
  const sessionLoading = useClientStore((s) => s.sessionLoading)
  const sessionError = useClientStore((s) => s.sessionError)
  const fetchSession = useClientStore((s) => s.fetchSession)
  const invalidateSession = useClientStore((s) => s.invalidateSession)
  const startSessionRefresh = useClientStore((s) => s.startSessionRefresh)
  const stopSessionRefresh = useClientStore((s) => s.stopSessionRefresh)
  const sessionFetchedAt = useClientStore((s) => s.sessionFetchedAt)

  // Fetch on first mount if we have no data yet
  useEffect(() => {
    if (!session && !sessionLoading && !sessionFetchedAt) {
      void fetchSession()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start the background refresh loop when this hook mounts; stop on unmount.
  // Multiple callers are safe — startSessionRefresh is a no-op if already running.
  useEffect(() => {
    startSessionRefresh()
    return () => stopSessionRefresh()
  }, [startSessionRefresh, stopSessionRefresh])

  return {
    session,
    error: sessionError ? new Error(sessionError) : null,
    // isLoading is true when:
    // 1. A fetch is actively in flight, OR
    // 2. We have never fetched yet (sessionFetchedAt is null) and have no session
    //    — covers the window between mount and the first useEffect fetch completing.
    isLoading: sessionLoading || (!session && !sessionFetchedAt),
    refresh: invalidateSession,
  }
}

// ─── useProjects ──────────────────────────────────────────────────────────────
//
// Backed by Zustand — one fetch per session, not per component mount.
//
// Previous behaviour: SWR revalidated on every focus event with no polling
// floor, so switching tabs repeatedly could hammer /api/projects.
//
// New behaviour: fetch once on first access, serve from store.
// Invalidate explicitly after project create/delete/rename.

export function useProjects() {
  const projects = useClientStore((s) => s.projects)
  const projectsLoading = useClientStore((s) => s.projectsLoading)
  const projectsError = useClientStore((s) => s.projectsError)
  const fetchProjects = useClientStore((s) => s.fetchProjects)
  const invalidateProjects = useClientStore((s) => s.invalidateProjects)
  const projectsFetchedAt = useClientStore((s) => s.projectsFetchedAt)

  useEffect(() => {
    if (projects.length === 0 && !projectsLoading && !projectsFetchedAt) {
      void fetchProjects()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    projects,
    error: projectsError ? new Error(projectsError) : null,
    isLoading: projectsLoading && projects.length === 0,
    // refresh() re-fetches the list — call after create/delete/rename
    refresh: invalidateProjects,
  }
}

// ─── useCreditCosts ───────────────────────────────────────────────────────────
//
// Fetched once per session from the Zustand store.
// Previously had no dedup config — could refetch every 2s on remount.

export function useCreditCosts() {
  const creditCosts = useClientStore((s) => s.creditCosts)
  const creditCostsLoading = useClientStore((s) => s.creditCostsLoading)
  const fetchCreditCosts = useClientStore((s) => s.fetchCreditCosts)

  useEffect(() => {
    void fetchCreditCosts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { costs: creditCosts, isLoading: creditCostsLoading, error: null }
}

// ─── usePublicStats ───────────────────────────────────────────────────────────
// Landing page only — kept as SWR with a long dedup window.

export function usePublicStats() {
  const { data } = useSWR<{ builders: number }>("/api/public/stats", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  return data?.builders ?? 0
}

// ─── useProject ───────────────────────────────────────────────────────────────
// Per-project live data — kept as SWR because it genuinely changes on the server.

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

// ─── useProjectActivity ───────────────────────────────────────────────────────
//
// CANONICAL hook for /api/projects/{id}/activity.
//
// Previously three separate useSWR calls existed in:
//  - edit-workspace.tsx body (5s/30s)
//  - edit-workspace.tsx ConversationTab (5s/15s)
//  - project-activity.tsx (10s always)
//
// Each created its own SWR subscription with its own timer. Even though SWR
// deduplicates the actual network request, three independent timers meant the
// minimum polling interval was effectively the lowest of all three. With the
// project in an idle state that was still 10s.
//
// Now: one hook, one SWR key, one timer. All consumers share the same cache
// entry. Idle interval raised to 60s — activity only changes during builds.

export interface ActivityEvent {
  id: string
  at: number
  level: string
  stage: string
  message: string
}

export function useProjectActivity(projectId: string, isBuilding: boolean) {
  const { data, error, isLoading, mutate } = useSWR<{ events?: ActivityEvent[]; data?: { events?: ActivityEvent[] } }>(
    projectId ? `/api/projects/${projectId}/activity` : null,
    jsonFetcher,
    {
      // Building: 5s — need fast event updates
      // Idle: 60s — activity doesn't change when nothing is happening
      refreshInterval: isBuilding ? 5000 : 60000,
      dedupingInterval: 4000,
      keepPreviousData: true,
      revalidateOnFocus: isBuilding, // only revalidate on focus when something can have changed
    },
  )
  return {
    events: data?.events ?? data?.data?.events ?? [],
    error,
    isLoading,
    refresh: mutate,
  }
}

// ─── useProjectStatus ─────────────────────────────────────────────────────────
//
// Canonical hook for /api/projects/{id}/status.
// Disabled (key = null) when the project is not in an active state,
// preventing unnecessary Totalum sync calls on idle projects.

export function useProjectStatus(projectId: string, isActive: boolean) {
  const { data, error, mutate } = useSWR(
    isActive ? `/api/projects/${projectId}/status` : null,
    jsonFetcher,
    {
      // Active builds: 10s is enough — 3s was too aggressive for Totalum
      refreshInterval: 10000,
      dedupingInterval: 5000,
      keepPreviousData: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )
  return { statusData: data, error, refresh: mutate }
}
