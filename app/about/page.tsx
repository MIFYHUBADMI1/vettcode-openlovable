import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Code2,
  Compass,
  Database,
  Globe,
  Globe2,
  Layers3,
  Lightbulb,
  Rocket,
  Shield,
  Zap,
  Server,
  HardDrive,
  BarChart3,
  Users,
  Briefcase,
  Eye,
  Brain,
  Clock,
  GitBranch,
  TerminalSquare,
  ArrowDown,
  Building2,
  ShieldCheck,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

/* ═══════════════════════════════════════════════════════════════
   SEO METADATA
   ═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "About MirrorSite AI | The Quickest Way to a Working MVP",
  description:
    "Learn how MirrorSite AI helps founders, developers and designers turn ideas and existing web experiences into working full-stack MVPs using AI-powered application planning, generation and infrastructure.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "en_UG",
    url: "https://mirrorsiteai.vercel.app/about",
    siteName: "MirrorSite AI",
    title: "About MirrorSite AI | The Quickest Way to a Working MVP",
    description:
      "MirrorSite AI helps founders, developers and designers turn ideas and existing web experiences into working full-stack MVPs using AI-powered application planning, generation and infrastructure.",
    images: [{ url: "/hero/og-image.png", width: 1200, height: 630, alt: "About MirrorSite AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About MirrorSite AI | The Quickest Way to a Working MVP",
    description:
      "MirrorSite AI helps founders, developers and designers turn ideas into working full-stack MVPs.",
    images: ["/hero/after-landing.png"],
  },
}

/* ═══════════════════════════════════════════════════════════════
   STRUCTURED DATA
   ═══════════════════════════════════════════════════════════════ */

const aboutPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "About MirrorSite AI",
  description:
    "Learn how MirrorSite AI helps founders, developers and designers turn ideas and existing web experiences into working full-stack MVPs.",
  url: "https://mirrorsiteai.vercel.app/about",
  isPartOf: {
    "@type": "WebSite",
    name: "MirrorSite AI",
    url: "https://mirrorsiteai.vercel.app",
  },
  about: {
    "@type": "SoftwareApplication",
    name: "MirrorSite AI",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description:
      "AI-powered application development platform designed to dramatically reduce the time between an idea and a working full-stack MVP.",
  },
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is MirrorSite AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite AI is an AI-powered application development platform designed to dramatically reduce the time between an idea and a working full-stack MVP. It analyzes a starting point — an idea, a product concept, or an existing website — structures what needs to be built, and generates a complete application foundation including frontend, backend, authentication, database, and infrastructure.",
      },
    },
    {
      "@type": "Question",
      name: "What does MirrorSite AI build?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite AI generates working full-stack application foundations that include routes, components, authentication, database infrastructure, API layers, user management, storage, deployment configuration, and the application logic required by the product.",
      },
    },
    {
      "@type": "Question",
      name: "Is MirrorSite AI a website cloning tool?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Website analysis is one capability within MirrorSite AI. The larger product is an AI-powered application development platform. Users can start from an idea, a product concept, or an existing website. The platform understands the starting point, structures what needs to be built, and generates a working full-stack application foundation.",
      },
    },
    {
      "@type": "Question",
      name: "Can MirrorSite AI build a full-stack MVP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI is designed to generate working full-stack application foundations that include authentication, database, backend, frontend, APIs, storage, and deployment configuration — everything needed to reach a testable MVP.",
      },
    },
    {
      "@type": "Question",
      name: "Can I start with an idea instead of a website?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI can start from a plain idea or product description. You describe what you want to build, and the system transforms that high-level intent into structured application requirements — pages, user roles, workflows, data models, authentication, and infrastructure — then generates the application.",
      },
    },
    {
      "@type": "Question",
      name: "Can I provide an existing website as a reference?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can provide a URL to a website you own or have permission to analyze. MirrorSite AI analyzes page structure, layout, navigation, components, visual patterns, interactions, and functionality to create structured development context for building an application.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite create authentication?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI generates authentication flows including registration, login, email verification, sessions, and account-aware experiences as part of the full-stack application foundation.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite create databases?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI generates database infrastructure including data models, relationships, and the backend operations that make the application functional beyond a static interface.",
      },
    },
    {
      "@type": "Question",
      name: "Can developers customize the generated application?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The generated application is a starting point you own. Developers can edit, extend, and iterate on the code, add features, modify the architecture, and deploy changes using their preferred development workflow.",
      },
    },
    {
      "@type": "Question",
      name: "Is MirrorSite AI designed for founders?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI is designed to help founders reach a working MVP faster so they can focus on validating their market, speaking to customers, building a brand, and growing their business — while the platform handles the application-building foundation.",
      },
    },
    {
      "@type": "Question",
      name: "Is MirrorSite AI designed for developers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI gives developers leverage — faster prototyping, reduced repetitive work, rapid MVP development, and structured starting points. It is designed to amplify developers, not replace their workflow.",
      },
    },
    {
      "@type": "Question",
      name: "What is ATAI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ATAI — Advanced Technologies and AI Enterprises — is the company behind MirrorSite AI. ATAI focuses on building practical AI-powered technology that transforms complex technical workflows into accessible, automated experiences.",
      },
    },
    {
      "@type": "Question",
      name: "Is MirrorSite AI currently in early access?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The current hosted version of MirrorSite AI represents an early-access stage of the platform. This gives the team real-world feedback, product validation, and the opportunity to continuously improve the system.",
      },
    },
    {
      "@type": "Question",
      name: "How does MirrorSite differ from AI coding tools?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Many AI coding tools generate isolated pieces of code based on individual prompts. MirrorSite AI is designed to understand the full application context — planning and structuring the project before generation — so the output is a more complete application foundation rather than disconnected code fragments.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite replace developers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MirrorSite AI is designed to give developers leverage. It handles repetitive scaffolding and boilerplate so developers can focus on product decisions, architecture, and the work that requires human judgment.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use a website I do not own?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Users are responsible for ensuring that the websites, content, designs, trademarks, code, data and other materials they analyze or reproduce are used lawfully and with appropriate authorization. MirrorSite AI is a development and prototyping tool, not a license to reproduce copyrighted material.",
      },
    },
  ],
}

