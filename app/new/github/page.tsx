import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, GitBranch, FileCode, Hammer, BookOpen } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { CreateGitHubRepoForm } from "@/components/create-github-repo-form"
import { getCurrentUser } from "@/lib/auth/session"
import { usersCol } from "@/lib/db/collections"

const STEPS = [
  {
    icon: BookOpen,
    label: "Select mode",
    body: "Choose Clone (build from scratch) or Extend (continue existing app with your changes).",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: FileCode,
    label: "Analyze",
    body: "We read your README, repository structure, and (for Extend mode) your existing codebase.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Hammer,
    label: "Build",
    body: "Clone mode builds a new app from your README. Extend mode continues your existing code with improvements.",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
]

const EXAMPLES = [
  "facebook/react",
  "vercel/next.js",
  "owner/my-private-app",
]

export default async function NewGitHubProjectPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fnew%2Fgithub")

  // Check if user has a GitHub access token connected
  const userDoc = await (await usersCol()).findOne({ id: user.id })
  const hasGitHub = Boolean(userDoc?.githubAccessToken)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10 lg:px-10 lg:py-14">

        <div className="flex flex-col gap-6">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
          <div className="flex flex-col gap-4 border-b border-border pb-10">
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
                GitHub mode
              </p>
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                New &amp; Experimental
              </span>
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Build from a GitHub repo.
            </h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              Point us at any public GitHub repository — or a private one you have access to. Clone mode builds
              a fresh app from your README. Extend mode continues your existing codebase with new features.
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">

          {/* Left — form */}
          <div className="order-2 flex flex-col gap-6 border border-border bg-card p-6 lg:order-1 lg:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium">Enter a repository</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Paste a GitHub URL or type the shorthand <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">owner/repo</code>.
              </p>
            </div>
            <CreateGitHubRepoForm hasGitHub={hasGitHub} />

            {/* Examples */}
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Examples</p>
              <ul className="flex flex-col gap-1.5">
                {EXAMPLES.map((ex) => (
                  <li key={ex} className="font-mono text-xs text-muted-foreground">
                    • {ex}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right — steps */}
          <div className="order-1 flex flex-col gap-5 lg:order-2">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex gap-4 border-l-2 border-purple-500/30 pl-5">
                <div className="flex flex-col items-center">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-purple-500/30 ${step.bg} font-mono text-xs ${step.color}`}>
                    {i + 1}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pb-1">
                  <div className="flex items-center gap-2">
                    <step.icon className={`size-4 ${step.color}`} />
                    <p className="font-medium">{step.label}</p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}

            {/* What we read */}
            <div className="mt-2 rounded-xl border border-border bg-muted/40 p-4">
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">What we analyze</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {[
                  "README and documentation (required for Clone mode)",
                  "Complete repository structure and file tree",
                  "Extend mode: full codebase download for continuation",
                  "TypeScript, JavaScript, Python, Go, Ruby, Java, PHP, and more",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <GitBranch className="size-3 shrink-0 text-purple-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Private repo callout */}
            {!hasGitHub && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                  Want to use a private repo?
                </p>
                <p className="text-xs text-muted-foreground">
                  Connect your GitHub account in{" "}
                  <Link href="/settings/profile" className="font-medium text-purple-600 dark:text-purple-400 underline underline-offset-2">
                    Settings → Profile
                  </Link>{" "}
                  and we&apos;ll have access to all your private repositories automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
