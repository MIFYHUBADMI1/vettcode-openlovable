"use client"

import { Check, FileText, Globe, Hammer, ScanSearch } from "lucide-react"
import { CreateProjectForm } from "@/components/create-project-form"
import { AuthGate } from "@/components/auth/auth-gate"
import { CreateWorkspaceShell } from "@/components/new-project/create-shell"
import { cn } from "@/lib/utils"

const STEPS = [
  { icon: Globe, label: "Study", body: "Atai reads the live site.", current: true },
  { icon: ScanSearch, label: "Understand", body: "Purpose, users, product.", current: false },
  { icon: FileText, label: "Plan", body: "You review an editable plan.", current: false },
  { icon: Hammer, label: "Build", body: "Starts only after you approve.", current: false },
]

export default function NewWebsiteProjectPage() {
  return (
    <AuthGate next="/new/website">
      <CreateWorkspaceShell
        kicker="A reference website"
        title="Start from a website you admire."
        description="Paste a live URL. Atai studies the product behind it and drafts a plan for the business you want to build — a starting point, not a copy."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-5 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-col gap-1.5">
              <h2 className="text-xl font-medium tracking-tight">Which website should Atai study?</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                A marketing site, dashboard, or app with a few real pages works best. You set the direction — Atai
                handles the analysis.
              </p>
            </div>
            <CreateProjectForm />
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
                Atai plans first — nothing is built until you review and approve the plan.
              </p>
            </nav>
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Study, don&apos;t copy
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Atai reads the reference for structure and purpose, then writes a plan for your own product and market.
              </p>
            </div>
          </aside>
        </div>
      </CreateWorkspaceShell>
    </AuthGate>
  )
}
