import Link from "next/link"

export function StartStrip() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">New project</p>
      <Link href="/new/idea" className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-indigo-500/40">
        Idea
      </Link>
      <Link href="/new/website" className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-indigo-500/40">
        Reference
      </Link>
      <Link href="/new/github" className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-indigo-500/40">
        GitHub
      </Link>
    </div>
  )
}