/* ═══════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════ */

const fivePrinciples = [
  {
    icon: Clock,
    title: "Speed",
    copy: "Reduce the time between an idea and a usable application.",
  },
  {
    icon: Layers3,
    title: "Completeness",
    copy: "Go beyond generating an attractive interface. Build toward a complete application foundation with the functionality required by the product.",
  },
  {
    icon: Zap,
    title: "Autonomy",
    copy: "Minimize unnecessary back-and-forth and allow the system to execute as much of the application-building workflow as possible from the original intent.",
  },
  {
    icon: Brain,
    title: "Intelligence",
    copy: "Combine advanced AI capabilities with structured project understanding so the system can reason about what needs to be built before generating it.",
  },
  {
    icon: Rocket,
    title: "Leverage",
    copy: "Give founders, developers and designers more time to focus on product decisions, customers, marketing, strategy and growth.",
  },
]

const fullStackCapabilities = [
  { icon: Globe2, title: "Frontend", copy: "Routes, components, layouts, responsive design, and meaningful application states." },
  { icon: Server, title: "Backend", copy: "API layers, server logic, and the operations that make the interface more than a static screen." },
  { icon: Shield, title: "Authentication", copy: "Registration, login, email verification, sessions, and account-aware experiences." },
  { icon: Database, title: "Database", copy: "Structured data, models, relationships, and the persistence layer your product needs." },
  { icon: Users, title: "User Management", copy: "Accounts, roles, and application-level user functionality built into the foundation." },
  { icon: HardDrive, title: "Storage", copy: "Application assets and file management within your project's infrastructure." },
  { icon: BarChart3, title: "Infrastructure", copy: "Deployment configuration, usage monitoring, and the backend services your application depends on." },
  { icon: Globe, title: "Domains", copy: "Support for free subdomains and custom domain connections." },
]

