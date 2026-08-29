import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, ScanSearch, FileText, Hammer } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { CreateProjectForm } from "@/components/create-project-form"
import { getCurrentUser } from "@/lib/auth/session"

const STEPS = [
  { icon: Globe, label: "Crawl", body: "We fetch the live site: pages, navigation, screenshots, and copy." },
  { icon: ScanSearch, label: "Understand", body: "An analysis pass infers purpose, roles, flows, and data entities." },
  { icon: FileText, label: "Specify", body: "You review and edit a full application plan before anything is built." },
  { icon: Hammer, label: "Build", body: "Approve the plan and we scaffold the working app from it." },
]

export default async function NewWebsiteProjectPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fnew%2Fwebsite")

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
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Website mode</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Mirror an existing site.</h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              Point us at a live website. We crawl it, build a structured understanding of what it does, then turn that
              into an editable plan for the real application it should become — before a single line of the build is
              written.
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="order-2 flex flex-col gap-6 border border-border bg-card p-6 lg:order-1 lg:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium">Enter the source URL</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {"Works best on marketing sites, dashboards, and app front-ends with a handful of representative pages."}
              </p>
            </div>
            <CreateProjectForm />
          </div>

          <div className="order-1 flex flex-col gap-5 lg:order-2">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex gap-4 border-l border-border pl-5">
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs text-primary">
                    {i + 1}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pb-1">
                  <div className="flex items-center gap-2">
                    <step.icon className="size-4 text-primary" />
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
