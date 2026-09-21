import Link from "next/link"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export function ProjectComingSoon({
  projectId,
  projectName,
  kicker,
  title,
  description,
}: {
  projectId: string
  projectName: string
  kicker: string
  title: string
  description: string
}) {
  return (
    <DashboardShell title={projectName} projectId={projectId}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">{description}</p>
        <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          This is specific to this business. It is on the way — nothing here is simulated.
        </p>
        <Link href={`/project/${projectId}`} className="inline-flex w-fit text-sm font-medium text-primary hover:underline">
          ← Workspace
        </Link>
      </div>
    </DashboardShell>
  )
}
