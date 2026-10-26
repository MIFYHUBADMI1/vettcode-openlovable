"use client"

import { useState } from "react"
import { Palette, Moon, Sun, Monitor, Check, Sparkles } from "lucide-react"
import { CofounderMarkdown } from "@/components/cofounder/markdown"

export interface ThemeConfig {
  mode: "light" | "dark" | "system"
  primaryColor: string
  accentColor?: string
  fontHeading?: string
  fontBody?: string
  fontMono?: string
  density?: "compact" | "comfortable" | "spacious"
  borderRadius?: "none" | "small" | "medium" | "large"
  preset?: string
}

interface ThemeBuilderProps {
  value: string // JSON string or markdown
  onChange: (value: string) => void
  readonly?: boolean
}

const COLOR_PRESETS = [
  { name: "Blue", value: "#3b82f6", desc: "Professional and trustworthy" },
  { name: "Purple", value: "#a855f7", desc: "Creative and modern" },
  { name: "Green", value: "#10b981", desc: "Growth and harmony" },
  { name: "Orange", value: "#f97316", desc: "Energetic and warm" },
  { name: "Pink", value: "#ec4899", desc: "Friendly and approachable" },
  { name: "Teal", value: "#14b8a6", desc: "Fresh and balanced" },
  { name: "Red", value: "#ef4444", desc: "Bold and attention-grabbing" },
  { name: "Indigo", value: "#6366f1", desc: "Sophisticated and stable" },
]

const FONT_PRESETS = {
  heading: [
    { name: "Inter", value: "Inter, sans-serif", type: "Modern" },
    { name: "Poppins", value: "Poppins, sans-serif", type: "Friendly" },
    { name: "Montserrat", value: "Montserrat, sans-serif", type: "Bold" },
    { name: "Playfair Display", value: "Playfair Display, serif", type: "Elegant" },
    { name: "Space Grotesk", value: "Space Grotesk, sans-serif", type: "Tech" },
  ],
  body: [
    { name: "Inter", value: "Inter, sans-serif", type: "Clean" },
    { name: "Open Sans", value: "Open Sans, sans-serif", type: "Readable" },
    { name: "Lato", value: "Lato, sans-serif", type: "Friendly" },
    { name: "Source Sans 3", value: "Source Sans 3, sans-serif", type: "Professional" },
    { name: "System UI", value: "system-ui, sans-serif", type: "Native" },
  ],
  mono: [
    { name: "JetBrains Mono", value: "JetBrains Mono, monospace", type: "Dev" },
    { name: "Fira Code", value: "Fira Code, monospace", type: "Ligatures" },
    { name: "Source Code Pro", value: "Source Code Pro, monospace", type: "Classic" },
    { name: "Courier New", value: "Courier New, monospace", type: "Traditional" },
  ],
}

const THEME_PRESETS = [
  { 
    id: "modern", 
    name: "Modern SaaS", 
    config: { primaryColor: "#3b82f6", density: "comfortable" as const, borderRadius: "medium" as const },
    desc: "Clean, professional design for B2B products"
  },
  { 
    id: "vibrant", 
    name: "Vibrant Startup", 
    config: { primaryColor: "#a855f7", density: "comfortable" as const, borderRadius: "large" as const },
    desc: "Bold and energetic for consumer apps"
  },
  { 
    id: "minimal", 
    name: "Minimal", 
    config: { primaryColor: "#000000", density: "spacious" as const, borderRadius: "none" as const },
    desc: "Ultra-clean design with maximum whitespace"
  },
  { 
    id: "warm", 
    name: "Warm & Friendly", 
    config: { primaryColor: "#f97316", density: "comfortable" as const, borderRadius: "large" as const },
    desc: "Welcoming design for community platforms"
  },
]

