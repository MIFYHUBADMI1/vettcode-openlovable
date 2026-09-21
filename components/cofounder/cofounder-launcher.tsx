"use client"

import { Sparkles } from "lucide-react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { CofounderPanel, useCofounderPanel } from "@/components/cofounder/cofounder-panel"
import { cn } from "@/lib/utils"

/**
 * Global Co-founder launcher (spec section 46): one recognizable affordance
 * in the app header — no competing AI buttons. The panel itself is mounted
 * here so it exists on every page that renders the header, and the
 * conversation persists across navigation (spec section 47).
 */
export function CofounderLauncherButton({ mobile = false }: { mobile?: boolean }) {
  const { open } = useCofounderPanel()

  if (mobile) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={open}
          aria-label="Ask your co-founder"
          className="gap-1 rounded-md border-border px-2 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="size-3" />
          <span className="sm:hidden">Ask</span>
        </Button>
        <CofounderPanel />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={open}
        aria-label="Ask your co-founder"
        className={cn("mr-1 gap-1.5 border-border font-mono text-xs font-medium text-muted-foreground", "hover:border-primary/30 hover:bg-accent hover:text-foreground")}
      >
        <Sparkles className="size-3.5 text-primary" />
        Ask your co-founder
      </Button>
      <CofounderPanel />
    </>
  )
}

/** Dashboard hero banner (spec sections 42, 71): replaces the old "Ask AI"
 * entry with the co-founder framing. Launches the shared panel. */
export function CofounderLauncherInline() {
  const { open } = useCofounderPanel()
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">Ask your co-founder</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your AI co-founder knows your projects, plans, and progress — and helps you move them forward.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button onClick={open} size="sm">
          <Sparkles className="size-3.5" />
          Open co-founder
        </Button>
        <Link href="/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Start something new
        </Link>
      </div>
    </section>
  )
}
