import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Shield,
  Database,
  Globe,
  CreditCard,
  Users,
  Mail,
  Server,
  Eye,
  Lock,
  Trash2,
  HelpCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Cookie,
  BarChart3,
  Cpu,
  Send,
  Key,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

/* ═══════════════════════════════════════════════════════════════
   SEO METADATA
   ═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "MirrorSite AI Privacy Policy | Data & Privacy",
  description:
    "Learn how MirrorSite AI collects, processes, stores and protects account, project, AI, website-analysis, billing and technical information when you use the platform.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    locale: "en_UG",
    url: "https://mirrorsiteai.vercel.app/privacy",
    siteName: "MirrorSite AI",
    title: "MirrorSite AI Privacy Policy | Data & Privacy",
    description:
      "Learn how MirrorSite AI collects, processes, stores and protects your information.",
    images: [{ url: "/hero/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Privacy Policy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI Privacy Policy | Data & Privacy",
    description: "Learn how MirrorSite AI collects, processes, stores and protects your information.",
    images: ["/hero/after-landing.png"],
  },
}

/* ═══════════════════════════════════════════════════════════════
   STRUCTURED DATA
   ═══════════════════════════════════════════════════════════════ */

const privacyPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MirrorSite AI Privacy Policy",
  description:
    "Learn how MirrorSite AI collects, processes, stores and protects account, project, AI, website-analysis, billing and technical information.",
  url: "https://mirrorsiteai.vercel.app/privacy",
  isPartOf: {
    "@type": "WebSite",
    name: "MirrorSite AI",
    url: "https://mirrorsiteai.vercel.app",
  },
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What information does MirrorSite AI collect?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite AI collects account information (name, email, authentication details), project information (ideas, prompts, URLs, generated code), payment information (transaction records via mobile money providers), technical information (IP address, browser type, device information), and usage data necessary to operate the service.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite store my projects?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite stores project information including your ideas, prompts, website references, generated specifications, application code, and project metadata. This information is stored to provide the service and maintain your project history.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite send my project information to AI providers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite may transmit project inputs (prompts, ideas, website analysis data, and project context) to third-party AI infrastructure providers when necessary to provide requested functionality such as application generation and analysis.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data used to train AI models?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite may rely on third-party AI providers to process information necessary to provide requested functionality. Whether those providers retain or use submitted information for model improvement may depend on the applicable provider's terms and configuration. MirrorSite does not independently use your data to train AI models.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite collect payment card information?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite does not directly collect or store credit card numbers. Payments are processed via mobile money providers (MTN and Airtel). MirrorSite receives transaction confirmation data (transaction ID, amount, status) from the payment verification process but not raw card details.",
      },
    },
    {
      "@type": "Question",
      name: "What happens when I submit a website URL?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When you submit a website URL, MirrorSite uses a third-party website analysis service to crawl and analyze publicly accessible content from that URL. The system extracts page structure, layout, navigation, content, and visual patterns to create structured development context for building an application.",
      },
    },
    {
      "@type": "Question",
      name: "Can I delete my account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can request account deletion through your account settings or by contacting support. Account deletion performs a soft-delete that removes your ability to log in and strips personally identifiable information from your account record. Some information may be retained where required by law, fraud prevention, or legitimate business records.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite use cookies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite uses essential cookies for authentication (session cookies) and security. The session cookie is httpOnly, secure, and has a 30-day expiry. MirrorSite also uses Vercel Analytics in production to understand usage patterns.",
      },
    },
    {
      "@type": "Question",
      name: "Is my information shared with third parties?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite shares information with service providers necessary to operate the service, including hosting providers, database services, AI processing providers, website analysis services, email delivery services, payment processors, and analytics services. Information may also be disclosed for legal compliance, safety, or to enforce terms of service.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite sell personal information?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MirrorSite does not sell personal information to third parties. Information is shared only with service providers necessary to operate the service or as described in this Privacy Policy.",
      },
    },
    {
      "@type": "Question",
      name: "How long does MirrorSite retain my information?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite retains information for as long as reasonably necessary to provide the service, maintain legitimate business records, comply with applicable legal requirements, resolve disputes, prevent abuse and enforce agreements. Session tokens expire after 30 days. Specific retention periods for other data categories may be finalized by legal counsel.",
      },
    },
    {
      "@type": "Question",
      name: "Who owns my project?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You retain ownership of the content you submit and the applications you create. MirrorSite processes your project information to provide the service but does not claim ownership of your personal information or project content.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite replace developers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MirrorSite AI is designed to give developers leverage by handling repetitive scaffolding and boilerplate. Users remain responsible for reviewing, customizing, and securing generated applications before production use.",
      },
    },
  ],
}

