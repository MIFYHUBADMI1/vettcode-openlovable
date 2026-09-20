"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { AuthView } from "@/lib/auth/client-intent"
import { persistReferralCode, sanitizeNext, savePendingStart } from "@/lib/auth/client-intent"

export type OpenAuthOptions = {
  view?: AuthView
  next?: string
  prompt?: string
}

type AuthModalContextValue = {
  isOpen: boolean
  view: AuthView
  next: string
  busy: boolean
  openAuth: (view?: AuthView, options?: OpenAuthOptions) => void
  closeAuth: (force?: boolean) => void
  setView: (view: AuthView) => void
  setBusy: (busy: boolean) => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

export function AuthModalStateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<AuthView>("login")
  const [next, setNext] = useState("/dashboard")
  const [busy, setBusy] = useState(false)

  const openAuth = useCallback((nextView: AuthView = "login", options?: OpenAuthOptions) => {
    if (typeof window !== "undefined") {
      persistReferralCode(new URLSearchParams(window.location.search).get("ref"))
    }
    const resolvedView = options?.view ?? nextView
    const resolvedNext = sanitizeNext(options?.next)
    if (options?.prompt?.trim()) {
      const existing = typeof window !== "undefined" ? sessionStorage.getItem("atai:pending-start") : null
      let prior: Record<string, unknown> = {}
      try {
        prior = existing ? (JSON.parse(existing) as Record<string, unknown>) : {}
      } catch {
        prior = {}
      }
      savePendingStart({
        ...prior,
        prompt: options.prompt.trim(),
        href: resolvedNext.startsWith("/start") || resolvedNext.startsWith("/new") ? resolvedNext : "/start",
      })
    }
    setView(resolvedView)
    setNext(resolvedNext)
    setBusy(false)
    setIsOpen(true)
  }, [])

  const closeAuth = useCallback((force = false) => {
    if (busy && !force) return
    setBusy(false)
    setIsOpen(false)
  }, [busy])

  const value = useMemo(
    () => ({ isOpen, view, next, busy, openAuth, closeAuth, setView, setBusy }),
    [isOpen, view, next, busy, openAuth, closeAuth],
  )

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>
}

export function useAuthModal() {
  const context = useContext(AuthModalContext)
  if (!context) {
    throw new Error("useAuthModal must be used within AuthProvider")
  }
  return context
}
