import Link from "next/link"
import { AppHeader } from "@/components/app-header"

export function ComingSoonPage({
  kicker,
  title,
  description,
  backHref = "/dashboard",
  backLabel = "Dashboard",
}: {
  kicker: string
  title: string
  description: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">{description}</p>
        <p className="rounded-2xl border border-border/80 bg-card p-5 text-sm leading-6 text-muted-foreground">
          This part of Atai is on the way. It is not available yet — nothing here is simulated or unfinished behind a fake button.
        </p>
        <Link href={backHref} className="inline-flex w-fit text-sm font-medium text-primary hover:underline">
          ← {backLabel}
        </Link>
      </div>
    </main>
  )
}
