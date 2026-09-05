"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Sparkles, Database, Shield, Server, Globe2, Zap, Code2, HardDrive } from "lucide-react"

/**
 * Animated hero card showing MirrorSite AI building an app in real-time.
 * No fake testimonials, no external iframes, no fabricated names.
 * Pure product proof — animated build log + live before/after visualization.
 */

const BUILD_STEPS = [
  { icon: Globe2, label: "Scanning URL structure", time: "0.3s", color: "text-primary" },
  { icon: Sparkles, label: "Extracting product intent", time: "1.1s", color: "text-violet-400" },
  { icon: Code2, label: "Generating component tree", time: "2.8s", color: "text-primary" },
  { icon: Database, label: "Scaffolding data models", time: "4.2s", color: "text-cyan-400" },
  { icon: Shield, label: "Adding authentication flows", time: "5.6s", color: "text-emerald-400" },
  { icon: Server, label: "Wiring backend & API routes", time: "7.1s", color: "text-primary" },
  { icon: HardDrive, label: "Provisioning storage layer", time: "8.4s", color: "text-amber-400" },
  { icon: CheckCircle2, label: "Application ready to preview", time: "9.2s", color: "text-emerald-400" },
]

const STACK_BADGES = ["React", "Next.js", "TypeScript", "MongoDB", "Node.js", "Tailwind CSS"]

export function HeroPreviewCard() {
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [done, setDone] = useState(false)
  const [cycling, setCycling] = useState(false)

  useEffect(() => {
    // Auto-advance build steps
    let step = 0
    const advance = () => {
      step += 1
      setVisibleSteps(step)
      if (step >= BUILD_STEPS.length) {
        setDone(true)
        // Restart after pause
        setTimeout(() => {
          step = 0
          setVisibleSteps(0)
          setDone(false)
          setCycling(false)
        }, 4000)
        return
      }
      const delay = step < 3 ? 600 : step < 6 ? 900 : 700
      setTimeout(advance, delay)
    }
    const start = setTimeout(advance, 800)
    return () => clearTimeout(start)
  }, [cycling])

  // Trigger restart
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setCycling((v) => !v), 4200)
    return () => clearTimeout(t)
  }, [done])

  const progress = Math.round((visibleSteps / BUILD_STEPS.length) * 100)

  return (
    <div className="hero-preview-container relative w-full">

      {/* ── Orbital glow rings ─────────────────────────────────────── */}
      <div className="absolute -inset-6 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 rounded-[2rem] opacity-20"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(var(--primary-raw, 0.65 0.22 260) / 0.35) 0%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />
      </div>

      {/* ── Gradient border wrapper ────────────────────────────────── */}
      <div className="relative rounded-2xl p-[1px]"
        style={{
          background: "linear-gradient(135deg, oklch(var(--primary-raw, 0.65 0.22 260) / 0.5) 0%, transparent 40%, oklch(0.68 0.15 152 / 0.4) 70%, transparent 100%)",
        }}
      >
        {/* Inner card */}
        <div className="relative rounded-2xl bg-card/90 backdrop-blur-xl overflow-hidden">

          {/* Top bar — terminal chrome */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-400/60" />
                <span className="size-2.5 rounded-full bg-yellow-400/60" />
                <span className="size-2.5 rounded-full bg-green-400/60" />
              </div>
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">mirrorsite — build process</span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className={`size-1.5 rounded-full transition-colors duration-500 ${done ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
              />
              <span className={`transition-colors duration-500 ${done ? "text-emerald-400" : "text-amber-400"}`}>
                {done ? "complete" : "building"}
              </span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-[2px] bg-border/40 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-violet-400 to-emerald-400 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Build log */}
          <div className="p-4 space-y-0 min-h-[300px] sm:min-h-[360px]">
            {/* Input signal */}
            <div className="mb-4 rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <p className="font-mono text-[9px] text-muted-foreground mb-1">INPUT SIGNAL</p>
              <div className="flex items-center gap-2">
                <Globe2 className="size-3 text-primary shrink-0" />
                <span className="font-mono text-[11px] text-foreground truncate">yoursite.com → MirrorSite AI</span>
              </div>
            </div>

            {/* Animated step list */}
            <div className="space-y-1.5">
              {BUILD_STEPS.map((step, i) => {
                const visible = i < visibleSteps
                const Icon = step.icon
                return (
                  <div
                    key={step.label}
                    className={`flex items-center gap-2.5 transition-all duration-500 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                      }`}
                    style={{ transitionDelay: visible ? "0ms" : `${i * 40}ms` }}
                  >
                    <Icon
                      className={`size-3 shrink-0 ${visible ? step.color : "text-muted-foreground/30"} transition-colors duration-300`}
                    />
                    <span
                      className={`font-mono text-[10px] flex-1 ${visible ? "text-foreground" : "text-muted-foreground/30"} transition-colors duration-300`}
                    >
                      {step.label}
                    </span>
                    {visible && (
                      <span className="font-mono text-[9px] text-muted-foreground shrink-0">{step.time}</span>
                    )}
                    {visible && i === BUILD_STEPS.length - 1 && (
                      <CheckCircle2 className="size-3 text-emerald-400 shrink-0 animate-in fade-in" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Done — output summary */}
            {done && (
              <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span className="font-mono text-[10px] text-emerald-400 font-medium">Full-stack app ready</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Routes", value: "12" },
                    { label: "Components", value: "34" },
                    { label: "Auth flows", value: "4" },
                    { label: "DB tables", value: "8" },
                    { label: "API routes", value: "18" },
                    { label: "Build time", value: "9.2s" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded bg-background/50 px-2 py-1.5 text-center">
                      <p className="font-mono text-[11px] font-semibold text-foreground">{value}</p>
                      <p className="font-mono text-[8px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stack bar */}
          <div className="border-t border-border/40 bg-muted/10 px-4 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[9px] text-muted-foreground mr-1">OUTPUT STACK</span>
              {STACK_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="rounded border border-border/50 bg-background/50 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── "Built for people who ship fast" — Option B proof block ── */}
      <div className="relative mt-5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md px-5 py-4 overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Zap className="size-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-snug">Built for people who ship fast</p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Early users are turning ideas into working full-stack apps — with authentication, database, backend, and infrastructure — in minutes, not weeks.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-primary" />
                Real Next.js codebase you own
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-primary" />
                Edit, extend, deploy
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-primary" />
                No lock-in
              </span>
            </div>
          </div>
        </div>

        {/* TODO: add real customer testimonial once available */}
      </div>
    </div>
  )
}
