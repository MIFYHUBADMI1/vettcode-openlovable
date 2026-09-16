"use client"

/**
 * Client-side Zustand store for stable, session-scoped data.
 *
 * WHY ZUSTAND INSTEAD OF PURE SWR HERE:
 * SWR is ideal for data that can change server-side without user action
 * (project build state, live activity, etc.). But for data that only
 * changes as a direct result of user actions — session info, project list,
 * credit cost table — polling the DB every 30s per browser tab is wasteful.
 *
 * This store:
 * 1. Fetches once on first access and serves from memory for the rest of
 *    the session (no per-component SWR subscription overhead).
 * 2. Exposes invalidate() and refresh() so any action that mutates data can
 *    trigger a targeted re-fetch instead of relying on timers.
 * 3. Clears completely on logout so no data bleeds between accounts.
 *
 * Polling cadence:
 * - Session (/api/me): background refresh every 120s (was 30s) + on-demand
 *   invalidation after any credits-changing action (build, top-up, etc.)
 * - Projects (/api/projects): no background polling; invalidated on create,
 *   delete, or explicit refresh only.
 * - CreditCosts (/api/credit-costs): fetched once, never re-fetched
 *   (config only changes on deployments).
 */

import { create } from "zustand"
import type { SessionInfo, CreditCostTable } from "@/lib/client/api"
import type { ProjectSummary } from "@/lib/types/project"

// ─── Helpers ────────────────────────────────────────────────────────────────

const SESSION_REFRESH_INTERVAL_MS = 120_000 // 2 minutes
const STALE_THRESHOLD_MS = 60_000 // consider stale after 60s

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" })
  const body = await res.json().catch(() => null)
  if (body && typeof body === "object" && "ok" in body) {
    if (body.ok) return body.data as T
    throw new Error((body as { error?: { message?: string } }).error?.message ?? `Request failed (${res.status})`)
  }
  throw new Error(`Request failed (${res.status})`)
}

// ─── Session slice ───────────────────────────────────────────────────────────

interface SessionSlice {
  session: SessionInfo | null
  sessionLoading: boolean
  sessionError: string | null
  sessionFetchedAt: number | null
  /** Background refresh timer id */
  _sessionTimer: ReturnType<typeof setInterval> | null

  fetchSession: () => Promise<void>
  /** Immediately re-fetch session (e.g. after a build or top-up changes credits) */
  invalidateSession: () => Promise<void>
  /** Start a 2-minute background refresh loop */
  startSessionRefresh: () => void
  stopSessionRefresh: () => void
}

// ─── Projects slice ──────────────────────────────────────────────────────────

interface ProjectsSlice {
  projects: ProjectSummary[]
  projectsLoading: boolean
  projectsError: string | null
  projectsFetchedAt: number | null

  fetchProjects: () => Promise<void>
  /** Re-fetch after create/delete/rename */
  invalidateProjects: () => Promise<void>
}

// ─── CreditCosts slice ───────────────────────────────────────────────────────

interface CreditCostsSlice {
  creditCosts: CreditCostTable | null
  creditCostsLoading: boolean
  creditCostsFetchedAt: number | null

  fetchCreditCosts: () => Promise<void>
}

// ─── Lifecycle slice ─────────────────────────────────────────────────────────

interface LifecycleSlice {
  /** Wipe all data — called on logout */
  clearAll: () => void
}

// ─── Combined store type ─────────────────────────────────────────────────────

type ClientStore = SessionSlice & ProjectsSlice & CreditCostsSlice & LifecycleSlice

// ─── Store implementation ────────────────────────────────────────────────────

export const useClientStore = create<ClientStore>((set, get) => ({

  // ── Session ────────────────────────────────────────────────────────────────

  session: null,
  sessionLoading: false,
  sessionError: null,
  sessionFetchedAt: null,
  _sessionTimer: null,

  fetchSession: async () => {
    // Skip if a fetch is already in flight
    if (get().sessionLoading) return
    set({ sessionLoading: true, sessionError: null })
    try {
      const data = await apiFetch<SessionInfo>("/api/me")
      set({ session: data, sessionLoading: false, sessionFetchedAt: Date.now() })
    } catch (e) {
      set({
        sessionLoading: false,
        sessionError: e instanceof Error ? e.message : "Failed to load session",
      })
    }
  },

  invalidateSession: async () => {
    // Force a re-fetch regardless of how recently we fetched
    set({ sessionFetchedAt: null })
    await get().fetchSession()
  },

  startSessionRefresh: () => {
    const existing = get()._sessionTimer
    if (existing) return // already running
    const timer = setInterval(() => {
      const { sessionFetchedAt, sessionLoading } = get()
      // Only re-fetch if data is actually stale and no fetch is in flight
      if (!sessionLoading && (!sessionFetchedAt || Date.now() - sessionFetchedAt > STALE_THRESHOLD_MS)) {
        void get().fetchSession()
      }
    }, SESSION_REFRESH_INTERVAL_MS)
    set({ _sessionTimer: timer })
  },

  stopSessionRefresh: () => {
    const timer = get()._sessionTimer
    if (timer) {
      clearInterval(timer)
      set({ _sessionTimer: null })
    }
  },

  // ── Projects ───────────────────────────────────────────────────────────────

  projects: [],
  projectsLoading: false,
  projectsError: null,
  projectsFetchedAt: null,

  fetchProjects: async () => {
    if (get().projectsLoading) return
    set({ projectsLoading: true, projectsError: null })
    try {
      const data = await apiFetch<{ projects: ProjectSummary[] }>("/api/projects")
      set({ projects: data.projects, projectsLoading: false, projectsFetchedAt: Date.now() })
    } catch (e) {
      set({
        projectsLoading: false,
        projectsError: e instanceof Error ? e.message : "Failed to load projects",
      })
    }
  },

  invalidateProjects: async () => {
    set({ projectsFetchedAt: null })
    await get().fetchProjects()
  },

  // ── CreditCosts ────────────────────────────────────────────────────────────

  creditCosts: null,
  creditCostsLoading: false,
  creditCostsFetchedAt: null,

  fetchCreditCosts: async () => {
    // Only fetch once per session — cost table doesn't change at runtime
    if (get().creditCosts || get().creditCostsLoading) return
    set({ creditCostsLoading: true })
    try {
      const data = await apiFetch<CreditCostTable>("/api/credit-costs")
      set({ creditCosts: data, creditCostsLoading: false, creditCostsFetchedAt: Date.now() })
    } catch {
      set({ creditCostsLoading: false })
    }
  },

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  clearAll: () => {
    const timer = get()._sessionTimer
    if (timer) clearInterval(timer)
    set({
      session: null,
      sessionLoading: false,
      sessionError: null,
      sessionFetchedAt: null,
      _sessionTimer: null,
      projects: [],
      projectsLoading: false,
      projectsError: null,
      projectsFetchedAt: null,
      creditCosts: null,
      creditCostsLoading: false,
      creditCostsFetchedAt: null,
    })
  },
}))

// ─── Convenience selectors (stable references, no re-render on unrelated changes) ──

export const selectSession = (s: ClientStore) => s.session
export const selectSessionLoading = (s: ClientStore) => s.sessionLoading
export const selectProjects = (s: ClientStore) => s.projects
export const selectProjectsLoading = (s: ClientStore) => s.projectsLoading
export const selectCreditCosts = (s: ClientStore) => s.creditCosts
