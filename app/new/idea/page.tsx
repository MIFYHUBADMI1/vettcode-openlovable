"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lightbulb, FileText, Hammer } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { FounderIdeaForm } from "@/components/founder-idea-form"
import { useSession } from "@/lib/client/api"

const STEPS = [
  { icon: Lightbulb, label: "Describe", body: "Tell us the problem you're solving and who it's for. Plain language is fine." },
  { icon: FileText, label: "Plan", body: "We turn your inputs into a structured app plan you can review and refine with AI." },
  { icon: Hammer, label: "Build", body: "Happy with the plan? Hit submit and we scaffold the full working app." },
]

export default function NewIdeaProjectPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login?next=%2Fnew%2Fidea")
    }
  }, [session, isLoading, router])

  if (isLoading || !session) return null

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
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Start from your idea.
            </h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              No technical knowledge needed. Tell us what problem you&apos;re solving and who it&apos;s for —
              we&apos;ll turn it into a structured app plan you can review before anything is built.
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Form */}
          <div className="order-2 flex flex-col gap-6 border border-border bg-card p-6 lg:order-1 lg:p-8">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-medium">Your business idea</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Fill in what you know. The more specific you are, the better the plan.
              </p>
            </div>
            <FounderIdeaForm />
          </div>

          {/* Steps sidebar */}
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

            <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                No code required
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                You describe the business. We handle the technical architecture, authentication, database, and deployment — automatically.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
