"use client"

import Link from "next/link"
import { GitBranch, FileCode, Hammer, BookOpen } from "lucide-react"
import { CreateGitHubRepoForm } from "@/components/create-github-repo-form"
import { useSession, jsonFetcher } from "@/lib/client/api"
import { AuthGate } from "@/components/auth/auth-gate"
import { CreateWorkspaceShell } from "@/components/new-project/create-shell"
import useSWR from "swr"

const STEPS = [
  {
    icon: BookOpen,
    label: "Choose how",
    body: "Rebuild a fresh product from the README, or continue the codebase that's already there.",
  },
  {
    icon: FileCode,
    label: "Read the repo",
    body: "Atai studies the README, the structure, and — if you continue the existing app — the code itself.",
  },
  {
    icon: Hammer,
    label: "Build",
    body: "Atai turns that into a working application you can review, ship, and keep improving.",
  },
]

const EXAMPLES = ["facebook/react", "vercel/next.js", "owner/my-private-app"]

export default function NewGitHubProjectPage() {
  const { session } = useSession()

  const { data: profileData } = useSWR<{ ok: boolean; data: { githubConnected: boolean } }>(
    session ? "/api/auth/github/status" : null,
    jsonFetcher,
  )
  const hasGitHub = profileData?.data?.githubConnected ?? false

  return (
    <AuthGate next="/new/github">
      <CreateWorkspaceShell
        kicker="GitHub"
        title="Start from a GitHub repo."
        description="Point Atai at a public repository, or a private one you can access. Rebuild a fresh product from the README, or continue the codebase that's already there."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_280px] lg:items-start">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-medium tracking-tight">Repository</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Paste a GitHub URL or type{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">owner/repo</code>.
              </p>
            </div>
            <CreateGitHubRepoForm hasGitHub={hasGitHub} />
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Examples</p>
              <ul className="flex flex-col gap-1.5">
                {EXAMPLES.map((ex) => (
                  <li key={ex} className="font-mono text-xs text-muted-foreground">
                    • {ex}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-36">
            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="pb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">On this path</p>
              <ol className="flex flex-col gap-5">
                {STEPS.map((step, i) => (
                  <li key={step.label} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 font-mono text-xs text-violet-600 dark:text-violet-400">
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <step.icon className="size-3.5 text-violet-600 dark:text-violet-400" />
                        <p className="text-sm font-medium">{step.label}</p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/90 p-5">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">What Atai looks at</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {[
                  "README and docs — needed to rebuild from scratch",
                  "How the repository is structured",
                  "The existing code, if you want to keep going from it",
                  "TypeScript, JavaScript, Python, Go, Ruby, Java, PHP, and more",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <GitBranch className="mt-0.5 size-3 shrink-0 text-violet-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {!hasGitHub ? (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                <p className="mb-1 text-xs font-medium text-violet-700 dark:text-violet-300">Using a private repo?</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Connect GitHub in{" "}
                  <Link href="/settings/profile" className="font-medium text-violet-600 underline underline-offset-2 dark:text-violet-400">
                    Settings → Profile
                  </Link>
                  . Atai can then use the private repositories you have access to.
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </CreateWorkspaceShell>
    </AuthGate>
  )
}
