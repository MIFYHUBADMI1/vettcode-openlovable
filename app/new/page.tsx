import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, Lightbulb, ArrowRight } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"

const MODES = [
  {
    id: "website",
    icon: Globe,
    title: "Mirror a website",
    description: "Point us at a live site. We crawl it, analyze it, and turn it into an editable application plan.",
    href: "/new/website",
    color: "primary",
  },
  {
    id: "idea",
    icon: Lightbulb,
    title: "Start from an idea",
    description: "Describe your app in plain language. We'll create a full specification you can review and refine.",
    href: "/new/idea",
    color: "accent",
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
              Choose how you want to start. Mirror an existing website or describe your idea from scratch.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {MODES.map((mode) => (
            <Link
              key={mode.id}
              href={mode.href}
              className="group flex flex-col gap-6 border border-border bg-card p-8 transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex size-12 items-center justify-center rounded-lg ${
                    mode.color === "primary" ? "bg-primary/10" : "bg-accent/40"
                  }`}
                >
                  <mode.icon
                    className={`size-6 ${
                      mode.color === "primary" ? "text-primary" : "text-accent-foreground"
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
              <p className="text-sm font-medium">Review & refine</p>
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
