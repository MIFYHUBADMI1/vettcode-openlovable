import Link from "next/link"
import {
  ArrowRight, Brain, Code2, TrendingUp, Search, DollarSign,
  Lightbulb, Rocket, BarChart3, Building2, Users, Shield,
  Globe2, Database, Server, Check,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AuthTrigger } from "@/components/auth/auth-trigger"

const TEAM = [
  { icon: Brain, name: "AI Co-Founder", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", body: "Think through your offer, your customers, your pricing, and the next step. A planning partner to work with, not a replacement for your judgment." },
  { icon: Search, name: "Research & Strategy", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", body: "Explore the market, understand alternatives, and identify the people your business could help. Use the research to make better-informed decisions." },
  { icon: Code2, name: "Product & Engineering", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", body: "Create the website or digital product your business needs, with the hosting, customer accounts, and database behind it. Review and test the result before launch." },
  { icon: TrendingUp, name: "Growth Team", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", body: "Work on your launch, content, search visibility, and ways to reach customers. Learn from activity and feedback rather than assuming a launch will bring sales." },
  { icon: DollarSign, name: "Funding Support", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", body: "When fundraising makes sense, get help shaping the business story and preparing materials. Support with preparation is not a promise of investment." },
]

const PRINCIPLES = [
  { icon: Lightbulb, title: "Opportunity over background", body: "Your starting point should not decide whether you get to try. Make the tools and knowledge of business ownership more accessible." },
  { icon: Building2, title: "The business comes first", body: "A website is a tool. The purpose is to offer something useful, serve customers, and work toward a sustainable income." },
  { icon: Users, title: "You stay in charge", body: "AI teams help with the work. You shape the plan, review decisions, and remain responsible for the business you run." },
  { icon: Shield, title: "Honesty about the journey", body: "No guaranteed earnings, instant customers, or effortless success. Building a business takes learning, judgment, and continued work." },
  { icon: Rocket, title: "Support beyond launch", body: "Launching is a milestone, not the finish line. Operations, marketing, and listening to customers matter just as much." },
]

const CAPABILITIES = [
  { icon: Globe2, title: "A place to do business", copy: "A website or digital product where people can understand your offer and use what you provide." },
  { icon: Server, title: "Hosting and publishing", copy: "The technical foundation for putting your business online and keeping its services together." },
  { icon: Database, title: "Business records", copy: "A database and tools for working with the information your business needs." },
  { icon: Users, title: "Customer relationships", copy: "Accounts and customer information that help you understand and serve the people using your business." },
  { icon: DollarSign, title: "Payments and operations", copy: "Tools to work with payments and daily business activity, with the relevant services configured for your business." },
  { icon: BarChart3, title: "Marketing and learning", copy: "AI support and analytics to help you reach people, understand activity, and improve your offer." },
]

export const ABOUT_FAQ = [
  { q: "What is Atai?", a: "Atai is an AI business-building platform for starting, running, managing, and growing an online business. Specialized AI teams help with planning, the website or digital product, hosting, operations, and marketing. The goal is a business that serves customers, not simply a generated app." },
  { q: "Why was Atai created?", a: "Atai's mission is to expand economic opportunity by making business ownership more accessible. Its founder, Masereka Adorable Kimulya, grew up with limited resources in Kasese, Uganda, and wants more people to have the support to turn their skills and ideas into businesses." },
  { q: "Who founded Atai?", a: "Atai was founded by Masereka Adorable Kimulya, a Ugandan technology enthusiast and self-taught programmer from Kasese. Their early journey is being developed into a book and documentary with the working title The Rise of Atai." },
  { q: "Who is Atai for?", a: "People starting their first business, freelancers turning a skill into a service, creators with something to sell, and small businesses moving online. You do not need to begin with a technical team or a finished product." },
  { q: "Do I need to know how to code?", a: "No coding knowledge is needed to start planning with Atai. Describe your business in plain language, work through the plan, and review the website or product created for it. You still need to test the result and make your own business decisions." },
  { q: "Does Atai guarantee customers or income?", a: "No. Atai provides tools and AI support, not guaranteed sales, profits, or investment. Results depend on the offer, the market, execution, and many factors outside the platform. You remain responsible for your business." },
  { q: "How is this different from an app builder?", a: "Creating a website or app is one part of the journey. Atai brings planning, technical infrastructure, day-to-day management, and growth work around that product, so the focus stays on running a business and serving customers." },
  { q: "What is ATAI Enterprises?", a: "ATAI stands for Advanced Technologies and AI Enterprises, the company behind Atai. Its focus is practical technology that helps more people participate in building and running digital businesses." },
]

export function AboutContent() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center lg:px-10 lg:pt-24">
        <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-xs text-primary">
          <span className="size-1.5 rounded-full bg-primary" /> About Atai
        </p>
        <h1 className="text-balance text-4xl font-black leading-[1.08] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          Opportunity should not depend on <span className="font-light text-muted-foreground">where you start.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
          Atai exists to help more people build an income through a business of their own. Specialized AI teams bring planning, technology, operations, and marketing within reach—so having an idea does not have to mean doing everything alone.
        </p>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          Start with a skill, an idea, or a problem worth solving. <span className="font-semibold text-foreground">Build for the people you want to serve.</span>
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-7")}>
            Start my business <ArrowRight className="size-4" />
          </AuthTrigger>
          <Link href="/founder" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-7")}>
            Meet the founder
          </Link>
        </div>
        <nav aria-label="About Atai sections" className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          {[['#mission', 'Our mission'], ['#team', 'Your AI teams'], ['#principles', 'Our principles'], ['#company', 'Our roots'], ['#questions', 'Questions']].map(([href, label]) => (
            <a key={href} href={href} className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</a>
          ))}
        </nav>
      </section>

      <section id="mission" className="scroll-mt-24 border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 lg:grid-cols-2 lg:items-center lg:px-10">
          <div>
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why Atai exists</p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Talent is everywhere. Access to opportunity is not.</h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              A useful idea can go nowhere when the tools, technical help, or money to begin are out of reach. And getting a website online does not solve the next challenges: finding customers, managing the work, and making the business sustainable.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Atai’s long-term mission is to help reduce poverty by widening access to business ownership. That is an ambition to work toward—not a claim that software alone can solve poverty.
            </p>
            <p className="mt-6 text-lg font-bold">The starting point is practical support for real work.</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-widest text-primary/70">What that means for you</p>
            <ul className="space-y-4">
              {[
                "Shape an offer around something people need.",
                "Plan who you will serve and how the business could earn.",
                "Create and host the website or product that supports it.",
                "Manage customers, payments, and daily operations.",
                "Work on marketing, learn from feedback, and improve.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm font-medium">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />{line}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-primary/20 pt-5 text-sm font-semibold leading-6 text-primary">You own the direction. Your AI teams help you move it forward.</p>
          </div>
        </div>
      </section>

      <section id="team" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="mb-14 text-center">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Specialized AI teams</p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Different work. Shared business goals.</h2>
            <p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">Planning, building, and reaching customers require different kinds of work. Atai brings focused AI support to each stage, with you making the decisions.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member) => (
              <article key={member.name} className={`min-w-0 rounded-2xl border ${member.border} ${member.bg} p-6`}>
                <div className="mb-4 flex items-center gap-3">
                  <member.icon className={`size-5 shrink-0 ${member.color}`} />
                  <h3 className={`text-sm font-bold ${member.color}`}>{member.name}</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{member.body}</p>
              </article>
            ))}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
              <p className="text-2xl font-black text-primary">Your business. Your decisions.</p>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">AI support does not remove your responsibility to review the work, understand your customers, and keep learning.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="principles" className="scroll-mt-24 border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Our principles</p>
          <h2 className="mb-12 text-3xl font-black tracking-tight sm:text-4xl">What should stay true as Atai grows.</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <article key={item.title} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border/50 bg-card p-6">
                <item.icon className="size-5 text-primary" />
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">The tools behind the work</p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Technology in service of your business.</h2>
            <p className="mt-5 leading-7 text-muted-foreground">You do not need a list of technical terms to begin. You need a way to put your offer online, serve people, and understand how the business is doing.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <article key={item.title} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/50 bg-card p-6">
                <item.icon className="size-5 text-primary" />
                <h3 className="text-sm font-bold">{item.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="company" className="scroll-mt-24 border-y border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Our roots</p>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">From Kasese, Uganda, to a wider ambition.</h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-muted-foreground">
            <p>Atai was founded by <strong className="font-semibold text-foreground">Masereka Adorable Kimulya</strong>, a Ugandan technology enthusiast and self-taught programmer who grew up with limited resources in Kasese.</p>
            <p>Their early journey involved saving for a phone, working in carpentry, learning to code, and discovering that making software work is very different from building a business people use and pay for. Those experiences give Atai’s mission a personal foundation.</p>
            <p>ATAI—Advanced Technologies and AI Enterprises—is the company behind Atai. The aim is to help more people participate in the digital economy as business owners, not only as users of technology.</p>
          </div>
          <Link href="/founder" className="mt-7 inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Read Masereka Adorable Kimulya’s story <ArrowRight className="size-4 shrink-0" />
          </Link>
        </div>
      </section>

      <section id="questions" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Questions</p>
          <h2 className="mb-10 text-3xl font-black tracking-tight sm:text-4xl">Understanding Atai.</h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-6">
            {ABOUT_FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="cursor-pointer py-5 text-sm font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.q}</summary>
                <p className="pb-5 text-sm leading-7 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-card/30 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Take the first step toward a business of your own.</h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">You do not need every answer today. Start with what you know, and work through the next step with Atai.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 px-8")}>
              Plan my business <ArrowRight className="size-4" />
            </AuthTrigger>
            <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-8")}>See pricing</Link>
          </div>
        </div>
      </section>
    </>
  )
}
