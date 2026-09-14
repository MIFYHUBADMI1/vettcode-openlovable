"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Code2,
  Compass,
  Globe,
  Lightbulb,
  Rocket,
  Zap,
  CreditCard,
  Settings,
  HelpCircle,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Upload,
  Puzzle,
  Crown,
  Database,
  GitCompare,
  DollarSign,
  BookOpen,
  Shield,
  Users,
  ExternalLink,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { DocsSearch } from "@/components/docs-search"
import { VideoEmbed } from "@/components/video-embed"
import { ScrollProgress } from "@/components/scroll-progress"

/* ═══════════════════════════════════════════════════════════════
   SECTION METADATA (for search)
   ═══════════════════════════════════════════════════════════════ */

const sectionMeta = [
  { id: "getting-started", label: "Getting Started", icon: Rocket, keywords: ["signup", "register", "account", "first project", "quick start", "begin", "new user", "500 credits", "free"] },
  { id: "how-it-works", label: "How It Works", icon: Zap, keywords: ["understand", "plan", "build", "workflow", "process", "stages", "overview"] },
  { id: "pipeline-modes", label: "Pipeline Modes", icon: Crown, keywords: ["legacy", "heavy", "mode", "pipeline", "stages", "quality", "credits", "comparison", "7 stage"] },
  { id: "website-mode", label: "Website Mode", icon: Globe, keywords: ["url", "website", "mirror", "clone", "scrape", "crawl", "deep crawl", "relevant", "link", "paste"] },
  { id: "idea-mode", label: "Idea Mode", icon: Lightbulb, keywords: ["idea", "describe", "description", "prompt", "from scratch", "concept", "brainstorm"] },
  { id: "understanding", label: "Understanding & Planning", icon: Compass, keywords: ["analysis", "plan", "features", "data model", "user flows", "design direction", "blueprint"] },
  { id: "editing-your-plan", label: "Editing Your Plan", icon: FileText, keywords: ["edit", "customize", "modify", "change", "enable", "disable", "features", "instructions"] },
  { id: "building", label: "Building Your Application", icon: Code2, keywords: ["build", "generate", "compile", "deploy", "frontend", "backend", "database", "code"] },
  { id: "database-manager", label: "Database Manager", icon: Database, keywords: ["database", "tables", "records", "fields", "schema", "data", "crud", "create", "edit", "delete"] },
  { id: "workspace", label: "Working With Your App", icon: Puzzle, keywords: ["workspace", "preview", "source code", "instruction bar", "database manager", "edit", "changes"] },
  { id: "publishing", label: "Publishing & Domains", icon: Upload, keywords: ["publish", "domain", "subdomain", "dns", "deploy", "live", "url", "https", "custom domain"] },
  { id: "github", label: "GitHub Integration", icon: GitCompare, keywords: ["github", "git", "repo", "repository", "push", "auto-push", "build from", "source control", "version control", "connect", "oauth"] },
  { id: "credits", label: "Credits & Billing", icon: CreditCard, keywords: ["credits", "billing", "payment", "price", "cost", "top up", "mobile money", "mtn", "airtel", "free"] },
  { id: "account", label: "Account & Settings", icon: Settings, keywords: ["account", "profile", "password", "security", "settings", "referral", "refer", "earn"] },
  { id: "faq", label: "Frequently Asked Questions", icon: HelpCircle, keywords: ["faq", "question", "answer", "help", "support", "problem", "issue", "export", "mobile", "secure"] },
]

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function DocsContent() {
  const [visibleIds, setVisibleIds] = useState<string[]>(
    sectionMeta.map((s) => s.id),
  )

  const handleFilter = useCallback((ids: string[]) => {
    setVisibleIds(ids)
  }, [])

  const isVisible = (id: string) => visibleIds.includes(id)

  return (
    <>
      <ScrollProgress />
      <SiteHeader activePage="/docs" />

      {/* Hero */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <Link
            href="/resources"
            className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Resources
          </Link>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground font-mono text-sm font-bold">
              M
            </span>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              Documentation
            </p>
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything you need to build with MirrorSite AI
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Step-by-step guides, detailed explanations, and answers to common
            questions. Learn how to turn any website or idea into a working
            application.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block">
          <ScrollSpyNav sectionIds={sectionMeta.map((s) => s.id)} visibleIds={visibleIds} />
        </aside>

        {/* Content */}
        <div className="prose-custom max-w-3xl space-y-16">

          {/* Mobile search */}
          <div className="lg:hidden">
            <DocsSearch sections={sectionMeta} onFilter={handleFilter} />
          </div>

          {/* ─── QUICK LINKS ─── */}
          <section className="not-prose">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Quick links — all pages</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: "/pricing", icon: DollarSign, label: "Pricing", desc: "Plans, credit packs & build costs", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
                { href: "/modes-comparison", icon: GitCompare, label: "Modes Comparison", desc: "Legacy vs Heavy pipeline breakdown", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
                { href: "/dashboard", icon: Rocket, label: "Dashboard", desc: "Your projects & activity", color: "text-primary", bg: "bg-primary/10" },
                { href: "/new", icon: Lightbulb, label: "New Project", desc: "Start building a new app", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
                { href: "/account", icon: Settings, label: "Account & Settings", desc: "Profile, security & billing", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
                { href: "/referrals", icon: Users, label: "Refer & Earn", desc: "Share your referral link for credits", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
                { href: "/billing", icon: CreditCard, label: "Billing", desc: "Manage your subscription & credits", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
                { href: "/resources", icon: BookOpen, label: "Resources", desc: "Guides, tutorials & more", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
                { href: "/about", icon: Shield, label: "About MirrorSite", desc: "Our mission and story", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
              ].map(({ href, icon: Icon, label, desc, color, bg }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5"
                >
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`size-4 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                  </div>
                  <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* ─── GETTING STARTED ─── */}
          <section id="getting-started" style={{ opacity: isVisible("getting-started") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Rocket} title="Getting Started" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                MirrorSite AI is a tool that turns websites and ideas into working applications. You give it a starting point — a website address or a description of what you want to build — and it creates a complete, functional application you can edit, improve, and publish.
              </p>
              <p>
                You don&apos;t need to know how to code. You don&apos;t need design skills. You just need an idea of what you want to build, or a website you want to turn into something new.
              </p>

              {/* Video placeholder — replace src with your YouTube/Vimeo URL when ready */}
              <VideoEmbed
                title="Getting Started with MirrorSite AI"
                duration="3:45"
              /* Uncomment and paste your video URL when ready: */
              /* src="https://www.youtube.com/embed/YOUR_VIDEO_ID" */
              />

              <h3 className="text-lg font-semibold text-foreground mt-8">What you&apos;ll need</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> A free MirrorSite AI account</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> A website address to mirror, or an idea to build from</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Credits for building (new accounts start with 500 free credits)</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">Your first project in 4 steps</h3>
              <div className="space-y-4">
                {[
                  { step: 1, title: "Create an account", body: "Sign up with your email or Google account. You'll get 500 free credits to start." },
                  { step: 2, title: "Choose your starting point", body: "Paste a website address or describe your app idea. MirrorSite AI will analyze it and create a structured plan." },
                  { step: 3, title: "Review and customize the plan", body: "See exactly what will be built — features, screens, data, and design. Edit anything before building." },
                  { step: 4, title: "Build and publish", body: "One click generates your working application. Publish it to a free web address or connect your own domain." },
                ].map(({ step, title, body }) => (
                  <div key={step} className="flex gap-4 rounded-lg border border-border bg-card p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">{step}</span>
                    <div>
                      <p className="font-medium text-foreground">{title}</p>
                      <p className="mt-1 text-sm">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <SectionFeedbackInline sectionId="getting-started" />
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section id="how-it-works" style={{ opacity: isVisible("how-it-works") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Zap} title="How It Works" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                MirrorSite AI works in three stages: <strong className="text-foreground">Understand</strong>, <strong className="text-foreground">Plan</strong>, and <strong className="text-foreground">Build</strong>.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Compass, title: "Understand", body: "MirrorSite AI reads your starting point — a website or idea — and figures out what it is, what it does, and how it's structured." },
                  { icon: FileText, title: "Plan", body: "It creates a detailed blueprint of the application: screens, features, data, and design direction. You review and edit this before anything is built." },
                  { icon: Code2, title: "Build", body: "Once you approve the plan, MirrorSite AI generates a complete, working application with a real frontend, backend, and database." },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-xl border border-border bg-card p-5">
                    <Icon className="size-5 text-primary mb-3" />
                    <h3 className="font-medium text-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-6">{body}</p>
                  </div>
                ))}
              </div>

              <p>
                The key difference from other tools is that MirrorSite AI understands the full picture before building. It doesn&apos;t just generate screens — it creates a complete application with working data, user accounts, and real functionality.
              </p>
            </div>
            <SectionFeedbackInline sectionId="how-it-works" />
          </section>

          {/* ─── PIPELINE MODES ─── */}
          <section id="pipeline-modes" style={{ opacity: isVisible("pipeline-modes") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Crown} title="Pipeline Modes" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                MirrorSite AI offers two pipeline modes when generating your application. You choose the mode when creating a new project — it controls how deeply the AI analyses, plans, and builds your app.
              </p>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Legacy */}
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      <Zap className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Legacy Mode</p>
                      <p className="text-xs text-muted-foreground">Fast · 5-stage pipeline</p>
                    </div>
                    <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-primary">DEFAULT</span>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {["30–60 second processing", "5 credits for scrape + 5 for planning", "25k / 50k / 75k credits for builds", "Good for prototypes and simple apps", "Single-pass specification generation"].map(item => (
                      <li key={item} className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Heavy */}
                <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20">
                      <Crown className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Heavy Mode</p>
                      <p className="text-xs text-muted-foreground">Premium · 7-stage pipeline</p>
                    </div>
                    <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] font-medium text-primary-foreground">PREMIUM</span>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {["2–5 minute processing", "100 credits for scrape + 100 for planning", "50k / 75k / 100k credits for builds", "Mandatory admin dashboard + analytics", "Research, critique, repair & validation stages", "Totalum feature recommendations included"].map(item => (
                      <li key={item} className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground">The 7 Heavy mode stages</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:col-span-2">
                {[
                  { n: "1", stage: "Understanding", desc: "Deep analysis of your website or idea" },
                  { n: "2", stage: "Research", desc: "Detects missing features, security gaps & best practices" },
                  { n: "3", stage: "Planning", desc: "Generates a comprehensive application specification" },
                  { n: "4", stage: "Critique", desc: "Independent quality review of the plan" },
                  { n: "5", stage: "Repair", desc: "Fixes issues found during critique" },
                  { n: "6", stage: "Validation", desc: "Ensures the spec is complete and consistent" },
                  { n: "7", stage: "Sanitization", desc: "Final cleanup for Totalum compatibility" },
                ].map(({ n, stage, desc }) => (
                  <div key={stage} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{n}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{stage}</p>
                      <p className="mt-0.5 text-xs leading-5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
                <GitCompare className="size-5 shrink-0 text-primary" />
                <p className="text-sm">
                  Want a full side-by-side comparison?{" "}
                  <Link href="/modes-comparison" className="font-medium text-primary underline-offset-2 hover:underline">
                    View the Modes Comparison page →
                  </Link>
                </p>
              </div>
            </div>
            <SectionFeedbackInline sectionId="pipeline-modes" />
          </section>

          {/* ─── WEBSITE MODE ─── */}
          <section id="website-mode" style={{ opacity: isVisible("website-mode") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Globe} title="Website Mode" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                Website Mode lets you point MirrorSite AI at any live website and turn it into a working application. This is the most popular way to start.
              </p>

              <h3 className="text-lg font-semibold text-foreground">How to use Website Mode</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li>Go to your dashboard and click <strong className="text-foreground">New Project</strong></li>
                <li>Select <strong className="text-foreground">Mirror a Website</strong></li>
                <li>Paste the website address you want to mirror</li>
                <li>Choose your analysis mode:
                  <ul className="mt-2 space-y-1 list-disc list-inside ml-4">
                    <li><strong className="text-foreground">Relevant Info</strong> — MirrorSite AI analyzes the most important pages, understands the product, and creates a custom plan. Best for most projects.</li>
                    <li><strong className="text-foreground">Deep Crawl</strong> — MirrorSite AI crawls the entire website, collects every page, and builds an exact replica. Best when you need the whole site preserved.</li>
                  </ul>
                </li>
                <li>Review the analysis and plan that MirrorSite AI creates</li>
                <li>Edit anything you want, then click <strong className="text-foreground">Build</strong></li>
              </ol>

              <h3 className="text-lg font-semibold text-foreground mt-8">What Website Mode analyzes</h3>
              <p>When MirrorSite AI analyzes a website, it looks at:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Pages and navigation</strong> — the structure, menus, and how pages connect</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Design and layout</strong> — colors, fonts, spacing, and visual patterns</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Features and functionality</strong> — what the site does, user flows, and interactive elements</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Content and copy</strong> — text, images, and media across the site</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Data patterns</strong> — what kind of information the site stores and displays</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">Website Mode works best with</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Marketing websites and landing pages</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Application dashboards and admin panels</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> E-commerce storefronts</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Portfolio and showcase sites</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> SaaS product interfaces</li>
              </ul>
            </div>
            <SectionFeedbackInline sectionId="website-mode" />
          </section>

          {/* ─── IDEA MODE ─── */}
          <section id="idea-mode" style={{ opacity: isVisible("idea-mode") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Lightbulb} title="Idea Mode" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                Idea Mode lets you start from a description instead of a website. Describe what you want to build — as simple or detailed as you like — and MirrorSite AI turns it into a structured application plan.
              </p>

              <h3 className="text-lg font-semibold text-foreground">How to use Idea Mode</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li>Go to your dashboard and click <strong className="text-foreground">New Project</strong></li>
                <li>Select <strong className="text-foreground">Start from an Idea</strong></li>
                <li>Describe what you want to build. Be as specific as you can:
                  <div className="mt-3 rounded-lg border border-border bg-card p-4 font-mono text-sm">
                    <p className="text-muted-foreground italic">
                      &quot;A marketplace where local businesses can create profiles, publish products, manage orders, and receive payments. It should have a dashboard for business owners, a public storefront, and an admin panel.&quot;
                    </p>
                  </div>
                </li>
                <li>MirrorSite AI will create a full application plan from your description</li>
                <li>Review, edit, and build</li>
              </ol>

              <h3 className="text-lg font-semibold text-foreground mt-8">Tips for better results</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Be specific about features</strong> — mention dashboards, user roles, data types, and key actions</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Describe your users</strong> — who will use this? What do they need to do?</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Mention the style</strong> — &quot;clean and minimal&quot;, &quot;colorful and playful&quot;, &quot;professional and corporate&quot;</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Don&apos;t worry about technical details</strong> — MirrorSite AI handles the technology for you</span></li>
              </ul>
            </div>
            <SectionFeedbackInline sectionId="idea-mode" />
          </section>

          {/* ─── UNDERSTANDING & PLANNING ─── */}
          <section id="understanding" style={{ opacity: isVisible("understanding") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Compass} title="Understanding & Planning" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                After MirrorSite AI analyzes your starting point, it creates a detailed application plan. This is the most important step — it&apos;s where MirrorSite AI figures out exactly what your application needs.
              </p>

              <h3 className="text-lg font-semibold text-foreground">What the plan includes</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Application Type", body: "What kind of application this is — a marketplace, a dashboard, a portfolio, etc." },
                  { title: "Purpose", body: "A clear description of what the application does and who it's for." },
                  { title: "Features", body: "A checklist of capabilities — authentication, dashboards, payments, file uploads, and more." },
                  { title: "Data Model", body: "What information the application stores — users, products, orders, and how they relate." },
                  { title: "User Flows", body: "Step-by-step paths users take through the application." },
                  { title: "Design Direction", body: "Colors, fonts, layout style, and visual approach." },
                ].map(({ title, body }) => (
                  <div key={title} className="rounded-lg border border-border bg-card p-4">
                    <p className="font-medium text-foreground text-sm">{title}</p>
                    <p className="mt-1 text-sm">{body}</p>
                  </div>
                ))}
              </div>

              <p>
                You can review and edit every part of this plan before building. Nothing gets built until you say it&apos;s ready.
              </p>
            </div>
            <SectionFeedbackInline sectionId="understanding" />
          </section>

          {/* ─── EDITING YOUR PLAN ─── */}
          <section id="editing-your-plan" style={{ opacity: isVisible("editing-your-plan") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={FileText} title="Editing Your Plan" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                The plan MirrorSite AI creates is a starting point — not a final answer. You can change anything before building.
              </p>

              <h3 className="text-lg font-semibold text-foreground">What you can edit</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Enable or disable features</strong> — turn on payments, admin panels, file uploads, or any other capability</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Add or remove data types</strong> — define what information your application stores</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Change the design direction</strong> — update colors, fonts, and visual style</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Modify user flows</strong> — change how users move through the application</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Add custom instructions</strong> — tell MirrorSite AI about specific requirements or preferences</span></li>
              </ul>

              <p>
                After editing, MirrorSite AI will update the plan to reflect your changes. You can go back and forth as many times as you need.
              </p>
            </div>
            <SectionFeedbackInline sectionId="editing-your-plan" />
          </section>

          {/* ─── BUILDING ─── */}
          <section id="building" style={{ opacity: isVisible("building") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Code2} title="Building Your Application" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                When you click <strong className="text-foreground">Build</strong>, MirrorSite AI generates your complete application. This usually takes a few minutes.
              </p>

              <h3 className="text-lg font-semibold text-foreground">What gets built</h3>
              <p>Your application includes everything it needs to work:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "A complete user interface with multiple screens",
                  "Working navigation between pages",
                  "A database to store your application data",
                  "User accounts with sign-up and login",
                  "A backend that handles data and logic",
                  "Responsive design that works on phones and computers",
                  "An API layer connecting the interface to the backend",
                  "Deployment configuration ready to publish",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-foreground mt-8">What happens after building</h3>
              <p>Once the build is complete, you can:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Preview your application in a live environment</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Open the source code and make changes directly</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Send instructions to continue building and adding features</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> Publish to a web address for anyone to access</li>
              </ul>
            </div>
            <SectionFeedbackInline sectionId="building" />
          </section>

          {/* ─── DATABASE MANAGER ─── */}
          <section id="database-manager" style={{ opacity: isVisible("database-manager") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Database} title="Database Manager" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                Every application MirrorSite AI builds comes with a live database. The Database Manager lets you browse tables, view records, create new entries, edit existing ones, and delete data — all without touching code or writing SQL.
              </p>

              <h3 className="text-lg font-semibold text-foreground">How to access the Database Manager</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li>Open any built project from your dashboard</li>
                <li>Click the <strong className="text-foreground">Database</strong> button in the project header</li>
                <li>You&apos;ll see all the tables your app uses, with their field schemas</li>
                <li>Click any table to browse and manage its records</li>
              </ol>

              <h3 className="text-lg font-semibold text-foreground">What you can do</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: "Browse Tables", desc: "See all your database tables with their field types, relations, and record counts." },
                  { title: "View Records", desc: "Paginated grid view of all records. Supports filtering by any field and sorting in either direction." },
                  { title: "Create Records", desc: "Add new rows directly from the browser — no code needed. All field types are supported." },
                  { title: "Edit Records", desc: "Click any row to edit its fields inline. Changes are saved immediately to the live database." },
                  { title: "Delete Records", desc: "Remove individual records with a confirmation step to prevent accidental deletions." },
                  { title: "Schema View", desc: "See field names, types, and relationships. Understand your data model at a glance." },
                ].map(({ title, desc }) => (
                  <div key={title} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm">{desc}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-foreground">Field types</h3>
              <p>The database manager displays every field type with its own colour and icon so you can instantly tell what kind of data each column holds:</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { type: "string", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800", icon: "fa-font" },
                  { type: "number", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: "fa-hashtag" },
                  { type: "date", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: "fa-calendar" },
                  { type: "boolean", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800", icon: "fa-toggle-on" },
                  { type: "options", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800", icon: "fa-list" },
                  { type: "file", color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800", icon: "fa-file" },
                  { type: "long-string", color: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800", icon: "fa-align-left" },
                  { type: "objectReference", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800", icon: "fa-link" },
                ].map(({ type, color, icon }) => (
                  <div key={type} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${color}`}>
                    <i className={`fa-solid ${icon} text-[10px]`} />
                    <span className="font-mono">{type}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
                <Database className="size-5 shrink-0 text-primary" />
                <p className="text-sm">
                  The Database Manager is available at{" "}
                  <span className="font-mono text-xs text-foreground bg-muted px-1.5 py-0.5 rounded">
                    /project/[id]/database
                  </span>{" "}
                  for any project that has been built.
                </p>
              </div>
            </div>
            <SectionFeedbackInline sectionId="database-manager" />
          </section>

          {/* ─── WORKSPACE ─── */}
          <section id="workspace" style={{ opacity: isVisible("workspace") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Puzzle} title="Working With Your Application" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                After your application is built, the workspace gives you full control. You can keep building, modify the code, or send instructions to add new features.
              </p>

              <h3 className="text-lg font-semibold text-foreground">The workspace includes</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Live preview</strong> — see your application running in real time</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Source code viewer</strong> — browse and edit the generated code</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Instruction bar</strong> — describe changes you want and MirrorSite AI will implement them</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Database manager</strong> — view and manage your application&apos;s data directly</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Deployment controls</strong> — publish, unpublish, and manage your live application</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">Sending instructions</h3>
              <p>Use the instruction bar to describe changes in plain language. MirrorSite AI will implement them for you. Some examples:</p>
              <div className="space-y-2">
                {[
                  "Add a search bar to the dashboard",
                  "Change the color scheme to blue and white",
                  "Add a settings page where users can update their profile",
                  "Create a report page that shows monthly sales data",
                  "Add email notifications when a new order comes in",
                ].map((example) => (
                  <div key={example} className="rounded-lg border border-border bg-card px-4 py-2.5 font-mono text-sm text-muted-foreground">
                    &quot;{example}&quot;
                  </div>
                ))}
              </div>
            </div>
            <SectionFeedbackInline sectionId="workspace" />
          </section>

          {/* ─── PUBLISHING ─── */}
          <section id="publishing" style={{ opacity: isVisible("publishing") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Upload} title="Publishing & Domains" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                Once your application is ready, you can publish it to the web so anyone can access it. MirrorSite AI offers two publishing options.
              </p>

              <h3 className="text-lg font-semibold text-foreground">Free Subdomain</h3>
              <p>
                Every published application gets a free web address at <strong className="text-foreground">yourapp.totalum-project.com</strong>. This is free forever, includes automatic security (HTTPS), and works instantly — no setup required.
              </p>

              <h3 className="text-lg font-semibold text-foreground mt-8">Custom Domain</h3>
              <p>
                Connect your own domain name (like <strong className="text-foreground">yourapp.com</strong>) for a professional, branded experience. You&apos;ll need to update a few settings at your domain provider — MirrorSite AI walks you through it step by step.
              </p>

              <h3 className="text-lg font-semibold text-foreground mt-8">How to publish</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li>Open your project and click <strong className="text-foreground">Publish</strong></li>
                <li>Choose between a free subdomain or a custom domain</li>
                <li>For custom domains, follow the DNS setup instructions</li>
                <li>Your application goes live within minutes</li>
              </ol>
            </div>
            <SectionFeedbackInline sectionId="publishing" />
          </section>

          {/* ─── CREDITS ─── */}
          <section id="credits" style={{ opacity: isVisible("credits") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={CreditCard} title="Credits & Billing" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                MirrorSite AI uses a credit system. Credits are spent when MirrorSite AI analyzes websites, generates plans, and builds applications.
              </p>

              <h3 className="text-lg font-semibold text-foreground">How credits work</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Subscription & permanent credits</strong> — monthly plans plus one-time credit packs</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">500 free credits</strong> — every new account starts with credits to try MirrorSite AI</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Buy more anytime</strong> — purchase permanent credit packs or subscribe via Dodo Payments</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">What costs credits — Legacy mode</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { action: "Website analysis (scrape)", cost: "5 credits" },
                  { action: "Plan generation", cost: "5 credits" },
                  { action: "Deep crawl", cost: "500 credits" },
                  { action: "Simple application build", cost: "25,000 credits" },
                  { action: "Medium application build", cost: "50,000 credits" },
                  { action: "Complex application build", cost: "75,000 credits" },
                  { action: "Publish / deploy", cost: "500 credits" },
                ].map(({ action, cost }) => (
                  <div key={action} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{action}</span>
                    <span className="font-mono text-sm text-primary">{cost}</span>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-foreground mt-8">What costs credits — Heavy mode</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { action: "Website analysis (scrape)", cost: "100 credits" },
                  { action: "Plan generation", cost: "100 credits" },
                  { action: "Deep crawl", cost: "500 credits" },
                  { action: "Simple application build", cost: "50,000 credits" },
                  { action: "Medium application build", cost: "75,000 credits" },
                  { action: "Complex application build", cost: "100,000 credits" },
                  { action: "Publish / deploy", cost: "500 credits" },
                ].map(({ action, cost }) => (
                  <div key={action} className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{action}</span>
                    <span className="font-mono text-sm text-primary">{cost}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
                <DollarSign className="size-5 shrink-0 text-primary" />
                <p className="text-sm">
                  See full plan pricing, credit packs, and hosting options on the{" "}
                  <Link href="/pricing" className="font-medium text-primary underline-offset-2 hover:underline">Pricing page →</Link>
                  {" "}or compare modes on the{" "}
                  <Link href="/modes-comparison" className="font-medium text-primary underline-offset-2 hover:underline">Modes Comparison page →</Link>
                </p>
              </div>

              <h3 className="text-lg font-semibold text-foreground mt-8">Build cost tiers</h3>
              <p>MirrorSite AI automatically classifies your project into one of three tiers based on the complexity of its specification:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Simple</strong> — straightforward apps with basic pages and minimal logic</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Medium</strong> — multi-page apps with authentication, data models, and dashboards</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Complex</strong> — advanced apps with multiple features, integrations, admin panels, and payments</span></li>
              </ul>
            </div>
            <SectionFeedbackInline sectionId="credits" />
          </section>

          {/* ─── ACCOUNT ─── */}
          <section id="account" style={{ opacity: isVisible("account") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Settings} title="Account & Settings" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <h3 className="text-lg font-semibold text-foreground">Managing your account</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Profile</strong> — update your name, profile picture, and display preferences</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Security</strong> — change your password, manage active sessions, and update your email</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Billing</strong> — view your credit balance, transaction history, and top up credits</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">Refer and earn</h3>
              <p>
                Invite friends to MirrorSite AI and earn bonus credits. When someone signs up using your referral link and becomes an active user, you both receive credits. Share your referral link from the <strong className="text-foreground">Refer &amp; Earn</strong> page in your account menu.
              </p>
            </div>
            <SectionFeedbackInline sectionId="account" />
          </section>

          {/* ─── GITHUB INTEGRATION ─── */}
          <section id="github" style={{ opacity: isVisible("github") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={GitCompare} title="GitHub Integration" />
            <div className="space-y-6 text-muted-foreground leading-7">
              <p>
                Connect your GitHub account to unlock powerful version control features for your MirrorSite projects. GitHub integration enables automatic code pushing and building from existing repositories.
              </p>

              <h3 className="text-lg font-semibold text-foreground">What is GitHub integration?</h3>
              <p>
                GitHub integration allows you to link your MirrorSite projects with your GitHub repositories. Once connected, you can:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Auto-push to GitHub</strong> — Automatically push your built application code to a GitHub repository after each successful build</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Build from existing repos</strong> — Use an existing GitHub repository as the source for AI analysis and application generation</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Version control</strong> — Track all changes to your project code with full git history</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-1 shrink-0" /> <span><strong className="text-foreground">Team collaboration</strong> — Share your code with team members or contributors through GitHub</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">How to connect GitHub</h3>
              <p><strong className="text-foreground">Step 1: Connect your GitHub account</strong></p>
              <ul className="space-y-2">
                <li>• Go to <strong className="text-foreground">Settings → Profile</strong></li>
                <li>• Scroll to the <strong className="text-foreground">Connected Services</strong> section</li>
                <li>• Click <strong className="text-foreground">Connect GitHub</strong></li>
                <li>• Sign in with your GitHub account and authorize MirrorSite AI</li>
              </ul>

              <p className="mt-6"><strong className="text-foreground">Step 2: Enable integration for a project</strong></p>
              <ul className="space-y-2">
                <li>• Open any project workspace</li>
                <li>• Click the <strong className="text-foreground">GitHub</strong> button in the top action bar</li>
                <li>• Choose your integration mode (see below)</li>
                <li>• Select or create a repository</li>
                <li>• Click <strong className="text-foreground">Connect</strong></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">Integration modes</h3>

              <div className="rounded-lg border border-border bg-card p-5 mt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">📤 Push to GitHub (Auto-push mode)</h4>
                <p className="text-sm">
                  Automatically push your built application code to a GitHub repository after each successful build. Perfect for:
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Backing up your code</li>
                  <li>• Tracking changes over time</li>
                  <li>• Deploying to external hosting (Vercel, Netlify, etc.)</li>
                  <li>• Sharing with team members</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 mt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">📖 Build from repo (Source mode)</h4>
                <p className="text-sm">
                  Use an existing GitHub repository as the starting point for AI analysis. The AI will:
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Read your README and code files</li>
                  <li>• Analyze your application structure</li>
                  <li>• Generate a specification based on your existing codebase</li>
                  <li>• Build or enhance the application</li>
                </ul>
                <p className="mt-3 text-sm">
                  Great for migrating existing projects or building on top of starter templates.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-foreground mt-8">Managing your repositories</h3>
              <p>
                When connecting GitHub, you can:
              </p>
              <ul className="space-y-2">
                <li>• Select from your existing GitHub repositories</li>
                <li>• Create new repositories directly from MirrorSite</li>
                <li>• Choose which branch to push to (default: main)</li>
                <li>• View push history and commit links</li>
                <li>• Disconnect at any time</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-8">Benefits of GitHub integration</h3>
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                  <p className="font-semibold text-sm text-green-600 dark:text-green-400 mb-2">✓ Version History</p>
                  <p className="text-xs text-muted-foreground">Track every change with full git commit history</p>
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">✓ Collaboration</p>
                  <p className="text-xs text-muted-foreground">Share code with team members effortlessly</p>
                </div>
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                  <p className="font-semibold text-sm text-purple-600 dark:text-purple-400 mb-2">✓ Backup & Safety</p>
                  <p className="text-xs text-muted-foreground">Your code is safely stored on GitHub</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="font-semibold text-sm text-amber-600 dark:text-amber-400 mb-2">✓ External Deployment</p>
                  <p className="text-xs text-muted-foreground">Deploy to Vercel, Netlify, or any git-based host</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground mt-8">Frequently asked questions</h3>
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-semibold text-foreground text-sm">Do I need a GitHub account?</p>
                  <p className="text-sm mt-1">Yes. You need a free GitHub account to use this feature. Sign up at <a href="https://github.com/signup" target="_blank" rel="noreferrer" className="text-primary hover:underline">github.com/signup</a></p>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Can I use private repositories?</p>
                  <p className="text-sm mt-1">Yes. MirrorSite AI supports both public and private repositories. Your code remains private if your repository is private.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">What happens if I disconnect?</p>
                  <p className="text-sm mt-1">Disconnecting stops future auto-pushes but doesn't delete any code already in your GitHub repository. Your git history remains intact.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Can I connect multiple projects to the same repo?</p>
                  <p className="text-sm mt-1">Yes, but we recommend using different repositories or branches for each project to avoid conflicts.</p>
                </div>
              </div>
            </div>
            <SectionFeedbackInline sectionId="github" />
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" style={{ opacity: isVisible("faq") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={HelpCircle} title="Frequently Asked Questions" />
            <div className="space-y-6 text-muted-foreground leading-7">
              {[
                {
                  q: "Do I need to know how to code?",
                  a: "No. MirrorSite AI handles all the technical work. You describe what you want, review the plan, and click build. If you do know how to code, you can also edit the generated code directly.",
                },
                {
                  q: "What kind of applications can MirrorSite AI build?",
                  a: "MirrorSite AI can build a wide range of web applications — dashboards, marketplaces, portfolios, admin panels, booking systems, content platforms, and more. If it has a user interface and stores data, MirrorSite AI can build it.",
                },
                {
                  q: "Can I edit the application after it's built?",
                  a: "Yes. You can edit the source code directly, or use the instruction bar to describe changes in plain language. MirrorSite AI will implement them for you.",
                },
                {
                  q: "How long does it take to build an application?",
                  a: "Most applications are built within a few minutes. The analysis and planning stage takes 30-60 seconds, and the build itself usually takes 1-3 minutes depending on complexity.",
                },
                {
                  q: "Can I connect my own domain name?",
                  a: "Yes. After publishing, you can connect any domain you own. MirrorSite AI provides step-by-step instructions for updating your domain settings.",
                },
                {
                  q: "Is my data secure?",
                  a: "Yes. MirrorSite AI uses industry-standard encryption for all data. Your account is protected with secure sessions, and your application data is stored in encrypted databases.",
                },
                {
                  q: "What happens if I run out of credits?",
                  a: "You can top up your credits at any time via Mobile Money. Your existing projects and applications remain accessible — you just need credits to build new ones or make changes.",
                },
                {
                  q: "Can I export my application?",
                  a: "Yes. You can view and download your application's source code from the workspace. The code is yours to use however you like.",
                },
                {
                  q: "Does MirrorSite AI work on mobile?",
                  a: "MirrorSite AI is designed for desktop use. The applications it builds are fully responsive and work great on mobile devices.",
                },
                {
                  q: "What is the difference between Website Mode and Idea Mode?",
                  a: "Website Mode starts from an existing website — MirrorSite AI analyzes it and builds something based on it. Idea Mode starts from a description — you tell MirrorSite AI what you want, and it creates a plan from scratch.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="rounded-lg border border-border bg-card p-5">
                  <h3 className="font-medium text-foreground">{q}</h3>
                  <p className="mt-2 text-sm leading-6">{a}</p>
                </div>
              ))}
            </div>
            <SectionFeedbackInline sectionId="faq" />
          </section>

          {/* ─── CTA ─── */}
          <section className="rounded-xl border border-border bg-card p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-center">Ready to build?</h2>
            <p className="mt-3 text-center text-muted-foreground">Start with 500 free credits. No credit card required.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className={buttonVariants({ size: "lg" }) + " inline-flex"}>
                Get started free <ArrowRight className="size-4 ml-1.5" />
              </Link>
              <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline" }) + " inline-flex"}>
                <DollarSign className="size-4 mr-1.5" /> View pricing
              </Link>
              <Link href="/modes-comparison" className={buttonVariants({ size: "lg", variant: "outline" }) + " inline-flex"}>
                <GitCompare className="size-4 mr-1.5" /> Compare modes
              </Link>
            </div>

            <div className="mt-8 grid gap-2 sm:grid-cols-3 border-t border-border pt-6">
              {[
                { href: "/dashboard", icon: Rocket, label: "Go to dashboard" },
                { href: "/billing", icon: CreditCard, label: "Manage billing" },
                { href: "/referrals", icon: Users, label: "Refer & earn credits" },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
          </section>

        </div>
      </div>

      <SiteFooter activePage="/docs" />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

// ─── Scroll-spy sidebar navigation ─────────────────────────────────────────

/**
 * Sidebar nav that highlights whichever section is currently in the viewport
 * using IntersectionObserver. The active item gets a left accent bar and bold
 * text so it visually pops from the rest.
 */
function ScrollSpyNav({
  sectionIds,
  visibleIds,
}: {
  sectionIds: string[]
  visibleIds: string[]
}) {
  const [activeId, setActiveId] = useState("")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current?.disconnect()

    const callbacks = new Map<string, IntersectionObserverCallback>()
    for (const id of sectionIds) {
      callbacks.set(id, ([entry]) => {
        if (entry?.isIntersecting) setActiveId(id)
      })
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = callbacks.get(entry.target.id)
          if (cb) cb([entry] as IntersectionObserverEntry[], observerRef.current!)
        }
      },
      {
        // Trigger when the section header enters the top 20% of the viewport
        rootMargin: "-15% 0px -70% 0px",
        threshold: 0,
      },
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [sectionIds])

  const metaMap = Object.fromEntries(sectionMeta.map((s) => [s.id, s]))

  return (
    <nav className="sticky top-24 space-y-1">
      <DocsSearch sections={sectionMeta} onFilter={() => { }} />
      {sectionIds.map((id) => {
        const meta = metaMap[id]
        if (!meta) return null
        const Icon = meta.icon
        const isActive = id === activeId
        const isVisible = visibleIds.includes(id)

        return (
          <a
            key={id}
            href={`#${id}`}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${isActive
              ? "bg-primary/5 text-foreground font-medium border-l-2 border-primary pl-4"
              : isVisible
                ? "text-muted-foreground hover:bg-accent/50 hover:text-foreground border-l-2 border-transparent"
                : "text-muted-foreground/30 border-l-2 border-transparent"
              }`}
          >
            <Icon className="size-4 shrink-0" />
            {meta.label}
          </a>
        )
      })}
    </nav>
  )
}

// ─── Feedback widget ───────────────────────────────────────────────────────

/**
 * Inline feedback widget — persists votes to the database and shows
 * aggregate counts. Uses a browser fingerprint as visitor ID so each
 * visitor can change their vote per section.
 */
function SectionFeedbackInline({ sectionId }: { sectionId: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null)
  const [stats, setStats] = useState<{ up: number; down: number } | null>(null)
  const [sending, setSending] = useState(false)

  const handleVote = async (v: "up" | "down") => {
    if (sending) return
    setSending(true)
    setVote(v)

    try {
      // Generate a stable visitor ID from browser fingerprint
      const visitorId = getVisitorId()
      const res = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, vote: v, visitorId }),
      })
      const json = await res.json()
      if (json.ok && json.data?.stats) {
        setStats(json.data.stats)
      }
    } catch {
      // Silently fail — feedback is best-effort
    }
  }

  if (vote) {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 shrink-0 text-primary" />
        <span>
          {vote === "up"
            ? "Glad this helped! Thanks for the feedback."
            : "Sorry to hear that. We'll work on improving this section."}
        </span>
        {stats && (
          <span className="ml-auto text-xs text-muted-foreground/60">
            {stats.up + stats.down} {stats.up + stats.down === 1 ? "vote" : "votes"}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="mt-8 flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
      <span>Was this section helpful?</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleVote("up")}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
          aria-label="Yes, this was helpful"
        >
          👍 Yes
        </button>
        <button
          onClick={() => handleVote("down")}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-border hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
          aria-label="No, this was not helpful"
        >
          👎 No
        </button>
      </div>
    </div>
  )
}

/**
 * Generate a stable visitor ID from browser signals. Stored in localStorage
 * so it persists across page loads but isn't tied to a real identity.
 */
function getVisitorId(): string {
  const STORAGE_KEY = "ms_feedback_visitor"
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    // Generate a random ID
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
    return `fallback-${Date.now()}`
  }
}
