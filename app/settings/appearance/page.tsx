"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import {
  useTheme,
  THEMES,
  THEME_LABELS,
  THEME_DESCRIPTIONS,
  type Theme,
} from "@/components/theme-provider"
import { useSession } from "@/lib/client/api"
import { Monitor, Moon, Sun, Droplets, Sparkles, Check } from "lucide-react"

const THEME_ICONS: Record<Theme, React.ElementType> = {
  system: Monitor,
  dark: Moon,
  light: Sun,
  "light-blue": Droplets,
  glass: Sparkles,
}

// Mini preview swatch for each theme
function ThemePreview({ t }: { t: Theme }) {
  const configs: Record<Theme, { bg: string; card: string; dot: string }> = {
    system: {
      bg: "bg-gradient-to-br from-zinc-900 via-zinc-500 to-zinc-100",
      card: "bg-zinc-700/60",
      dot: "bg-orange-400",
    },
    dark: {
      bg: "bg-[#252525]",
      card: "bg-[#333333]",
      dot: "bg-orange-400",
    },
    light: {
      bg: "bg-white",
      card: "bg-[#f4f4f4]",
      dot: "bg-orange-500",
    },
    "light-blue": {
      bg: "bg-[#f0f4fb]",
      card: "bg-white",
      dot: "bg-blue-500",
    },
    glass: {
      bg: "bg-gradient-to-br from-indigo-950 via-blue-900 to-purple-950",
      card: "bg-white/10 backdrop-blur-sm border border-white/20",
      dot: "bg-violet-400",
    },
  }
  const c = configs[t]
  return (
    <div className={`relative h-16 w-full overflow-hidden rounded-lg ${c.bg}`}>
      <div className={`absolute left-2.5 top-2.5 h-7 w-14 rounded-md ${c.card}`} />
      <div className={`absolute bottom-2.5 right-2.5 h-4 w-10 rounded-full ${c.dot}`} />
      <div className="absolute bottom-3 left-2.5 flex flex-col gap-1">
        <div className="h-1 w-8 rounded-full bg-current opacity-20" />
        <div className="h-1 w-5 rounded-full bg-current opacity-15" />
      </div>
    </div>
  )
}

export default function AppearancePage() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    if (!isLoading && !session) router.replace("/login?next=%2Fsettings%2Fappearance")
  }, [session, isLoading, router])

  if (isLoading || !session) return null

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">

        {/* Back */}
        <Link
          href="/settings"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
        >
          ← Settings
        </Link>

        {/* Header */}
        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Preferences</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Appearance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a visual theme. Changes apply instantly and sync across devices when signed in.
          </p>
        </header>

        {/* Picker */}
        <section className="border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-5">Theme</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((t) => {
              const Icon = THEME_ICONS[t]
              const active = theme === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={[
                    "group relative flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-all duration-150",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                      : "border-border bg-background hover:border-primary/30 hover:bg-accent/40",
                  ].join(" ")}
                >
                  {/* Active checkmark */}
                  {active && (
                    <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}

                  <ThemePreview t={t} />

                  <div className="flex items-center gap-2 px-0.5">
                    <Icon className={`size-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-semibold text-foreground">{THEME_LABELS[t]}</span>
                  </div>

                  <p className="px-0.5 text-xs leading-5 text-muted-foreground">
                    {THEME_DESCRIPTIONS[t]}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Active theme info */}
        <section className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-3">
            {(() => { const Icon = THEME_ICONS[theme]; return <Icon className="size-4 text-primary shrink-0" /> })()}
            <div>
              <p className="text-sm font-medium">
                Active theme: <span className="text-primary">{THEME_LABELS[theme]}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{THEME_DESCRIPTIONS[theme]}</p>
            </div>
          </div>
          {theme === "glass" && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Glassmorphism uses <code className="rounded bg-muted px-1 font-mono">backdrop-filter: blur()</code>.
              Performance may vary on lower-end devices. Switch to Dark or Light if you notice slowness.
            </p>
          )}
          {theme === "system" && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Automatically switching between dark and light based on your OS setting.
            </p>
          )}
        </section>

      </div>
    </main>
  )
}
