import Link from "next/link"
import { ArrowLeft, Zap, Crown, Clock, CreditCard, Target, Layers } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { buttonVariants } from "@/components/ui/button"

export default function ModesComparisonPage() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10 lg:px-10 lg:py-14">
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
              Pipeline Modes Comparison
            </h1>
            <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              MirrorSite offers two pipeline modes for generating applications from websites or ideas. Choose
              the right mode for your project based on complexity, quality needs, and time constraints.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Legacy Mode Card */}
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-8">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-primary" />
                  <h2 className="text-2xl font-semibold">MirrorSite Legacy</h2>
                </div>
                <p className="text-sm text-muted-foreground">Fast and efficient for simple projects</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-medium text-primary">
                DEFAULT
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Processing Time</p>
                  <p className="text-sm text-muted-foreground">30-60 seconds</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Credit Usage</p>
                  <p className="text-sm text-muted-foreground">~10 credits per generation</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Target className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Best For</p>
                  <p className="text-sm text-muted-foreground">
                    Simple apps, quick prototypes, landing pages, basic dashboards
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Pipeline Architecture</p>
                  <p className="text-sm text-muted-foreground">Single-stage AI generation</p>
                </div>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="mb-2 font-medium text-sm">What you get:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Direct specification generation</li>
                <li>• Basic feature detection</li>
                <li>• Standard quality output</li>
                <li>• Good for most use cases</li>
              </ul>
            </div>
          </div>

          {/* Heavy Mode Card */}
          <div className="flex flex-col gap-6 rounded-xl border-2 border-primary/40 bg-primary/5 p-8">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Crown className="size-5 text-primary" />
                  <h2 className="text-2xl font-semibold">MirrorSite Heavy</h2>
                </div>
                <p className="text-sm text-muted-foreground">Premium quality for complex applications</p>
              </div>
              <span className="rounded-full bg-primary px-3 py-1 font-mono text-xs font-medium text-primary-foreground">
                PREMIUM
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Processing Time</p>
                  <p className="text-sm text-muted-foreground">2-5 minutes</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Credit Usage</p>
                  <p className="text-sm text-muted-foreground">~50-100 credits per generation</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Target className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Best For</p>
                  <p className="text-sm text-muted-foreground">
                    Complex SaaS apps, e-commerce platforms, enterprise dashboards, multi-feature applications
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Pipeline Architecture</p>
                  <p className="text-sm text-muted-foreground">7-stage enhanced AI pipeline</p>
                </div>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-primary/40 bg-background p-4">
              <h3 className="mb-2 font-medium text-sm">What you get:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Deep understanding analysis</li>
                <li>• Research-backed decisions</li>
                <li>• Multi-stage planning & critique</li>
                <li>• Automated repair & validation</li>
                <li>• Content sanitization</li>
                <li>• Up to 200% better quality</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 7-Stage Pipeline Breakdown */}
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-8">
          <h2 className="text-2xl font-semibold">Heavy Mode: 7-Stage Pipeline</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            The Heavy pipeline processes your project through seven specialized stages to deliver
            significantly better results:
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { stage: "1. Understanding", desc: "Deep analysis of your website or idea" },
              { stage: "2. Research", desc: "Investigation of similar patterns and best practices" },
              { stage: "3. Planning", desc: "Comprehensive architecture and feature planning" },
              { stage: "4. Critique", desc: "Critical review and improvement suggestions" },
              { stage: "5. Repair", desc: "Address issues and refine the plan" },
              { stage: "6. Validation", desc: "Ensure completeness and correctness" },
              { stage: "7. Sanitization", desc: "Final cleanup and optimization" },
            ].map(({ stage, desc }) => (
              <div key={stage} className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-mono text-xs font-medium text-primary">{stage}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* When to Use Each Mode */}
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-8">
          <h2 className="text-2xl font-semibold">Which Mode Should You Choose?</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">Use Legacy when:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>You need quick iterations and fast results</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Your project is relatively simple or straightforward</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>You're prototyping or testing an idea</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Credit efficiency is important</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>The output quality meets your needs</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">Use Heavy when:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>You need the highest possible quality</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Your application has complex features or workflows</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>You're building a production-grade SaaS or e-commerce app</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>The project justifies the additional time and credits</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>You want comprehensive planning and validation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Start a New Project
          </Link>
        </div>
      </section>
    </main>
  )
}

