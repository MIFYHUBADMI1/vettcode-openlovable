import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, Lightbulb, ArrowRight } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

const MODES = [
  {
    id: "website",
    icon: Globe,
    title: "Mirror a website",
    description: "Point us at a live site. We crawl it, analyze it, and turn it into an editable application plan.",
    href: "/new/website",
    color: "primary" as const,
    badge: null,
  },
  {
    id: "idea",
    icon: Lightbulb,
    title: "Start from an idea",
    description: "Describe your app in plain language. We'll create a full specification you can review and refine.",
    href: "/new/idea",
    color: "accent" as const,
    badge: null,
  },
]

export default async function NewProjectPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fnew")

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
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Create a new project
            </h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              Choose how you want to start. Mirror a website, describe an idea, or build straight from a GitHub repo.
            </p>
          </div>
        </div>

        {/* Standard modes */}
        <div className="grid gap-6 sm:grid-cols-2">
          {MODES.map((mode) => (
            <Link
              key={mode.id}
              href={mode.href}
              className="group flex flex-col gap-6 border border-border bg-card p-8 transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex size-12 items-center justify-center rounded-lg ${mode.color === "primary" ? "bg-primary/10" : "bg-accent/40"
                    }`}
                >
                  <mode.icon
                    className={`size-6 ${mode.color === "primary" ? "text-primary" : "text-accent-foreground"
                      }`}
                  />
                </div>
                <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">{mode.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{mode.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* GitHub mode — experimental, full width */}
        <Link
          href="/new/github"
          className="group relative flex flex-col gap-6 border border-purple-500/30 bg-card p-8 transition-all hover:border-purple-500/60 hover:bg-purple-500/5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <GitHubIcon className="size-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Build from a GitHub repo</h2>
                <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                  New &amp; Experimental
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Paste any public GitHub URL — or a private repo you have access to. We read the code, analyse
                what it does, and scaffold a working application from it.
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                Works with: TypeScript, JavaScript, Python, Go, Ruby, Java, PHP and more
              </p>
            </div>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>

        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            What happens next?
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs">
                1
              </span>
              <p className="text-sm font-medium">Analysis</p>
              <p className="text-sm text-muted-foreground">
                We analyze your input and create a structured application plan
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs">
                2
              </span>
              <p className="text-sm font-medium">Review &amp; refine</p>
              <p className="text-sm text-muted-foreground">
                Edit the specification, add features, and approve when ready
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs">
                3
              </span>
              <p className="text-sm font-medium">Build</p>
              <p className="text-sm text-muted-foreground">
                We generate the working application based on your approved plan
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
