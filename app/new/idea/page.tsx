"use client"

import { Lightbulb, FileText, Hammer } from "lucide-react"
import { AuthGate } from "@/components/auth/auth-gate"
import { LandingComposer } from "@/components/landing/composer"
import { CreateWorkspaceShell } from "@/components/new-project/create-shell"

const STEPS = [
  { icon: Lightbulb, label: "Describe", body: "The problem, who it's for, and what you want to exist. Plain language is enough." },
  { icon: FileText, label: "Plan", body: "Atai turns that into a product plan you can review and refine together." },
  { icon: Hammer, label: "Build", body: "When the plan feels right, Atai builds the working application." },
]

export default function NewIdeaProjectPage() {
  return (
    <AuthGate next="/new/idea">
      <CreateWorkspaceShell
        kicker="Your idea"
        title="Start from your idea."
        description="A sentence is enough. Tell Atai the problem and who it's for. You'll get a plan to review before anything is built."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_280px] lg:items-start">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-5 sm:p-6 lg:p-8">
            <div className="mb-5 flex flex-col gap-1.5">
              <h2 className="text-xl font-medium tracking-tight">What are you building?</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Attach files, pick agents and tools, or speak the idea. Then send it.
              </p>
            </div>
            <LandingComposer lockedMode="idea" showModes={false} showIntro={false} />
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-36">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="pb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">On this path</p>
              <ol className="flex flex-col gap-5">
                {STEPS.map((step, i) => (
                  <li key={step.label} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <step.icon className="size-3.5 text-primary" />
                        <p className="text-sm font-medium">{step.label}</p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
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
