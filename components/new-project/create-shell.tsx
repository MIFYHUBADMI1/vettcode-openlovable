import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AppHeader } from "@/components/app-header"

export function CreateWorkspaceShell({
  kicker,
  title,
  description,
  children,
  backHref = "/new",
  backLabel = "Choose a starting point",
}: {
  kicker: string
  title: string
  description: string
  children: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="sticky top-[57px] z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
          <p className="hidden truncate font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
            {kicker}
          </p>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
          <h1 className="mt-2 max-w-3xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
        {children}
      </div>
    </main>
  )
}