const faqItems = [
  { q: "What is MirrorSite AI?", a: "MirrorSite AI is an AI-powered application development platform designed to dramatically reduce the time between an idea and a working full-stack MVP. It analyzes a starting point — an idea, a product concept, or an existing website — structures what needs to be built, and generates a complete application foundation including frontend, backend, authentication, database, and infrastructure." },
  { q: "What does MirrorSite AI build?", a: "MirrorSite AI generates working full-stack application foundations that include routes, components, authentication, database infrastructure, API layers, user management, storage, deployment configuration, and the application logic required by the product." },
  { q: "Is MirrorSite AI a website cloning tool?", a: "Website analysis is one capability within MirrorSite AI. The larger product is an AI-powered application development platform. Users can start from an idea, a product concept, or an existing website. The platform understands the starting point, structures what needs to be built, and generates a working full-stack application foundation." },
  { q: "Can MirrorSite AI build a full-stack MVP?", a: "Yes. MirrorSite AI is designed to generate working full-stack application foundations that include authentication, database, backend, frontend, APIs, storage, and deployment configuration — everything needed to reach a testable MVP." },
  { q: "Can I start with an idea instead of a website?", a: "Yes. MirrorSite AI can start from a plain idea or product description. You describe what you want to build, and the system transforms that high-level intent into structured application requirements — pages, user roles, workflows, data models, authentication, and infrastructure — then generates the application." },
  { q: "Can I provide an existing website as a reference?", a: "Yes. You can provide a URL to a website you own or have permission to analyze. MirrorSite AI analyzes page structure, layout, navigation, components, visual patterns, interactions, and functionality to create structured development context for building an application." },
  { q: "Does MirrorSite create authentication?", a: "Yes. MirrorSite AI generates authentication flows including registration, login, email verification, sessions, and account-aware experiences as part of the full-stack application foundation." },
  { q: "Does MirrorSite create databases?", a: "Yes. MirrorSite AI generates database infrastructure including data models, relationships, and the backend operations that make the application functional beyond a static interface." },
  { q: "Can developers customize the generated application?", a: "Yes. The generated application is a starting point you own. Developers can edit, extend, and iterate on the code, add features, modify the architecture, and deploy changes using their preferred development workflow." },
  { q: "Is MirrorSite AI designed for founders?", a: "Yes. MirrorSite AI is designed to help founders reach a working MVP faster so they can focus on validating their market, speaking to customers, building a brand, and growing their business — while the platform handles the application-building foundation." },
  { q: "Is MirrorSite AI designed for developers?", a: "Yes. MirrorSite AI gives developers leverage — faster prototyping, reduced repetitive work, rapid MVP development, and structured starting points. It is designed to amplify developers, not replace their workflow." },
  { q: "What is ATAI?", a: "ATAI — Advanced Technologies and AI Enterprises — is the company behind MirrorSite AI. ATAI focuses on building practical AI-powered technology that transforms complex technical workflows into accessible, automated experiences." },
  { q: "Is MirrorSite AI currently in early access?", a: "Yes. The current hosted version of MirrorSite AI represents an early-access stage of the platform. This gives the team real-world feedback, product validation, and the opportunity to continuously improve the system." },
  { q: "How does MirrorSite differ from AI coding tools?", a: "Many AI coding tools generate isolated pieces of code based on individual prompts. MirrorSite AI is designed to understand the full application context — planning and structuring the project before generation — so the output is a more complete application foundation rather than disconnected code fragments." },
  { q: "Does MirrorSite replace developers?", a: "No. MirrorSite AI is designed to give developers leverage. It handles repetitive scaffolding and boilerplate so developers can focus on product decisions, architecture, and the work that requires human judgment." },
  { q: "Can I use a website I do not own?", a: "Users are responsible for ensuring that the websites, content, designs, trademarks, code, data and other materials they analyze or reproduce are used lawfully and with appropriate authorization. MirrorSite AI is a development and prototyping tool, not a license to reproduce copyrighted material." },
]

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />

      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">M</span>
            <span>mirrorsite<span className="text-primary">.ai</span></span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
            <Link href="/about" className="text-foreground transition-colors hover:text-primary">About</Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
            <Link href="/resources" className="transition-colors hover:text-foreground">Resources</Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Start building <ArrowRight className="size-4" /></Link>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/register" className={buttonVariants({ size: "sm" })}>Start</Link>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════
           HERO
           ═══════════════════════════════════════════════════════ */}
        <section className="hero-glass-section relative mx-auto w-full max-w-7xl px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md px-3 py-1.5 font-mono text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              <span>About MirrorSite AI</span>
            </div>
            <h1 className="hero-title text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-7xl">
              The quickest way to a working <span className="word-reveal text-primary">MVP</span>.
            </h1>
            <p className="hero-copy mt-7 max-w-2xl mx-auto text-pretty text-lg leading-8 text-muted-foreground">
              MirrorSite AI is an AI-powered application development platform designed to dramatically reduce the distance between an idea and a working full-stack MVP.
            </p>
            <p className="mt-5 max-w-2xl mx-auto text-pretty text-base leading-7 text-muted-foreground">
              Start with an idea, a product concept, or an existing website. MirrorSite analyzes the starting point, structures what needs to be built, and helps turn that understanding into a complete application foundation — so you can spend less time fighting the blank canvas and more time building the product that matters.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/register" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>Start Building <ArrowRight className="size-4" /></Link>
              <a href="#how-it-works" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-6"}>See How It Works</a>
            </div>

            {/* Micro-messaging */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" /> AI-powered development</span>
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" /> Full-stack generation</span>
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" /> Structured planning</span>
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" /> Managed infrastructure</span>
            </div>
          </div>

          {/* Hero Visual — Workflow Diagram */}
          <div className="mx-auto mt-16 max-w-2xl">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/60 p-8 backdrop-blur-sm sm:flex-row sm:justify-between sm:gap-4">
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Lightbulb className="size-5 text-primary" /></div>
                <span className="font-mono text-xs text-muted-foreground">Idea</span>
              </div>
              <ArrowDown className="size-4 text-muted-foreground sm:rotate-0 rotate-90" />
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Eye className="size-5 text-primary" /></div>
                <span className="font-mono text-xs text-muted-foreground">Understand</span>
              </div>
              <ArrowDown className="size-4 text-muted-foreground sm:rotate-0 rotate-90" />
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Layers3 className="size-5 text-primary" /></div>
                <span className="font-mono text-xs text-muted-foreground">Structure</span>
              </div>
              <ArrowDown className="size-4 text-muted-foreground sm:rotate-0 rotate-90" />
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Code2 className="size-5 text-primary" /></div>
                <span className="font-mono text-xs text-muted-foreground">Build</span>
              </div>
              <ArrowDown className="size-4 text-muted-foreground sm:rotate-0 rotate-90" />
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Rocket className="size-5 text-primary" /></div>
                <span className="font-mono text-xs text-muted-foreground">MVP</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           WHY MIRRORSITE EXISTS
           ═══════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="border-y border-border bg-card/40">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.7fr_1.3fr] lg:px-10">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Why we built it</p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Why we built MirrorSite AI
              </h2>
            </div>
            <div className="space-y-6 text-muted-foreground">
              <p className="text-lg leading-8">
                AI has made generating code dramatically faster. But generating code quickly is not the same thing as producing a working product quickly.
              </p>
              <p className="leading-7">
                Traditional application development often requires product planning, project setup, UI design, frontend and backend development, authentication, database setup, user management, API integration, infrastructure configuration, debugging, testing, deployment, and iteration.
              </p>
              <p className="leading-7">
                AI coding tools can reduce parts of this process, but users can still end up trapped in a cycle of generate, debug, regenerate, fix, prompt again, test, and discover another issue.
              </p>
              <p className="text-lg font-medium text-foreground">
                The goal isn&apos;t simply to generate more code. The goal is to get to something usable faster.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           14× PRINCIPLE
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <div className="inline-block">
                <span className="text-8xl font-bold tracking-tighter text-primary sm:text-9xl">14×</span>
              </div>
              <p className="mt-4 font-mono text-sm uppercase tracking-[0.15em] text-muted-foreground">
                Our development-speed principle
              </p>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Built to compress development time.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                MirrorSite is designed around the principle that AI should remove repetitive implementation work and allow developers and founders to move dramatically faster.
              </p>
              <p className="mt-4 leading-7 text-muted-foreground">
                Our internal product philosophy targets workflows that can be up to 14× faster than conventional implementation for applicable tasks. Actual results vary depending on project complexity, requirements, integrations, and configuration.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FIVE PRINCIPLES
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
            <div className="text-center mb-12">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Our philosophy</p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Five principles behind MirrorSite AI
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fivePrinciples.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FROM IDEA TO MVP (CORE IDEA)
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1fr] lg:px-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The core idea</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              From idea to working MVP.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              A founder should be able to describe what they want to build without first having to understand every technical implementation detail. A developer should be able to explore a product concept without spending hours creating repetitive scaffolding. A designer should be able to move from an experience or reference to something functional.
            </p>
            <p className="mt-4 max-w-lg leading-7 text-muted-foreground">
              MirrorSite is designed to act as a working foundation layer between the idea and the finished product.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-full max-w-sm space-y-3">
              {[
                { label: "Your Idea", icon: Lightbulb },
                { label: "MirrorSite Understands It", icon: Eye },
                { label: "Structured Project Context", icon: Layers3 },
                { label: "Application Plan", icon: GitBranch },
                { label: "Full-Stack Generation", icon: Code2 },
                { label: "Working MVP", icon: Rocket },
              ].map(({ label, icon: Icon }, i) => (
                <div key={label} className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-3.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  {i < 5 && <span className="ml-auto text-muted-foreground"><ArrowDown className="size-3 rotate-[-90deg]" /></span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           NOT JUST CODE GENERATION
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
            <div className="text-center mb-12">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Beyond generation</p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Generating code is only the beginning.
              </h2>
              <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-muted-foreground">
                Many AI coding workflows can require repeated user intervention as projects become more complex. MirrorSite is designed to reduce that intervention by understanding the application more comprehensively before and during generation.
              </p>
            </div>
            <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4">Fragmented AI generation</p>
                <div className="space-y-2 font-mono text-sm">
                  {["Prompt", "Generate", "Review", "Fix", "Prompt again", "Debug", "Repeat"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                      <span>{step}</span>
                      {i < 6 && <ArrowDown className="size-3 ml-1 text-muted-foreground/30" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-card p-6">
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-primary mb-4">MirrorSite approach</p>
                <div className="space-y-2 font-mono text-sm">
                  {["Intent", "Understand", "Structure", "Plan", "Build", "Validate", "Working MVP"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span className={i === 6 ? "text-primary font-medium" : ""}>{step}</span>
                      {i < 6 && <ArrowDown className="size-3 ml-1 text-primary/30" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           START WITH AN IDEA
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1fr] lg:px-10">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">From an idea</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              You don&apos;t need an existing website.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              MirrorSite can start from an idea or product description. Describe what you want to build, and the system transforms that high-level intent into structured application requirements.
            </p>
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-sm text-muted-foreground italic">
                &quot;Build a marketplace where local businesses can create profiles, publish products, manage orders and receive payments.&quot;
              </p>
            </div>
            <p className="mt-5 leading-7 text-muted-foreground">
              From that description, MirrorSite can generate structured requirements for pages, user roles, workflows, data models, authentication, application logic, and infrastructure.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-full max-w-sm space-y-3">
              {["Idea", "Requirements", "Project Structure", "Application", "MVP"].map((step, i) => (
                <div key={step} className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-3.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">{i + 1}</span>
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           START WITH A WEBSITE
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1fr] lg:px-10">
            <div className="order-2 lg:order-1 flex items-center justify-center">
              <div className="w-full max-w-sm space-y-3">
                {[
                  { label: "Website", icon: Globe },
                  { label: "Analyze", icon: Eye },
                  { label: "Understand", icon: Brain },
                  { label: "Structure", icon: Layers3 },
                  { label: "Build", icon: Code2 },
                ].map(({ label, icon: Icon }, i) => (
                  <div key={label} className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-3.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{label}</span>
                    {i < 4 && <span className="ml-auto text-muted-foreground"><ArrowDown className="size-3 rotate-[-90deg]" /></span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">From a reference</p>
              <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Already have a product to reference? Start there.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Website analysis is one of MirrorSite&apos;s capabilities. Provide a URL to a website you own or have permission to analyze, and MirrorSite can examine relevant aspects of the experience.
              </p>
              <ul className="mt-6 space-y-2">
                {["Page structure and layout", "Navigation and components", "Visual patterns and interactions", "Application flows and functionality", "Content structure and hierarchy"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="size-4 text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 leading-7 text-muted-foreground">
                The goal is not merely to reproduce pixels. The goal is to understand the product experience well enough to create structured development context for building an application.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FULL-STACK APPLICATIONS
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Full-stack generation</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Built around real applications, not static mockups.
            </h2>
            <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-muted-foreground">
              MirrorSite is designed to create application foundations that go beyond the interface — connecting frontend, backend, data, and infrastructure into a working product.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {fullStackCapabilities.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="capability-card group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="size-5 text-primary" />
                </div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           INFRASTRUCTURE BEHIND MIRRORSITE
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
            <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The platform</p>
                <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  More than an AI prompt box.
                </h2>
                <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                  MirrorSite is backed by an application infrastructure layer designed to connect AI reasoning with practical application development.
                </p>
                <p className="mt-4 leading-7 text-muted-foreground">
                  The AI model is only one part of the system. The infrastructure around the AI is what turns intelligence into an application-building workflow.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-8">
                <div className="text-center mb-6">
                  <span className="font-mono text-sm font-medium text-primary">MIRRORSITE AI</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="font-mono text-xs font-medium text-primary mb-3">AI Engine</p>
                    <div className="space-y-1.5">
                      {["Reasoning", "Generation", "Analysis", "Validation"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-1 rounded-full bg-primary" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="font-mono text-xs font-medium text-primary mb-3">Project Layer</p>
                    <div className="space-y-1.5">
                      {["Planning", "Context", "Structure", "Management"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-1 rounded-full bg-primary" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="font-mono text-xs font-medium text-primary mb-3">Infrastructure</p>
                    <div className="space-y-1.5">
                      {["Database", "Auth", "Storage", "Deployment"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-1 rounded-full bg-primary" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
                    <ArrowDown className="size-3 text-primary" />
                    <span className="font-mono text-xs font-medium text-primary">Working MVP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           ADVANCED AI
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">AI capabilities</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Powered by advanced AI capabilities.
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              MirrorSite is designed to use advanced AI reasoning and code-generation capabilities across different stages of the application-building process — from understanding requirements and interpreting website structure to planning applications and generating code.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {["Requirement analysis", "Website interpretation", "Project context creation", "Application planning", "Code generation", "Dependency reasoning", "Component production", "Validation support"].map((cap) => (
                <span key={cap} className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">{cap}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FOR FOUNDERS / DEVELOPERS / DESIGNERS
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-3">
              {/* Founders */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Briefcase className="size-5 text-primary" /></div>
                  <h2 className="text-2xl font-semibold tracking-tight">For founders</h2>
                </div>
                <p className="font-medium text-primary mb-3">Built for founders who need to move.</p>
                <p className="text-sm leading-6 text-muted-foreground mb-4">
                  When you&apos;re starting a company, writing code is only one part of the job. You also need to validate the market, speak to customers, build a brand, and find early users.
                </p>
                <p className="text-sm font-medium text-foreground mb-4">
                  While MirrorSite works on the foundation, you can work on the business.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="font-mono text-xs text-primary mb-2">MirrorSite</p>
                    {["Build", "Structure", "Generate", "Configure"].map((item) => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1 rounded-full bg-primary" />{item}</div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="font-mono text-xs text-muted-foreground mb-2">Founder</p>
                    {["Validate", "Market", "Sell", "Grow"].map((item) => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1 rounded-full bg-muted-foreground/30" />{item}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Developers */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><TerminalSquare className="size-5 text-primary" /></div>
                  <h2 className="text-2xl font-semibold tracking-tight">For developers</h2>
                </div>
                <p className="font-medium text-primary mb-3">A force multiplier for developers.</p>
                <p className="text-sm leading-6 text-muted-foreground mb-4">
                  MirrorSite is not positioned as &quot;developers are no longer needed.&quot; It is designed to give developers leverage — faster prototyping, reduced repetitive work, and rapid MVP development.
                </p>
                <p className="text-sm font-medium text-foreground mb-4">
                  AI should amplify developers, not simply replace their workflow.
                </p>
                <ul className="space-y-2">
                  {["Faster prototyping", "Application scaffolding", "Reduced boilerplate", "Rapid MVP development", "Structured starting points"].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 text-primary mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Designers */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Compass className="size-5 text-primary" /></div>
                  <h2 className="text-2xl font-semibold tracking-tight">For designers</h2>
                </div>
                <p className="font-medium text-primary mb-3">From experience to functionality.</p>
                <p className="text-sm leading-6 text-muted-foreground mb-4">
                  Designers can use the platform to move beyond static screens and explore functional product concepts — turning visual references into working applications.
                </p>
                <div className="space-y-2 font-mono text-xs">
                  {["Design / Reference", "Product Structure", "Functional Application", "Iterate"].map((step, i) => (
                    <div key={step} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           BUILT BY ATAI
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="size-7 text-primary" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The company</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built by ATAI
            </h2>
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              Advanced Technologies and AI Enterprises
            </p>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              MirrorSite AI is a product created and developed under ATAI — Advanced Technologies and AI Enterprises. ATAI focuses on building practical AI-powered technology that transforms complex technical workflows into accessible, automated experiences.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           PRODUCT EVOLUTION
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The evolution</p>
                <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  From website cloning to application creation.
                </h2>
                <p className="mt-6 text-lg leading-8 text-muted-foreground">
                  MirrorSite began around the idea of making it dramatically easier to reproduce and understand web experiences. That idea evolved.
                </p>
                <p className="mt-4 leading-7 text-muted-foreground">
                  The larger opportunity wasn&apos;t simply copying websites. It was reducing the amount of work required to transform an idea or existing experience into a working application.
                </p>
                <p className="mt-4 leading-7 text-muted-foreground">
                  Today, the vision is centered on building a platform that can take users much closer to a complete working MVP in a single automated workflow.
                </p>
              </div>
              <div className="space-y-3">
                {["Website Cloning", "Website Understanding", "Structured Project Context", "Application Planning", "Full-Stack Generation", "Working MVP Platform"].map((step, i) => (
                  <div key={step} className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-3.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">{i + 1}</span>
                    <span className="text-sm font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           EARLY ACCESS
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Current stage</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              We&apos;re building MirrorSite with real users.
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              The current hosted version of MirrorSite AI represents an early-access stage of the platform. It gives us an opportunity to put the product in front of real users, understand how people build with it, collect feedback, identify friction, and continuously improve the system.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {["Real-world feedback", "Product validation", "Performance testing", "Workflow improvement", "Usability testing", "Feature prioritization"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  <Check className="size-4 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           WHY THE MVP MATTERS
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Because the first version should teach you something.
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              A successful MVP is not necessarily the final product. Its purpose is to allow you to test assumptions, get feedback, validate workflows, understand users, and discover problems.
            </p>
            <p className="mt-4 text-lg font-medium text-foreground">
              The faster you can build something real, the faster you can learn whether it matters.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           RELIABILITY
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Engineering philosophy</p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Built around reliability.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                AI-generated applications can fail when the system only generates isolated pieces of a project without understanding how those pieces fit together.
              </p>
              <p className="mt-4 leading-7 text-muted-foreground">
                The objective is not to generate code faster and debug forever. The objective is to create a more complete understanding of the application before and during generation.
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Structured project understanding",
                "Planning before generation",
                "Complete application context",
                "Infrastructure awareness",
                "Dependency awareness",
                "Validation and testing",
                "Iterative improvement",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3.5">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           THE MIRRORSITE DIFFERENCE (COMPARISON)
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
            <div className="text-center mb-12">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The difference</p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                The difference is what happens after the prompt.
              </h2>
            </div>
            <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4">Traditional development</h3>
                <div className="space-y-2">
                  {["Blank project", "Manual setup", "Design", "Architecture", "Coding", "Integration", "Debugging", "Testing", "Deployment"].map((step) => (
                    <div key={step} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4">Fragmented AI generation</h3>
                <div className="space-y-2">
                  {["Prompt", "Generate", "Review", "Fix", "Prompt again", "Debug", "Repeat"].map((step) => (
                    <div key={step} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="size-1 rounded-full bg-muted-foreground/30" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-card p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-primary mb-4">MirrorSite vision</h3>
                <div className="space-y-2">
                  {["Idea / Reference", "Understand", "Structure", "Plan", "Build", "Validate", "Working MVP"].map((step) => (
                    <div key={step} className="flex items-center gap-2 text-sm">
                      <span className="size-1 rounded-full bg-primary" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           RESPONSIBLE USE
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Shield className="size-5 text-primary" /></div>
              <h2 className="text-2xl font-semibold tracking-tight">Build responsibly.</h2>
            </div>
            <p className="text-lg leading-8 text-muted-foreground">
              MirrorSite is a development and prototyping tool. Users are responsible for ensuring that the websites, content, designs, trademarks, code, data and other materials they analyze or reproduce are used lawfully and with appropriate authorization.
            </p>
            <p className="mt-4 leading-7 text-muted-foreground">
              This includes respecting copyright, trademarks, intellectual property, privacy, terms of service, permissions, and applicable laws.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/terms" className="text-sm text-primary hover:underline">Terms of Service</Link>
              <Link href="/privacy" className="text-sm text-primary hover:underline">Privacy Policy</Link>
              <Link href="/database-terms" className="text-sm text-primary hover:underline">Database Terms</Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           THE FUTURE
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The vision</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              We&apos;re building toward a world where the blank project disappears.
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              The future of software development should make it possible for people to begin with intent instead of infrastructure. Founders shouldn&apos;t need to spend days just reaching their first testable product. Developers shouldn&apos;t need to repeatedly solve the same boilerplate problems. Designers shouldn&apos;t have to stop at static screens when they want to explore functionality.
            </p>
            <p className="mt-6 text-xl font-medium text-foreground">
              Describe what you want to build. Start with something you can see. Let AI help turn it into something real.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FAQ
           ═══════════════════════════════════════════════════════ */}
        <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-24">
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Questions</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {faqItems.map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-border bg-card">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="ml-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </span>
                </summary>
                <div className="px-6 pb-5 text-sm leading-6 text-muted-foreground">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           FINAL CTA
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Have an idea? Build it.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The faster you can turn an idea into something real, the faster you can learn whether it matters.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/register" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>
                Start Building with MirrorSite AI <ArrowRight className="size-4" />
              </Link>
              <a href="#how-it-works" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-6"}>
                Explore How It Works
              </a>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <span className="font-mono text-xs">© 2026 MirrorSite AI</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/" className="hover:text-foreground">Home</Link>
              <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
              <Link href="/resources" className="hover:text-foreground">Resources</Link>
              <Link href="/about" className="text-foreground">About</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/login" className="hover:text-foreground">Sign in</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
