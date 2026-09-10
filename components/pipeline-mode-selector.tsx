"use client"

import { useState } from "react"
import { HelpCircle, Sparkles, Zap, Rocket, Gem, Clock, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type PipelineMode = "legacy" | "heavy"

interface PipelineModeSelectorProps {
  value: PipelineMode
  onChange: (mode: PipelineMode) => void
  className?: string
}

export function PipelineModeSelector({ value, onChange, className }: PipelineModeSelectorProps) {
  const [showInfo, setShowInfo] = useState(false)

  // Dynamic styling based on selected mode
  const labelClass = cn(
    "font-mono text-xs uppercase tracking-wider transition-all duration-500",
    value === "legacy" ? "text-muted-foreground" : "text-primary font-bold tracking-widest"
  )

  const wrapperClass = cn(
    "inline-flex items-center gap-2 rounded-lg border p-1 transition-all duration-700 ease-out",
    value === "legacy" 
      ? "border-border bg-muted/30" 
      : "border-primary/60 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 shadow-xl shadow-primary/30 ring-2 ring-primary/20"
  )

  return (
    <div className={cn("flex flex-col gap-2.5 transition-all duration-500", className)}>
      <div className="flex items-center gap-2">
        <Label className={labelClass}>
          AI Processing Mode
        </Label>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
          <Sparkles className="size-2.5" />
          New
        </span>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="inline-flex size-4 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          aria-label="Learn more about processing modes"
        >
          <HelpCircle className="size-3" />
        </button>
      </div>

      <div className={wrapperClass}>
        <button
          type="button"
          onClick={() => onChange("legacy")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-300 ease-out",
            value === "legacy"
              ? "bg-background text-foreground shadow-md scale-[1.02]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Legacy
        </button>
        <button
          type="button"
          onClick={() => onChange("heavy")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-300 ease-out relative overflow-hidden",
            value === "heavy"
              ? "bg-gradient-to-r from-primary via-primary/90 to-primary text-primary-foreground shadow-2xl shadow-primary/50 scale-[1.02] font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {value === "heavy" && (
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
          <span className="relative">Heavy</span>
        </button>
      </div>

      {/* Dynamic hint text based on selection */}
      <div className={cn(
        "text-xs leading-relaxed transition-all duration-700",
        value === "legacy" 
          ? "text-muted-foreground" 
          : "text-primary font-semibold"
      )}>
        {value === "legacy" 
          ? "Fast & efficient — perfect for most projects" 
          : "Maximum power unleashed — AI operating at peak performance"}
      </div>

      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Choose Your AI Processing Mode
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
                <Sparkles className="size-2.5" />
                New Feature
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">MirrorSite Legacy</h3>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                  FAST
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Our proven AI orchestrator handles your project efficiently. Perfect for most applications - 
                fast iteration cycles and excellent quality output that gets your app live quickly.
              </p>
              <div className="mt-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Zap className="size-3.5 shrink-0" />
                  <span>30-60s processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Gem className="size-3.5 shrink-0" />
                  <span>Around 10 credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 shrink-0" />
                  <span>Production-ready quality</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">MirrorSite Heavy</h3>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  UNLEASHED
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Unlock the full power of MirrorSite. Up to 7+ parallel AI agents analyze, research, plan, 
                critique, and refine your project. Every detail fine-tuned to perfection. When your vision 
                demands the absolute best, this is how we deliver it.
              </p>
              <div className="mt-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Rocket className="size-3.5 shrink-0" />
                  <span>7+ AI agents working together</span>
                </div>
                <div className="flex items-center gap-2">
                  <Gem className="size-3.5 shrink-0" />
                  <span>50-100 credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 shrink-0" />
                  <span>2-5min deep processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-3.5 shrink-0 text-primary" />
                  <span className="font-medium text-primary">Up to 200% better output</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-accent/20 p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Both modes are powerful.</span> Legacy delivers 
                exceptional results fast. Heavy pushes AI to its limits - more agents, deeper analysis, 
                relentless refinement. Choose based on your timeline and how much you want to invest in quality.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Link href="/modes-comparison" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
              See detailed comparison
            </Link>
            <Button onClick={() => setShowInfo(false)} className="flex-1">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}