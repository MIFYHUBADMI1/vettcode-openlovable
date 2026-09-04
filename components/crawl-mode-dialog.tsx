"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScanSearch, Cpu, Zap, ArrowRight, Shield, Globe, Brain, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

export type CrawlMode = "relevant" | "deep"

interface CrawlModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (mode: CrawlMode) => void
  url: string
}

export function CrawlModeDialog({ open, onOpenChange, onSelect, url }: CrawlModeDialogProps) {
  const [selected, setSelected] = useState<CrawlMode | null>(null)

  function handleConfirm() {
    if (selected) {
      onSelect(selected)
      setSelected(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setSelected(null); onOpenChange(false) } }}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Choose analysis mode</p>
          <DialogTitle className="text-xl font-semibold">
            How should we analyze this site?
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            We found <span className="font-medium text-foreground">{url}</span>. Choose how to proceed.
          </p>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          {/* ── Intelligent Analysis ── */}
          <button
            onClick={() => setSelected("relevant")}
            className={cn(
              "flex items-start gap-4 rounded-xl border p-5 text-left transition-all",
              selected === "relevant"
                ? "border-primary bg-primary/5 shadow-sm shadow-primary/5"
                : "border-border hover:border-primary/30 hover:bg-accent/30",
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">Intelligent Analysis</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">Standard</span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Our AI engine reads your site&apos;s structure, extracts product logic, maps user flows, and generates a complete application blueprint — including authentication flows, data models, and interactive states.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  { icon: Globe, text: "Handles JS-rendered pages" },
                  { icon: Shield, text: "Works through auth walls" },
                  { icon: Layers, text: "Extracts navigation + data" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10px] text-muted-foreground">
                    <Icon className="size-3 text-primary" />
                    {text}
                  </span>
                ))}
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Best for: marketing sites, SaaS apps, dashboards, e-commerce, any public-facing product
              </p>
            </div>
            {selected === "relevant" && <CheckMark />}
          </button>

          {/* ── Deep Crawl ── */}
          <button
            onClick={() => setSelected("deep")}
            className={cn(
              "flex items-start gap-4 rounded-xl border p-5 text-left transition-all",
              selected === "deep"
                ? "border-primary bg-primary/5 shadow-sm shadow-primary/5"
                : "border-border hover:border-primary/30 hover:bg-accent/30",
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Cpu className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">Deep Crawl</p>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-mono text-[10px] text-green-500">New</span>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">Beta</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">500 credits</span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                We deploy 30+ AI agents to crawl your entire site — every page, every route, every state. They handle heavy JavaScript, authentication middleware, protected dashboards, dynamic content, and user-facing lockages. Everything is captured and reconstructed as an exact replica.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  { icon: Cpu, text: "30+ parallel AI agents" },
                  { icon: Shield, text: "Bypasses auth + middleware" },
                  { icon: Globe, text: "Crawls JS-heavy SPAs" },
                  { icon: Layers, text: "Captures every page + state" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10px] text-muted-foreground">
                    <Icon className="size-3 text-primary" />
                    {text}
                  </span>
                ))}
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Best for: full site clones, complex SPAs, authenticated apps, preserving every detail
              </p>
            </div>
            {selected === "deep" && <CheckMark />}
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <Button variant="ghost" onClick={() => { setSelected(null); onOpenChange(false) }} className="text-muted-foreground">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected} className="gap-1.5">
            <Zap className="size-3.5" />
            {selected === "deep" ? "Deep crawl for 500 credits" : "Analyze with AI"}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CheckMark() {
  return (
    <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6l3 3 5-5" />
      </svg>
    </span>
  )
}
