"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Play, CheckCircle2, Star, Sparkles } from "lucide-react"

/**
 * Animated preview card with gradient border, glassmorphism, and verified user review.
 * Replaces the static hero console in the landing page.
 */
export function HeroPreviewCard() {
  const [activeTab, setActiveTab] = useState<"before" | "after">("after")
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="hero-preview-container relative">
      {/* Animated gradient border wrapper */}
      <div className="hero-preview-border relative rounded-2xl p-[1px]">
        {/* Gradient animation layer */}
        <div className="hero-gradient-orb absolute inset-0 rounded-2xl overflow-hidden">
          <div className="hero-gradient-spin absolute -inset-[100%]">
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0%,var(--primary)_10%,transparent_20%,transparent_35%,oklch(0.68_0.15_152)_45%,transparent_55%,transparent_70%,var(--primary)_80%,transparent_90%,transparent_100%)]" />
          </div>
        </div>

        {/* Inner card with glassmorphism */}
        <div className="relative rounded-2xl bg-card/80 backdrop-blur-xl overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-yellow-400/70" />
                <span className="size-2.5 rounded-full bg-green-400/70" />
              </div>
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">mirrorsite / build-preview</span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="live-dot size-1.5 rounded-full bg-primary" />
              live
            </span>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 border-b border-border/50 px-4 py-1.5">
            <button
              onClick={() => setActiveTab("before")}
              className={`rounded-md px-3 py-1 font-mono text-[10px] transition-colors ${
                activeTab === "before" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Reference
            </button>
            <button
              onClick={() => setActiveTab("after")}
              className={`rounded-md px-3 py-1 font-mono text-[10px] transition-colors ${
                activeTab === "after" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Generated App
            </button>
          </div>

          {/* Preview content */}
          <div className="relative min-h-[320px] sm:min-h-[380px]">
            {activeTab === "before" ? (
              <div className="p-4">
                <div className="rounded-lg border border-border/50 bg-background/50 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
                    <span className="font-mono text-[9px] text-muted-foreground">into.vercel.app</span>
                    <ExternalLink className="size-2.5 text-muted-foreground" />
                  </div>
                  <iframe
                    src={`${window.location.origin}/`}
                    className="w-full h-[280px] sm:h-[320px] border-0"
                    title="Reference site preview"
                    loading="lazy"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="rounded-lg border border-primary/20 bg-background/50 overflow-hidden relative">
                  {/* Success badge */}
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 backdrop-blur-sm">
                    <CheckCircle2 className="size-2.5 text-green-500" />
                    <span className="font-mono text-[8px] text-green-500">Built</span>
                  </div>
                  <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
                    <span className="font-mono text-[9px] text-primary">temporal-link-preview-200-234-231-205.totalum-project.com</span>
                    <ExternalLink className="size-2.5 text-primary" />
                  </div>
                  <iframe
                    src="https://temporal-link-preview-200-234-231-205.totalum-project.com/"
                    className="w-full h-[280px] sm:h-[320px] border-0"
                    title="Generated app preview"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verified user review card */}
      <div className="relative mt-6 rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-5 overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="flex items-start gap-4">
          {/* User avatar */}
          <img
            src="/ADORABLE/adorable.png"
            alt="Adorable Kimulya"
            className="shrink-0 size-10 rounded-full object-cover border border-border"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">Adorable Kimulya</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">— ex-chef designer at ATAI, Founder & CEO, VettCode</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="size-3 fill-primary text-primary" />
                ))}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] text-green-500 font-medium">
                <CheckCircle2 className="size-2.5" />
                Verified Review
              </span>
            </div>
            
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              I wanted to create an <span className="text-foreground font-medium">interior design company website</span> with full capabilities but had no way of explaining my full idea to the AI. I&apos;ve used many AI coding agents — Lovable, Bolt.new, and v0 — all when trying to create the interior design site but spent <span className="text-foreground font-medium">hours debugging the codebases</span> they created in 12 months, plus other hours doing manual steps.
            </p>
            
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Until I tried MirrorSite AI. The first preview of the site I cloned surprised me — I thought it was maybe just good UX, but I was shocked by <span className="text-foreground font-medium">all the full built-in features</span> it includes: authentication, database, backend operations, storage, everything working together inside the application. Not a screenshot. A real product.
            </p>
            
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              I delivered it to my client. They paid <span className="text-primary font-semibold">50k for it, plus an extra 12k bonus</span> because of how amazed they were by the creativity, design, and full built-in capabilities — all created from <span className="text-foreground font-medium">just one URL and 45 minutes of waiting</span>.
            </p>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              That&apos;s why I use MirrorSite for everything now — it has increased my work rate by <span className="text-primary font-semibold">14x</span> and I&apos;m now starting my new business. Visit <a href="https://vettcode.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">vettcode.dev</a> — all thanks to MirrorSite AI.
            </p>
            
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Interior Design Website</span>
              <span>•</span>
              <span>45 min delivery</span>
              <span>•</span>
              <span>62k earned</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
