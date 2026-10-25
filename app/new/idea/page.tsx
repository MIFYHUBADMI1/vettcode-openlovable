"use client"

import { useEffect } from "react"
import { Check, FileText, Hammer, Lightbulb } from "lucide-react"
import { AuthGate } from "@/components/auth/auth-gate"
import { LandingComposer } from "@/components/landing/composer"
import { CreateWorkspaceShell } from "@/components/new-project/create-shell"
import { beginStartFlow } from "@/lib/analytics/start-funnel"
import { cn } from "@/lib/utils"

const STEPS = [
  { icon: Lightbulb, label: "Describe", body: "Plain language is enough.", current: true },
  { icon: FileText, label: "Plan", body: "Atai drafts it. You refine it.", current: false },
  { icon: Hammer, label: "Build", body: "Starts only after you approve.", current: false },
]

export default function NewIdeaProjectPage() {
  useEffect(() => {
    beginStartFlow({ method: "idea", surface: "new_idea" })
  }, [])

  return (
    <AuthGate next="/new/idea">
      <CreateWorkspaceShell
        kicker="Your idea"
        title="Start from your idea."
        description="A sentence is enough. Tell Atai the problem and who it's for. You'll get a plan to review before anything is built."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-5 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-col gap-1.5">
              <h2 className="text-xl font-medium tracking-tight">What are you building?</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Describe your business idea in your own words. Attach a file or speak it if that's easier — everything
                else Atai handles.
              </p>
            </div>
            <LandingComposer lockedMode="idea" showModes={false} showIntro={false} surface="new_idea" />
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-36">
            <nav aria-label="Progress" className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="pb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Where you are
              </p>
              <ol className="relative flex flex-col gap-4">
                <span aria-hidden className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />
                {STEPS.map((step, i) => (
                  <li key={step.label} className="relative flex items-center gap-3">
                    <span
                      className={cn(
                        "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs",
                        step.current
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {step.current ? <span className="sr-only">Current step:</span> : null}
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <step.icon
                          className={cn("size-3.5", step.current ? "text-primary" : "text-muted-foreground/70")}
                        />
                        <p className={cn("text-sm", step.current ? "font-semibold" : "font-medium text-muted-foreground")}>
                          {step.label}
                        </p>
                        {step.current ? (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                            Now
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 flex items-start gap-1.5 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted-foreground">
                <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                Atai plans first — nothing is built until you approve the plan.
              </p>
            </nav>
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                You don&apos;t need to write code
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                You describe the business. Atai handles the architecture, accounts, data, and launch setup.
              </p>
            </div>
          </aside>
        </div>
      </CreateWorkspaceShell>
    </AuthGate>
  )
}
