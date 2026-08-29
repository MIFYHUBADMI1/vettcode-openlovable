import Link from "next/link"
import { redirect } from "next/navigation"
import { AccountMenu } from "@/components/account-menu"
import { CreateProjectForm } from "@/components/create-project-form"
import { getCurrentUser } from "@/lib/auth/session"

export default async function WorkspacePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fworkspace")

  return (
    <main className="workspace-environment min-h-svh bg-background text-foreground">
      <span className="workspace-signal" aria-hidden="true" />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-border px-6 py-5 lg:px-10">
        <Link href="/workspace" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">M</span>
          <span>mirrorsite<span className="text-primary">.ai</span></span>
        </Link>
        <div className="flex items-center gap-4"><span className="hidden font-mono text-xs text-muted-foreground sm:inline">workspace / ready</span><AccountMenu /></div>
      </header>
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-14 lg:px-10 lg:py-20">
        <div className="max-w-2xl"><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Your workspace</p><h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">What are you building next?</h1><p className="mt-5 text-pretty text-lg leading-8 text-muted-foreground">Start with a reference or an idea. MirrorSite will help turn the signal into a product foundation you can own.</p></div>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"><div className="rounded-xl border border-border bg-card p-6"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">New project</p><h2 className="mt-3 text-xl font-semibold">Bring a starting point</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Paste a website URL and begin an analysis session.</p><div className="mt-6"><CreateProjectForm /></div></div><div className="rounded-xl border border-border bg-card p-6"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Session status</p><div className="mt-6 flex items-center gap-3"><span className="live-dot size-2 rounded-full bg-primary" /><span className="text-sm">Signed in as {user.name}</span></div><p className="mt-4 text-sm leading-6 text-muted-foreground">Your projects and build activity will appear here as you create them.</p></div></div>
      </section>
    </main>
  )
}
