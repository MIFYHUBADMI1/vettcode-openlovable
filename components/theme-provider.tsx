"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type Theme = "system" | "dark" | "light" | "light-blue" | "glass"

export const THEMES: Theme[] = ["system", "dark", "light", "light-blue", "glass"]

export const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  dark: "Dark",
  light: "Light",
  "light-blue": "Light Blue",
  glass: "Glass",
}

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  system: "Follows your OS preference automatically",
  dark: "Dark background, easy on the eyes",
  light: "Clean white background",
  "light-blue": "Soft blue-tinted light theme",
  glass: "Translucent glassmorphism surfaces",
}

const STORAGE_KEY = "atai:theme"

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "dark" | "light" | "glass"
  setTheme: (theme: Theme) => void
  themes: Theme[]
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => { },
  themes: THEMES,
})

// ─── Helper: apply theme classes to <html> ────────────────────────────────────

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(theme: Theme, systemDark: boolean) {
  const root = document.documentElement
  root.classList.remove("dark", "theme-glass", "theme-light-blue")
  switch (theme) {
    case "dark":
      root.classList.add("dark")
      break
    case "light":
      break // bare :root variables = light
    case "light-blue":
      root.classList.add("theme-light-blue")
      break
    case "glass":
      root.classList.add("theme-glass")
      break
    case "system":
    default:
      if (systemDark) root.classList.add("dark")
      break
  }
}

function resolve(theme: Theme, systemDark: boolean): "dark" | "light" | "glass" {
  if (theme === "glass") return "glass"
  if (theme === "dark") return "dark"
  if (theme === "light" || theme === "light-blue") return "light"
  // system
  return systemDark ? "dark" : "light"
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Read the correct system preference synchronously on first render
  // so there is never a "wrong default" flash.
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemDark())

  // Keep a ref so callbacks that capture this value are always fresh
  const systemDarkRef = useRef(systemDark)
  useEffect(() => { systemDarkRef.current = systemDark }, [systemDark])

  const [theme, setThemeState] = useState<Theme>(() => {
    // Read localStorage synchronously so the initial state is already correct
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored && THEMES.includes(stored)) return stored
    } catch { }
    return "system"
  })

  // Apply theme to DOM immediately on first render (before paint)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Apply correct classes based on what we already know
    applyTheme(theme, getSystemDark())
    setMounted(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for OS-level preference changes and re-apply if theme is "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches)
      // Only re-apply if user is on "system" theme
      setThemeState((current) => {
        if (current === "system") applyTheme("system", e.matches)
        return current
      })
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // After mount: load saved theme from DB — DB preference wins over localStorage (AC 8)
  useEffect(() => {
    if (!mounted) return
    fetch("/api/user/theme", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.data?.theme) return
        const dbTheme = data.data.theme as Theme
        if (!THEMES.includes(dbTheme)) return
        setThemeState((current) => {
          if (current === dbTheme) return current
          localStorage.setItem(STORAGE_KEY, dbTheme)
          applyTheme(dbTheme, systemDarkRef.current)
          return dbTheme
        })
      })
      .catch(() => {
        // Unauthenticated or offline — localStorage value is authoritative
      })
  }, [mounted])

  const setTheme = useCallback((next: Theme) => {
    if (!THEMES.includes(next)) return
    const sd = systemDarkRef.current
    setThemeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { }
    applyTheme(next, sd)

    // Persist to DB fire-and-forget (AC 7)
    fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // Not authenticated — localStorage is enough
    })
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme: resolve(theme, systemDark),
        setTheme,
        themes: THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
