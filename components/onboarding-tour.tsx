"use client"

import { useEffect, useState } from "react"
import { Code2, Globe2, Layers3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "mirrorsite:onboarded"

const STEPS = [
  {
    icon: Globe2,
    title: "Bring a signal",
    copy: "Paste a website URL you want mirrored, or describe an idea from scratch. Either one is enough to start.",
  },
  {
    icon: Layers3,
    title: "Watch it get understood",
    copy: "MirrorSite reads structure, content, and intent, then drafts a build plan you can review before anything is built.",
  },
  {
    icon: Code2,
    title: "Build and keep shaping it",
    copy: "Confirm the plan to build a real, working application. Keep sending instructions afterward — it's yours to extend.",
  },
] as const

export function OnboardingTour() {
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      // localStorage unavailable (e.g. private mode) — skip the tour silently
    }
  }, [])

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // ignore write failures
    }
    setOpen(false)
  }

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish())}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Getting started · {stepIndex + 1} of {STEPS.length}
          </p>
          <DialogTitle className="text-xl font-semibold">{step.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <step.icon className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((s, index) => (
              <span
                key={s.title}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === stepIndex ? "w-6 bg-primary" : "w-2 bg-border",
                )}
              />
            ))}
          </div>
        </div>
        <DialogFooter className="!bg-transparent !border-t-0">
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
          <Button onClick={() => (isLast ? finish() : setStepIndex((value) => value + 1))}>
            {isLast ? "Start building" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