const DEFAULT_THEME: ThemeConfig = {
  mode: "system",
  primaryColor: "#3b82f6",
  density: "comfortable",
  borderRadius: "medium",
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

function normalizeTheme(raw: Partial<ThemeConfig>): ThemeConfig {
  const mode = raw.mode === "light" || raw.mode === "dark" ? raw.mode : "system"
  const density = raw.density === "compact" || raw.density === "spacious" ? raw.density : "comfortable"
  const borderRadius =
    raw.borderRadius === "none" || raw.borderRadius === "small" || raw.borderRadius === "large"
      ? raw.borderRadius
      : "medium"
  return {
    mode,
    density,
    borderRadius,
    primaryColor: typeof raw.primaryColor === "string" && HEX_COLOR.test(raw.primaryColor) ? raw.primaryColor : DEFAULT_THEME.primaryColor,
    ...(typeof raw.accentColor === "string" && HEX_COLOR.test(raw.accentColor) ? { accentColor: raw.accentColor } : {}),
    ...(typeof raw.fontHeading === "string" && raw.fontHeading ? { fontHeading: raw.fontHeading } : {}),
    ...(typeof raw.fontBody === "string" && raw.fontBody ? { fontBody: raw.fontBody } : {}),
    ...(typeof raw.fontMono === "string" && raw.fontMono ? { fontMono: raw.fontMono } : {}),
    ...(typeof raw.preset === "string" && THEME_PRESETS.some((p) => p.id === raw.preset) ? { preset: raw.preset } : {}),
  }
}

/** Parse the markdown `serializeTheme` emits so opening the editor on a saved
 * section round-trips instead of resetting it to defaults. Returns null when
 * the text isn't a recognizable theme description (free-form AI prose). */
function parseThemeMarkdown(value: string): ThemeConfig | null {
  const primary = value.match(/\*\*Primary Color\*\*:\s*([^\s]+)/i)?.[1]
  const accent = value.match(/\*\*Accent Color\*\*:\s*([^\s]+)/i)?.[1]
  const modeRaw = value.match(/\*\*Mode\*\*:\s*(.+)/i)?.[1]?.trim().toLowerCase() ?? ""
  const fontHeading = value.match(/\*\*Headings\*\*:\s*(.+)/i)?.[1]?.trim()
  const fontBody = value.match(/\*\*Body Text\*\*:\s*(.+)/i)?.[1]?.trim()
  const fontMono = value.match(/\*\*Monospace(?: \(code\))?\*\*:\s*(.+)/i)?.[1]?.trim()
  const density = value.match(/\*\*Density\*\*:\s*(compact|comfortable|spacious)/i)?.[1]?.toLowerCase()
  const radius = value.match(/\*\*Border Radius\*\*:\s*(none|small|medium|large)/i)?.[1]?.toLowerCase()
  const direction = value.match(/\*\*Design Direction\*\*:\s*([^\n-]+)/i)?.[1]?.trim()

  const recognized = primary || accent || modeRaw || fontHeading || fontBody || fontMono || density || radius
  if (!recognized) return null

  const preset = THEME_PRESETS.find((p) => direction && p.name.toLowerCase() === direction.toLowerCase())

  return normalizeTheme({
    mode: modeRaw.startsWith("dark") ? "dark" : modeRaw.startsWith("light") ? "light" : "system",
    ...(primary ? { primaryColor: primary } : {}),
    ...(accent ? { accentColor: accent } : {}),
    ...(fontHeading ? { fontHeading } : {}),
    ...(fontBody ? { fontBody } : {}),
    ...(fontMono ? { fontMono } : {}),
    ...(density ? { density: density as ThemeConfig["density"] } : {}),
    ...(radius ? { borderRadius: radius as ThemeConfig["borderRadius"] } : {}),
    ...(preset ? { preset: preset.id } : {}),
  })
}

function parseTheme(value: string): ThemeConfig | null {
  if (!value || value.trim().length === 0) return null
  const trimmed = value.trim()
  if (trimmed.startsWith("{")) {
    try {
      return normalizeTheme(JSON.parse(trimmed) as Partial<ThemeConfig>)
    } catch {
      // Malformed JSON — let the markdown parser decide.
    }
  }
  return parseThemeMarkdown(trimmed)
}

function serializeTheme(config: ThemeConfig): string {
  // Generate markdown format for the AI builder
  let markdown = "# Theme & Appearance\n\n"
  
  markdown += `## Color Scheme\n\n`
  markdown += `**Primary Color**: ${config.primaryColor}\n`
  if (config.accentColor) markdown += `**Accent Color**: ${config.accentColor}\n`
  markdown += `**Mode**: ${config.mode === "system" ? "Automatic (follows user system preference)" : config.mode.charAt(0).toUpperCase() + config.mode.slice(1)}\n\n`
  
  markdown += `## Typography\n\n`
  if (config.fontHeading) markdown += `**Headings**: ${config.fontHeading}\n`
  if (config.fontBody) markdown += `**Body Text**: ${config.fontBody}\n`
  if (config.fontMono) markdown += `**Monospace (code)**: ${config.fontMono}\n\n`
  
  markdown += `## Visual Style\n\n`
  if (config.density) markdown += `**Density**: ${config.density.charAt(0).toUpperCase() + config.density.slice(1)} - ${
    config.density === "compact" ? "More content in less space" :
    config.density === "comfortable" ? "Balanced spacing for most use cases" :
    "Maximum whitespace for focus"
  }\n`
  if (config.borderRadius) markdown += `**Border Radius**: ${config.borderRadius.charAt(0).toUpperCase() + config.borderRadius.slice(1)} - ${
    config.borderRadius === "none" ? "Sharp, minimal design" :
    config.borderRadius === "small" ? "Subtle rounded corners" :
    config.borderRadius === "medium" ? "Modern, friendly rounded corners" :
    "Highly rounded, playful design"
  }\n`
  
  if (config.preset) {
    const preset = THEME_PRESETS.find(p => p.id === config.preset)
    if (preset) markdown += `\n**Design Direction**: ${preset.name} - ${preset.desc}\n`
  }
  
  return markdown
}

export function ThemeBuilder({ value, onChange, readonly = false }: ThemeBuilderProps) {
  const [initial] = useState(() => parseTheme(value))
  // Free-form theme prose (an AI draft) is kept as text; only recognized
  // theme descriptions are safe to round-trip through the visual controls.
  const rawMode = value.trim().length > 0 && initial === null
  const [config, setConfig] = useState<ThemeConfig>(() => initial ?? DEFAULT_THEME)

  function updateConfig(updates: Partial<ThemeConfig>) {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    onChange(serializeTheme(newConfig))
  }

  function applyPreset(presetId: string) {
    const preset = THEME_PRESETS.find(p => p.id === presetId)
    if (preset) {
      updateConfig({ ...preset.config, preset: presetId })
    }
  }

  if (rawMode) {
    if (readonly) {
      return (
        <div className="rounded-xl border border-border bg-card p-5 text-sm leading-6 text-foreground">
          <CofounderMarkdown>{value}</CofounderMarkdown>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          This section holds free-form theme notes from your co-founder, so it&apos;s edited as text — nothing is
          reset to the default theme.
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          aria-label="Edit theme section"
          className="collab-scroll max-h-[70dvh] w-full resize-y rounded-xl border border-primary/40 bg-background px-4 py-3 text-base leading-6 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:max-h-none sm:text-sm"
        />
      </div>
    )
  }

  if (readonly) {
    return (
      <div className="space-y-4">
        {/* Color preview */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Color Scheme</h3>
          <div className="flex items-center gap-3">
            <div 
              className="size-16 rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: config.primaryColor }}
              title={config.primaryColor}
            />
            <div>
              <p className="text-xs font-medium text-foreground">Primary: {config.primaryColor}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mode: {config.mode === "system" ? "Auto" : config.mode}
              </p>
            </div>
          </div>
        </div>

        {/* Typography */}
        {(config.fontHeading || config.fontBody || config.fontMono) && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Typography</h3>
            <dl className="space-y-2 text-xs">
              {config.fontHeading && (
                <div>
                  <dt className="font-medium text-muted-foreground">Headings</dt>
                  <dd className="text-foreground">{config.fontHeading}</dd>
                </div>
              )}
              {config.fontBody && (
                <div>
                  <dt className="font-medium text-muted-foreground">Body</dt>
                  <dd className="text-foreground">{config.fontBody}</dd>
                </div>
              )}
              {config.fontMono && (
                <div>
                  <dt className="font-medium text-muted-foreground">Monospace</dt>
                  <dd className="text-foreground">{config.fontMono}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Style */}
        {(config.density || config.borderRadius) && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Visual Style</h3>
            <dl className="space-y-2 text-xs">
              {config.density && (
                <div>
                  <dt className="font-medium text-muted-foreground">Density</dt>
                  <dd className="text-foreground capitalize">{config.density}</dd>
                </div>
              )}
              {config.borderRadius && (
                <div>
                  <dt className="font-medium text-muted-foreground">Border Radius</dt>
                  <dd className="text-foreground capitalize">{config.borderRadius}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick presets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Quick Presets</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`rounded-lg border p-3 text-left transition-all ${
                config.preset === preset.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{preset.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{preset.desc}</p>
                </div>
                {config.preset === preset.id && (
                  <Check className="size-4 text-primary" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dark mode */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Dark Mode</h3>
        <div className="flex gap-2">
          {[
            { value: "light" as const, icon: Sun, label: "Light" },
            { value: "dark" as const, icon: Moon, label: "Dark" },
            { value: "system" as const, icon: Monitor, label: "Auto" },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => updateConfig({ mode: value })}
              className={`flex-1 rounded-lg border p-3 transition-all ${
                config.mode === value
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <Icon className={`mx-auto size-5 mb-1 ${
                config.mode === value ? "text-primary" : "text-muted-foreground"
              }`} />
              <p className={`text-center text-xs font-medium ${
                config.mode === value ? "text-foreground" : "text-muted-foreground"
              }`}>
                {label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Primary color */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Primary Color</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {COLOR_PRESETS.map(color => (
            <button
              key={color.value}
              onClick={() => updateConfig({ primaryColor: color.value })}
              className={`group relative aspect-square rounded-lg border-2 transition-all ${
                config.primaryColor === color.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color.value }}
              title={`${color.name} - ${color.desc}`}
            >
              {config.primaryColor === color.value && (
                <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={config.primaryColor}
            onChange={(e) => updateConfig({ primaryColor: e.target.value })}
            className="size-10 rounded border border-border cursor-pointer"
          />
          <input
            type="text"
            value={config.primaryColor}
            onChange={(e) => updateConfig({ primaryColor: e.target.value })}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="#3b82f6"
          />
        </div>
      </div>

      {/* Typography */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Typography</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Heading Font</label>
            <select
              value={config.fontHeading ?? ""}
              onChange={(e) => updateConfig({ fontHeading: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Default</option>
              {FONT_PRESETS.heading.map(font => (
                <option key={font.value} value={font.value}>
                  {font.name} - {font.type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Body Font</label>
            <select
              value={config.fontBody ?? ""}
              onChange={(e) => updateConfig({ fontBody: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Default</option>
              {FONT_PRESETS.body.map(font => (
                <option key={font.value} value={font.value}>
                  {font.name} - {font.type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Monospace Font (for code)</label>
            <select
              value={config.fontMono ?? ""}
              onChange={(e) => updateConfig({ fontMono: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Default</option>
              {FONT_PRESETS.mono.map(font => (
                <option key={font.value} value={font.value}>
                  {font.name} - {font.type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Visual style */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Visual Style</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Density</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "compact" as const, label: "Compact" },
                { value: "comfortable" as const, label: "Comfortable" },
                { value: "spacious" as const, label: "Spacious" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateConfig({ density: value })}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    config.density === value
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Border Radius</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "none" as const, label: "None" },
                { value: "small" as const, label: "Small" },
                { value: "medium" as const, label: "Medium" },
                { value: "large" as const, label: "Large" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateConfig({ borderRadius: value })}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    config.borderRadius === value
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
