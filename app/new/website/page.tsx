"use client"

import { Globe, ScanSearch, FileText, Hammer } from "lucide-react"
import { CreateProjectForm } from "@/components/create-project-form"
import { AuthGate } from "@/components/auth/auth-gate"
import { CreateWorkspaceShell } from "@/components/new-project/create-shell"

const STEPS = [
  { icon: Globe, label: "Study", body: "Atai reads the live site: pages, structure, and what it offers." },
  { icon: ScanSearch, label: "Understand", body: "Purpose, users, and the product behind the pages." },
  { icon: FileText, label: "Plan", body: "You review an editable plan before anything is built." },
  { icon: Hammer, label: "Build", body: "Approve it, and Atai builds your application." },
]

export default function NewWebsiteProjectPage() {
  return (
    <AuthGate next="/new/website">
      <CreateWorkspaceShell
        kicker="A competitor's website"
        title="Start from a competitor's website."
        description="Paste a live URL. Atai reads the product, understands what it does, and drafts a plan for the business you want to build — not a clone of theirs."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_280px] lg:items-start">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-medium tracking-tight">Website URL</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                A marketing site, dashboard, or app with a few real pages works best.
              </p>
            </div>
            <CreateProjectForm />
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
          </aside>
        </div>
      </CreateWorkspaceShell>
    </AuthGate>
  )
}
