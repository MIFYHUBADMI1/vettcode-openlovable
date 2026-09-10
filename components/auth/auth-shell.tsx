"use client"

import Link from "next/link"
import type { ReactNode } from "react"

/**
 * Premium glassmorphism two-sided auth layout.
 * Left: form with frosted glass card + animated gradient borders.
 * Right: marketing panel with aurora orbs, floating particles, and animated content.
 *
 * Uses CSS Grid for precise two-column layout that doesn't collapse or overflow.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
  marketing,
}: {
  title: string
  subtitle: string
  footer: { prompt: string; linkLabel: string; href: string }
  children: ReactNode
  marketing?: ReactNode
}) {
  return (
    <main className="workspace-environment min-h-screen w-full">
      <span className="workspace-signal" aria-hidden="true" />

      {/* ── Mobile: single column. Desktop: two equal columns via CSS Grid ── */}
      <div className="grid min-h-screen w-full lg:grid-cols-[1fr_1fr]">
        {/* ── Left: Form side ── */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12">
          {/* Brand */}
          <Link href="/" className="mb-10 flex items-center gap-2.5 hero-console">
            <div
              className="relative flex size-10 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shadow-lg"
              style={{
                background: "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--accent) 70%, var(--primary)))",
                boxShadow: "0 0 24px -4px color-mix(in oklab, var(--primary) 45%, transparent)",
              }}
            >
              M
              <span
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer-slide 3s ease-in-out infinite",
                }}
              />
            </div>
            <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
              MirrorSite<span className="text-primary">.ai</span>
            </span>
          </Link>

          {/* Glass card */}
          <div className="w-full max-w-sm hero-console" style={{ animationDelay: "0.1s" }}>
            <div className="auth-glass-card rounded-2xl p-8">
              <div className="mb-7 flex flex-col gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              </div>
              {children}
            </div>

            {/* Footer link */}
            <p className="mt-6 text-center text-sm text-muted-foreground hero-copy">
              {footer.prompt}{" "}
              <Link
                href={footer.href}
                className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
              >
                {footer.linkLabel}
              </Link>
            </p>
          </div>
        </div>

        {/* ── Right: Marketing side (hidden on mobile) ── */}
        {marketing && (
          <div
            className="relative z-10 hidden flex-col justify-center overflow-hidden px-10 py-12 2xl:px-16 lg:flex hero-console"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Gradient divider — absolute left edge of marketing panel */}
            <div className="auth-gradient-divider absolute left-0 top-[10%] bottom-[10%] hidden lg:block" aria-hidden="true" />

            {/* Aurora background effects */}
            <div className="auth-aurora auth-aurora-1" />
            <div className="auth-aurora auth-aurora-2" />

            {/* Ambient orbs */}
            <div className="auth-orb auth-orb-1" />
            <div className="auth-orb auth-orb-2" />
            <div className="auth-orb auth-orb-3" />

            {/* Floating particles */}
            <div className="auth-particle" style={{ top: "15%", left: "10%" }} />
            <div className="auth-particle" style={{ top: "60%", left: "80%" }} />
            <div className="auth-particle" style={{ top: "35%", left: "65%" }} />
            <div className="auth-particle" style={{ top: "75%", left: "25%" }} />
            <div className="auth-particle" style={{ top: "20%", left: "90%" }} />

            {/* Marketing content — fill the full panel width */}
            <div className="w-full">{marketing}</div>
          </div>
        )}
      </div>
    </main>
  )
}
