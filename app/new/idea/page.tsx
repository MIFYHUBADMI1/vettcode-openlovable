import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lightbulb, FileText, Hammer } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { CreateIdeaForm } from "@/components/create-idea-form"
import { getCurrentUser } from "@/lib/auth/session"

const STEPS = [
  { icon: Lightbulb, label: "Describe", body: "Write a few sentences about the app you want, in plain language." },
  { icon: FileText, label: "Specify", body: "We turn your idea into a full application plan you can review and edit." },
  { icon: Hammer, label: "Build", body: "Approve the plan and we scaffold the working app from it." },
]

const PROMPTS = [
  "A habit tracker with streaks and weekly reminders",
  "An internal tool for logging customer support tickets",
  "A marketplace where freelancers list services by category",
]

export default async function NewIdeaProjectPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fnew%2Fidea")

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
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-foreground">Idea mode</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Start from a blank idea.</h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              No reference site needed. Describe what you want to build in your own words, and we&apos;ll turn it
              straight into an editable application plan — roles, data, features, and all.
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="order-2 flex flex-col gap-6 border border-border bg-card p-6 lg:order-1 lg:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium">Describe your app</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                The more specific you are about who it&apos;s for and what they do in it, the better the first plan.
              </p>
            </div>
            <CreateIdeaForm />
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Need a starting point?</p>
              <ul className="flex flex-col gap-1.5">
                {PROMPTS.map((p) => (
                  <li key={p} className="text-sm leading-6 text-muted-foreground">
                    {"\u2022 "}
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="order-1 flex flex-col gap-5 lg:order-2">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex gap-4 border-l border-border pl-5">
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent-foreground/30 bg-accent/40 font-mono text-xs text-accent-foreground">
                    {i + 1}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pb-1">
                  <div className="flex items-center gap-2">
                    <step.icon className="size-4 text-accent-foreground" />
                    <p className="font-medium">{step.label}</p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
