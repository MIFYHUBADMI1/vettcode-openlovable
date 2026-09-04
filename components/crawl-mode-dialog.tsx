"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScanSearch, Cpu, Zap, ArrowRight } from "lucide-react"
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
          {/* Relevant Info mode */}
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
              <ScanSearch className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">Relevant Info</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">Standard</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                We analyze the most relevant pages, understand the product, and generate a custom application plan with AI.
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Best for: marketing sites, app front-ends, landing pages
              </p>
            </div>
            {selected === "relevant" && <CheckMark />}
          </button>

          {/* Deep Crawl mode */}
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
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">500 credits</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                We crawl the entire site, collect all pages and content, and build an exact replica — no AI reinterpretation.
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Best for: full site clones, exact reproductions, preserving all content
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
            {selected === "deep" ? <Zap className="size-3.5" /> : <ScanSearch className="size-3.5" />}
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
