"use client"

import { useEffect, useState } from "react"
import { useTheme, THEMES, THEME_LABELS, type Theme } from "@/components/theme-provider"
import { Monitor, Moon, Sun, Droplets, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ICONS: Record<Theme, React.ElementType> = {
  system: Monitor,
  dark: Moon,
  light: Sun,
  "light-blue": Droplets,
  glass: Sparkles,
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  // Prevent hydration mismatch: server always renders with the neutral "Monitor"
  // icon (matches the default "system" theme). After mount, we show the real icon
  // that matches whatever theme was read from localStorage.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Before mount: render a stable placeholder that matches the server output
  const ActiveIcon = mounted ? ICONS[theme] : Monitor
  const label = mounted ? `Theme: ${THEME_LABELS[theme]}` : "Change theme"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Change theme"
        title={label}
      >
        <ActiveIcon className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {THEMES.map((t) => {
          const Icon = ICONS[t]
          const isActive = mounted && theme === t
          return (
            <DropdownMenuItem
              key={t}
              onClick={() => setTheme(t)}
              className={`gap-2 ${isActive ? "text-primary font-medium" : ""}`}
            >
              <Icon className="size-4 shrink-0" />
              {THEME_LABELS[t]}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