/* ═══════════════════════════════════════════════════════════════
   TABLE OF CONTENTS DATA
   ═══════════════════════════════════════════════════════════════ */

const tocSections = [
  { id: "about", label: "About This Privacy Policy" },
  { id: "who-we-are", label: "Who We Are" },
  { id: "info-collect", label: "Information We Collect" },
  { id: "info-provide", label: "Information You Provide" },
  { id: "project-ai", label: "Project, Prompt and AI Data" },
  { id: "website-analysis", label: "Website URLs and Analysis" },
  { id: "payment", label: "Payment and Billing" },
  { id: "referral", label: "Referral Information" },
  { id: "auto-collect", label: "Automatically Collected Information" },
  { id: "cookies", label: "Cookies" },
  { id: "how-use", label: "How We Use Information" },
  { id: "ai-processing", label: "AI Processing" },
  { id: "sharing", label: "How Information Is Shared" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "security", label: "Data Security" },
  { id: "retention", label: "Data Retention" },
  { id: "deletion", label: "Account and Data Deletion" },
  { id: "rights", label: "Your Privacy Rights" },
  { id: "children", label: "Children's Privacy" },
  { id: "international", label: "International Data Processing" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact" },
  { id: "faq", label: "Privacy FAQ" },
]

/* ═══════════════════════════════════════════════════════════════
   FAQ DATA
   ═══════════════════════════════════════════════════════════════ */

const faqItems = [
  {
    q: "What information does MirrorSite AI collect?",
    a: "MirrorSite AI collects account information (name, email, authentication details), project information (ideas, prompts, URLs, generated code), payment information (transaction records via mobile money providers), technical information (IP address, browser type, device information), and usage data necessary to operate the service.",
  },
  {
    q: "Does MirrorSite store my projects?",
    a: "Yes. MirrorSite stores project information including your ideas, prompts, website references, generated specifications, application code, and project metadata. This information is stored to provide the service and maintain your project history.",
  },
  {
    q: "Does MirrorSite process my prompts?",
    a: "Yes. Prompts and ideas you submit are processed to generate application plans, code, and project context. They may be transmitted to third-party AI providers for processing as described in this policy.",
  },
  {
    q: "Does MirrorSite send my project information to AI providers?",
    a: "Yes. MirrorSite may transmit project inputs (prompts, ideas, website analysis data, and project context) to third-party AI infrastructure providers when necessary to provide requested functionality such as application generation and analysis.",
  },
  {
    q: "Is my data used to train AI models?",
    a: "MirrorSite may rely on third-party AI providers to process information necessary to provide requested functionality. Whether those providers retain or use submitted information for model improvement may depend on the applicable provider's terms and configuration. MirrorSite does not independently use your data to train AI models.",
  },
  {
    q: "Does MirrorSite collect payment card information?",
    a: "No. MirrorSite does not directly collect or store credit card numbers. Payments are processed via mobile money providers (MTN and Airtel). MirrorSite receives transaction confirmation data from the payment verification process but not raw card details.",
  },
  {
    q: "What information does MirrorSite receive from payment providers?",
    a: "MirrorSite receives transaction confirmation data including transaction ID, amount, currency, payment status, payment reference, and timestamps. This information is used to verify payments and credit your account.",
  },
  {
    q: "What happens when I submit a website URL?",
    a: "When you submit a website URL, MirrorSite uses a third-party website analysis service to crawl and analyze publicly accessible content. The system extracts page structure, layout, navigation, content, and visual patterns to create structured development context for building an application.",
  },
  {
    q: "Can MirrorSite analyze private websites?",
    a: "No. MirrorSite analyzes publicly accessible website content. You should not submit URLs to private areas you are not authorized to access. Users are responsible for ensuring they have authorization to analyze the websites they submit.",
  },
  {
    q: "Who owns my project?",
    a: "You retain ownership of the content you submit and the applications you create. MirrorSite processes your project information to provide the service but does not claim ownership of your personal information or project content.",
  },
  {
    q: "How long does MirrorSite retain my information?",
    a: "MirrorSite retains information for as long as reasonably necessary to provide the service, maintain legitimate business records, comply with applicable legal requirements, resolve disputes, prevent abuse and enforce agreements. Session tokens expire after 30 days.",
  },
  {
    q: "Can I delete my account?",
    a: "Yes. You can request account deletion through your account settings or by contacting support. Account deletion performs a soft-delete that removes your ability to log in and strips personally identifiable information from your account record.",
  },
  {
    q: "Can I request deletion of my data?",
    a: "Yes. You may request access to, correction of, or deletion of your personal information by contacting MirrorSite support. Some information may be retained where required by law, fraud prevention, security, accounting, dispute resolution, or legitimate business records.",
  },
  {
    q: "Does MirrorSite use cookies?",
    a: "Yes. MirrorSite uses essential cookies for authentication (session cookies) and security. The session cookie is httpOnly, secure, and has a 30-day expiry. MirrorSite also uses Vercel Analytics in production.",
  },
  {
    q: "Does MirrorSite use analytics?",
    a: "Yes. MirrorSite uses Vercel Analytics in production to understand usage patterns and improve the service. Analytics data is collected in aggregate and does not personally identify individual users.",
  },
  {
    q: "Is my information shared with third parties?",
    a: "MirrorSite shares information with service providers necessary to operate the service, including hosting, database, AI processing, website analysis, email, payment, and analytics providers. Information may also be disclosed for legal compliance, safety, or to enforce terms of service.",
  },
  {
    q: "Does MirrorSite sell personal information?",
    a: "No. MirrorSite does not sell personal information to third parties. Information is shared only with service providers necessary to operate the service or as described in this Privacy Policy.",
  },
]

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(privacyPageStructuredData) }} />
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
            <Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
            <Link href="/about" className="transition-colors hover:text-foreground">About</Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Sign in</Link>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Sign in</Link>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════
           PAGE HEADER
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pt-12 pb-8 lg:px-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><Shield className="size-5 text-primary" /></div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Privacy</p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground max-w-2xl">
            This Privacy Policy explains how MirrorSite AI collects, uses, stores, protects and shares information when you use our services.
          </p>
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            Last Updated: September 1, 2026
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════
           PRIVACY AT A GLANCE
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pb-12 lg:px-10">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-lg font-semibold mb-3">Privacy at a Glance</h2>
            <p className="text-sm leading-6 text-muted-foreground mb-4">
              MirrorSite AI collects information needed to provide your account, process your projects, operate AI-powered application development features, process payments, maintain security, provide support, and improve the service.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We collect information you provide directly.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We collect some information automatically when you use the service.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We process project and prompt information to provide the requested functionality.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Third-party providers may process information when required to operate specific services.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We do not sell your personal information.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You remain responsible for ensuring you do not submit information you are not authorized to provide.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You should review this Policy together with the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.</li>
            </ul>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           TABLE OF CONTENTS
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pb-8 lg:px-10">
          <details open className="rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
              Table of Contents
              <span className="ml-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
            </summary>
            <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {tocSections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors py-0.5">
                  {s.label}
                </a>
              ))}
            </div>
          </details>
        </section>

        {/* ═══════════════════════════════════════════════════════
           CONTENT
           ═══════════════════════════════════════════════════════ */}
        <article className="mx-auto max-w-4xl px-6 pb-24 lg:px-10 prose-custom">

          {/* ── 1. About This Privacy Policy ── */}
          <section id="about" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> 1. About This Privacy Policy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                This Privacy Policy describes how MirrorSite AI handles information when users visit the website, create an account, use the platform, create projects, submit prompts, provide URLs, use AI features, purchase credits, participate in referrals, or contact support.
              </p>
              <p>
                The exact information processed depends on how you interact with the platform. Separate notices may apply to specific features where required.
              </p>
              <p>
                By using MirrorSite AI, you acknowledge that you have read and understood this Privacy Policy. We encourage you to review this Policy and the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> regularly.
              </p>
            </div>
          </section>

          {/* ── 2. Who We Are ── */}
          <section id="who-we-are" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Users className="size-5 text-primary" /> 2. Who We Are
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite AI is a product created and operated by ATAI — Advanced Technologies and AI Enterprises. ATAI focuses on building practical AI-powered technology that transforms complex technical workflows into accessible, automated experiences.
              </p>
              <p>
                [LEGAL ENTITY DETAILS TO BE CONFIRMED BY ATAI/LEGAL COUNSEL]
              </p>
            </div>
          </section>

          {/* ── 3. Information We Collect ── */}
          <section id="info-collect" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Eye className="size-5 text-primary" /> 3. Information We Collect
            </h2>
            <p className="text-base leading-7 text-muted-foreground mb-6">
              MirrorSite AI processes different categories of information depending on how you use the service:
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Key, title: "Account Information", items: ["Email address", "Name", "Authentication provider (password or Google)", "Google ID (if using Google sign-in)", "Profile image URL (if using Google sign-in)", "Email verification status", "Account status", "Referral code"] },
                { icon: Database, title: "Project Information", items: ["Project name and description", "Project mode (website or idea)", "Source URLs", "Ideas and prompts", "Project preferences", "Generated specifications", "Application code", "Build history"] },
                { icon: Cpu, title: "AI and Processing Data", items: ["Prompts and instructions", "Website analysis results", "Generated application plans", "Project understanding", "Conversation history", "Build summaries"] },
                { icon: CreditCard, title: "Transaction Information", items: ["Credit balance and history", "Top-up records", "Payment references", "Transaction status", "Package selections"] },
                { icon: Globe, title: "Website Analysis Data", items: ["Submitted URLs", "Crawled page content", "Page structure and navigation", "Screenshots", "Visual patterns", "Content structure"] },
                { icon: Server, title: "Technical Information", items: ["IP address", "Browser type and version", "Device type", "Operating system", "Session identifiers", "Timestamps"] },
              ].map(({ icon: Icon, title, items }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">{title}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="size-1 rounded-full bg-primary/40 mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── 4. Information You Provide ── */}
          <section id="info-provide" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Send className="size-5 text-primary" /> 4. Information You Provide
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                You voluntarily provide information when you:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Create an account (email, name, password)</li>
                <li>Complete your profile</li>
                <li>Submit prompts, ideas, or application requirements</li>
                <li>Provide website URLs for analysis</li>
                <li>Create and configure projects</li>
                <li>Upload files or assets</li>
                <li>Submit support requests or feedback</li>
                <li>Participate in the referral program</li>
                <li>Purchase credits</li>
              </ul>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm">
                  Please do not submit sensitive personal information into prompts, projects or uploads unless it is necessary and you are authorized to provide it.
                </p>
              </div>
            </div>
          </section>

          {/* ── 5. Project and AI Data ── */}
          <section id="project-ai" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Cpu className="size-5 text-primary" /> 5. Project, Prompt and AI Processing
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                Users may submit product ideas, prompts, application requirements, project information, website references, code, configuration, and other development-related content to MirrorSite AI.
              </p>
              <p>
                MirrorSite may process this information to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Understand the requested application</li>
                <li>Create structured project context</li>
                <li>Generate project plans and specifications</li>
                <li>Generate application code</li>
                <li>Create application components</li>
                <li>Provide development previews</li>
                <li>Configure supported infrastructure</li>
                <li>Perform requested AI functions</li>
                <li>Maintain project state and history</li>
              </ul>
              <p>
                Your prompts and project inputs may be transmitted to third-party AI infrastructure providers when necessary to provide the requested functionality. The specific providers and processing arrangements may change as the service evolves.
              </p>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium mb-1">AI Training</p>
                <p className="text-sm text-muted-foreground">
                  MirrorSite may rely on third-party AI providers to process information necessary to provide requested functionality. Whether those providers retain or use submitted information for model improvement may depend on the applicable provider&apos;s terms and configuration. MirrorSite does not independently use your data to train AI models.
                </p>
              </div>
            </div>
          </section>

          {/* ── 6. Website URLs and Analysis ── */}
          <section id="website-analysis" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Globe className="size-5 text-primary" /> 6. Website URLs and Website Analysis
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                When you submit a website URL, the following may occur:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>MirrorSite receives the URL you submitted.</li>
                <li>The system requests and analyzes publicly accessible website information as required by the requested feature.</li>
                <li>Relevant information may be processed to understand the website&apos;s structure, layout, navigation, content, and functionality.</li>
                <li>Structured information may be generated from the analysis.</li>
                <li>That information may be used to produce project context or application output.</li>
              </ol>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Important</p>
                  <p>Submitting a URL does not transfer ownership of the referenced website to MirrorSite or the user. Users should not submit URLs to private areas they are not authorized to access.</p>
                </div>
              </div>
              <p>
                Website analysis may encounter information that appears on publicly accessible webpages. Users should avoid using the platform to intentionally collect personal information from third-party websites without an appropriate legal basis or authorization.
              </p>
            </div>
          </section>

          {/* ── 7. Payment and Billing ── */}
          <section id="payment" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <CreditCard className="size-5 text-primary" /> 7. Payment and Billing Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite AI uses mobile money payment processing (MTN and Airtel) for credit purchases. Payment information is processed as follows:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You submit a payment confirmation screenshot for verification.</li>
                <li>An AI-powered analysis system extracts transaction details from the screenshot for verification purposes.</li>
                <li>MirrorSite receives transaction confirmation data including: transaction ID, amount, currency, payment status, payment reference, and timestamps.</li>
                <li>MirrorSite does not directly collect or store credit card numbers.</li>
              </ul>
              <p>
                Credit balances, usage information, and transaction history are associated with your account in order to provide the service and enforce applicable usage limits.
              </p>
            </div>
          </section>

          {/* ── 8. Referral Information ── */}
          <section id="referral" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Users className="size-5 text-primary" /> 8. Referral Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                If you participate in the referral program, the following information may be processed:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Referral code and referral relationships</li>
                <li>Referring account and referred account identifiers</li>
                <li>Qualifying events and verification status</li>
                <li>Reward credit issuance</li>
                <li>Anti-fraud signals and fraud detection flags</li>
              </ul>
              <p>
                Referral information is processed to attribute referrals, issue qualifying rewards, prevent fraud, and enforce referral program rules. We use the minimum data necessary for these purposes.
              </p>
            </div>
          </section>

          {/* ── 9. Automatically Collected Information ── */}
          <section id="auto-collect" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <BarChart3 className="size-5 text-primary" /> 9. Automatically Collected Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                When you use MirrorSite AI, certain information may be collected automatically, including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Device type and operating system</li>
                <li>Language and timezone settings</li>
                <li>Pages visited and navigation patterns</li>
                <li>Referrer information</li>
                <li>Timestamps of activity</li>
                <li>Session data</li>
                <li>Error and performance information</li>
              </ul>
              <p>
                This information is used for security, authentication, abuse prevention, analytics, debugging, performance monitoring, and service improvement.
              </p>
            </div>
          </section>

          {/* ── 10. Cookies ── */}
          <section id="cookies" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Cookie className="size-5 text-primary" /> 10. Cookies and Similar Technologies
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite AI uses the following types of cookies:
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Purpose</th>
                      <th className="px-4 py-3 text-left font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium">Session Cookie</td>
                      <td className="px-4 py-3">Authentication and security. Named <code className="text-xs bg-muted px-1 py-0.5 rounded">mirrorsite_session</code>. HttpOnly, secure, SameSite: lax.</td>
                      <td className="px-4 py-3">30 days</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium">Analytics</td>
                      <td className="px-4 py-3">Vercel Analytics (production only). Used to understand usage patterns in aggregate.</td>
                      <td className="px-4 py-3">Varies</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                The session cookie is essential for authentication and cannot be disabled while logged in. MirrorSite does not use marketing or advertising cookies.
              </p>
            </div>
          </section>

          {/* ── 11. How We Use Information ── */}
          <section id="how-use" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Lock className="size-5 text-primary" /> 11. How We Use Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>MirrorSite may use information to:</p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { title: "Provide the service", items: ["Authenticate accounts", "Create and manage projects", "Generate applications", "Process AI requests", "Provide infrastructure", "Process payments"] },
                  { title: "Improve the service", items: ["Understand product usage", "Improve workflows", "Identify bugs", "Improve performance", "Develop new features"] },
                  { title: "Maintain security", items: ["Detect abuse", "Prevent fraud", "Secure accounts", "Investigate suspicious activity", "Enforce rate limits"] },
                  { title: "Support users", items: ["Respond to requests", "Troubleshoot issues", "Communicate about service changes", "Send transactional emails"] },
                ].map(({ title, items }) => (
                  <div key={title} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-medium mb-2">{title}</p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="size-1 rounded-full bg-primary/40 mt-2 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 12. AI Processing ── */}
          <section id="ai-processing" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Cpu className="size-5 text-primary" /> 12. AI Processing
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite AI uses artificial intelligence capabilities across multiple stages of the application-building process. AI processing may involve:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Analyzing submitted prompts and ideas to understand requirements</li>
                <li>Interpreting website structure and content from submitted URLs</li>
                <li>Creating structured project context from analysis results</li>
                <li>Planning application architecture and components</li>
                <li>Generating application code and configuration</li>
                <li>Reasoning about dependencies and technical requirements</li>
                <li>Verifying payment screenshots for transaction confirmation</li>
              </ul>
              <p>
                MirrorSite may transmit certain project inputs to third-party AI infrastructure providers when necessary to provide requested functionality. The specific providers and processing arrangements may change as the service evolves.
              </p>
            </div>
          </section>

          {/* ── 13. How Information Is Shared ── */}
          <section id="sharing" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Globe className="size-5 text-primary" /> 13. How Information Is Shared
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Information may be shared with:</p>

              <h3 className="text-base font-medium text-foreground mt-6">Service Providers</h3>
              <p>Providers needed to operate the service, including hosting, databases, authentication, AI processing, email delivery, payments, file storage, analytics, and monitoring.</p>

              <h3 className="text-base font-medium text-foreground mt-6">Legal and Safety Reasons</h3>
              <p>Information may be disclosed when reasonably necessary to comply with law, respond to lawful requests, enforce our Terms of Service, prevent fraud, protect users, or protect the service.</p>

              <h3 className="text-base font-medium text-foreground mt-6">Business Transfers</h3>
              <p>If the business undergoes merger, acquisition, restructuring, or asset transfer, data may be transferred as part of the relevant transaction, subject to applicable law.</p>

              <p className="mt-4">
                MirrorSite does not sell personal information to third parties.
              </p>
            </div>
          </section>

          {/* ── 14. Third-Party Services ── */}
          <section id="third-party" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Server className="size-5 text-primary" /> 14. Third-Party Services
            </h2>
            <p className="text-base leading-7 text-muted-foreground mb-6">
              MirrorSite uses the following categories of third-party service providers:
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Purpose</th>
                    <th className="px-4 py-3 text-left font-medium">Data Potentially Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cat: "Database", purpose: "Data storage", data: "Account, project, and application data" },
                    { cat: "Website Analysis", purpose: "Website crawling and analysis", data: "Submitted URLs, page content, screenshots" },
                    { cat: "Application Generation", purpose: "Code generation and building", data: "Prompts, project context, specifications" },
                    { cat: "AI Processing", purpose: "AI reasoning and generation", data: "Prompts, project inputs, payment screenshots" },
                    { cat: "Hosting", purpose: "Application hosting and deployment", data: "Technical and service data" },
                    { cat: "Email", purpose: "Transactional email delivery", data: "Email address, account data" },
                    { cat: "File Storage", purpose: "Asset and file management", data: "Uploaded files, project assets" },
                    { cat: "Analytics", purpose: "Usage measurement", data: "Aggregate usage data" },
                    { cat: "Authentication", purpose: "Google sign-in (optional)", data: "Email, name, profile image" },
                  ].map(({ cat, purpose, data }) => (
                    <tr key={cat} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium">{cat}</td>
                      <td className="px-4 py-3 text-muted-foreground">{purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-base leading-7 text-muted-foreground mt-4">
              MirrorSite may link to third-party websites or services. Their privacy practices are governed by their own policies. We do not assume responsibility for third-party privacy practices.
            </p>
          </section>

          {/* ── 15. Data Security ── */}
          <section id="security" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Lock className="size-5 text-primary" /> 15. How We Protect Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite implements security measures designed to protect information, including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Password hashing using bcrypt with a cost factor of 12</li>
                <li>Session tokens stored as SHA-256 hashes (raw tokens are never stored server-side)</li>
                <li>HttpOnly, secure session cookies with SameSite protection</li>
                <li>Authentication-based access controls on all project and account data</li>
                <li>Rate limiting on sensitive endpoints (registration, login, etc.)</li>
                <li>Structured logging with automatic secret redaction</li>
                <li>Server-side session management with automatic expiration</li>
              </ul>
              <p>
                No method of transmission or storage can be guaranteed to be completely secure. While we take reasonable measures to protect information, we cannot guarantee absolute security.
              </p>
            </div>
          </section>

          {/* ── 16. Data Retention ── */}
          <section id="retention" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Database className="size-5 text-primary" /> 16. Data Retention
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                We retain information for as long as reasonably necessary for the purposes described in this Policy, subject to applicable legal requirements and operational needs.
              </p>
              <p>Specific retention details:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong className="text-foreground">Session tokens:</strong> Expire after 30 days and are deleted on logout.</li>
                <li><strong className="text-foreground">Account data:</strong> Retained while the account is active. Soft-deleted accounts have PII stripped but records may be retained for legitimate business purposes.</li>
                <li><strong className="text-foreground">Project data:</strong> Retained while the project exists and as needed for service operation.</li>
                <li><strong className="text-foreground">Transaction records:</strong> Retained for billing, accounting, and fraud prevention purposes.</li>
                <li><strong className="text-foreground">Server logs:</strong> Retained for operational and debugging purposes.</li>
              </ul>
              <p>
                Specific retention periods for jurisdictions requiring formal schedules should be finalized by legal counsel.
              </p>
            </div>
          </section>

          {/* ── 17. Account and Data Deletion ── */}
          <section id="deletion" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Trash2 className="size-5 text-primary" /> 17. Account and Data Deletion
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                You may request account deletion through your account settings or by contacting support. Account deletion performs a soft-delete that:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Removes your ability to log in</li>
                <li>Strips personally identifiable information from your account record (email replaced, name anonymized)</li>
                <li>Revokes all active sessions</li>
              </ul>
              <p>
                Some information may need to be retained where required by law, fraud prevention, security, accounting, dispute resolution, or legitimate business records.
              </p>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm">
                  You may also contact MirrorSite support to request access to, correction of, or deletion of your personal information. We will respond to reasonable requests in accordance with applicable law.
                </p>
              </div>
            </div>
          </section>

          {/* ── 18. Your Privacy Rights ── */}
          <section id="rights" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Shield className="size-5 text-primary" /> 18. Your Privacy Rights
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                Depending on where you live and applicable law, you may have certain rights regarding your personal information, which could include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Access to your personal information</li>
                <li>Correction of inaccurate information</li>
                <li>Deletion of your personal information</li>
                <li>Data portability</li>
                <li>Restriction of processing</li>
                <li>Objection to processing</li>
                <li>Withdrawal of consent</li>
                <li>Lodge a complaint with a supervisory authority</li>
              </ul>
              <p>
                To exercise any of these rights, please contact MirrorSite support. We will respond to reasonable requests in accordance with applicable law.
              </p>
            </div>
          </section>

          {/* ── 19. Children's Privacy ── */}
          <section id="children" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Shield className="size-5 text-primary" /> 19. Children&apos;s Privacy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite is not intentionally designed to collect personal information from children in circumstances where doing so would violate applicable law. If we become aware that we have collected personal information from a child without appropriate consent, we will take steps to delete that information.
              </p>
            </div>
          </section>

          {/* ── 20. International Data Processing ── */}
          <section id="international" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Globe className="size-5 text-primary" /> 20. International Data Processing
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite and its service providers may process information in countries other than the country where you live. These countries may have data protection laws that differ from the laws of your country.
              </p>
              <p>
                By using MirrorSite AI, you acknowledge that your information may be transferred to and processed in other countries. We take reasonable measures to ensure that adequate protections are in place.
              </p>
            </div>
          </section>

          {/* ── 21. Changes to This Policy ── */}
          <section id="changes" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> 21. Changes to This Privacy Policy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                We may update this Privacy Policy as the service evolves, features are added, providers change, legal requirements change, or privacy practices change.
              </p>
              <p>
                When we make material changes to this policy, we will update the &quot;Last Updated&quot; date at the top of this page and, where appropriate, notify users through reasonable means.
              </p>
              <p>
                We encourage you to review this Policy periodically. Your continued use of MirrorSite AI after changes are posted constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* ── 22. Contact ── */}
          <section id="contact" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Mail className="size-5 text-primary" /> 22. Contact
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                If you have questions about this Privacy Policy or MirrorSite AI&apos;s privacy practices, please contact us through the MirrorSite AI platform or reach out to ATAI — Advanced Technologies and AI Enterprises.
              </p>
              <p>
                [OFFICIAL PRIVACY CONTACT TO BE CONFIRMED BY ATAI]
              </p>
            </div>
          </section>

          {/* ── 23. Privacy FAQ ── */}
          <section id="faq" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-6 flex items-center gap-3">
              <HelpCircle className="size-5 text-primary" /> 23. Privacy FAQ
            </h2>
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

        </article>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <span className="font-mono text-xs">© 2026 MirrorSite AI</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/" className="hover:text-foreground">Home</Link>
              <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
              <Link href="/about" className="hover:text-foreground">About</Link>
              <Link href="/privacy" className="text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/login" className="hover:text-foreground">Sign in</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
