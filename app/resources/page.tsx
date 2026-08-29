import Link from "next/link"
import { ArrowLeft, BookOpen, Code2, Compass, Sparkles } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

const resources = [
  { icon: Compass, title: "The MirrorSite method", copy: "A practical guide to moving from reference, intent, and structure into a buildable first version." },
  { icon: Code2, title: "For developers", copy: "How to use generated foundations as a starting point for real auth, data, and product logic." },
  { icon: Sparkles, title: "For designers", copy: "Keep the visual language while making room for states, behavior, and the details screenshots cannot show." },
]

export const metadata = {
  title: "Resources | MirrorSite AI",
  description: "Guides for turning references and ideas into working applications with MirrorSite AI.",
}

export default function ResourcesPage() {
  return (
    <main className="workspace-environment min-h-svh bg-background text-foreground"><span className="workspace-signal" aria-hidden="true" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 font-mono text-sm font-semibold"><span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">M</span>mirrorsite<span className="text-primary">.ai</span></Link>
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back home</Link>
      </header>
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16 lg:px-10 lg:pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Resources</p>
        <h1 className="mt-5 max-w-3xl text-balance text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">Build with more signal.</h1>
        <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">Short, useful notes for founders, designers, and developers who want to turn inspiration into something they can actually own.</p>
        <div className="mt-16 grid gap-4 md:grid-cols-3">{resources.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-xl border border-border bg-card p-6"><Icon className="size-5 text-primary" /><h2 className="mt-8 text-xl font-medium">{title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p><span className="mt-8 inline-flex font-mono text-xs text-primary">Coming soon</span></article>)}</div>
        <div className="mt-16 rounded-xl border border-border bg-card p-8 sm:p-10"><BookOpen className="size-5 text-primary" /><h2 className="mt-6 text-2xl font-semibold">Start with a real project</h2><p className="mt-3 max-w-xl leading-7 text-muted-foreground">The best way to learn the workflow is to bring a reference or idea into the workspace and inspect what MirrorSite understands.</p><Link href="/register" className={buttonVariants({ size: "lg" }) + " mt-7"}>Start building</Link></div>
      </section>
    </main>
  )
}
