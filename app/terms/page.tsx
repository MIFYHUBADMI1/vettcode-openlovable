import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  FileText,
  Shield,
  Users,
  CreditCard,
  Globe,
  Database,
  Server,
  Eye,
  Lock,
  Trash2,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Key,
  Zap,
  AlertCircle,
  BookOpen,
  Scale,
  Mail,
  ExternalLink,
  ChevronDown,
  Clock,
  Ban,
  Code2,
  Layers3,
  Rocket,
  DollarSign,
  Gift,
  ShieldCheck,
  Building2,
  Lightbulb,
  TerminalSquare,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"

/* ═══════════════════════════════════════════════════════════════
   SEO METADATA
   ═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "MirrorSite AI Terms of Service | Terms & Conditions",
  description:
    "Read the MirrorSite AI Terms of Service covering accounts, AI-generated applications, website analysis, credits, payments, referrals, intellectual property, acceptable use, early access and service limitations.",
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/terms`,
    siteName: "MirrorSite AI",
    title: "MirrorSite AI Terms of Service | Terms & Conditions",
    description:
      "Read the MirrorSite AI Terms of Service covering accounts, AI-generated applications, website analysis, credits, payments, referrals, intellectual property, acceptable use, early access and service limitations.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Terms of Service" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI Terms of Service | Terms & Conditions",
    description: "Read the MirrorSite AI Terms of Service.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Terms of Service" }],
  },
}

/* ═══════════════════════════════════════════════════════════════
   STRUCTURED DATA
   ═══════════════════════════════════════════════════════════════ */

const termsPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MirrorSite AI Terms of Service",
  description:
    "Terms of Service governing access to and use of MirrorSite AI, including accounts, AI-generated applications, website analysis, credits, payments, referrals, intellectual property, acceptable use, early access and service limitations.",
  url: `${SITE_URL}/terms`,
  isPartOf: {
    "@type": "WebSite",
    name: "MirrorSite AI",
    url: SITE_URL,
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
        text: "MirrorSite AI is an AI-powered application development platform that helps users turn ideas, product concepts, and authorized website references into working full-stack applications using AI-powered analysis, planning, generation and infrastructure capabilities.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need permission to analyze a website?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You must have the appropriate rights, permissions, or lawful basis to analyze and reproduce content from any website you submit to MirrorSite AI. You are responsible for ensuring you have authorization to analyze the websites you submit.",
      },
    },
    {
      "@type": "Question",
      name: "Who owns the application I create?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Subject to these Terms, applicable third-party rights, and the rights in any third-party materials incorporated into the output, you retain your rights in the application or project you create using MirrorSite AI.",
      },
    },
    {
      "@type": "Question",
      name: "Is AI-generated code guaranteed to be error-free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. AI-generated code may contain mistakes, incomplete implementations, security vulnerabilities, dependency issues, or unexpected behavior. Users must independently review, test, and verify generated output before production use.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use MirrorSite to build commercial applications?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI is a development and prototyping tool. You may use it to build commercial applications, subject to these Terms and applicable law. You remain responsible for the legality and compliance of your application.",
      },
    },
    {
      "@type": "Question",
      name: "What are MirrorSite credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite credits are an internal usage unit consumed when MirrorSite AI generates applications, analyzes websites, or performs other platform actions. New users receive 500 free credits upon account verification. Credits can be purchased via Dodo Payments or earned through subscriptions.",
      },
    },
    {
      "@type": "Question",
      name: "Can credits be exchanged for cash?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MirrorSite credits have no cash value and cannot be exchanged for cash, transferred to other accounts, or redeemed for money, except where required by applicable law.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if I violate the Terms?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite may restrict, suspend, or terminate your account if you violate these Terms. This may include loss of access to projects, credits, and platform features. Serious violations may result in permanent account termination.",
      },
    },
    {
      "@type": "Question",
      name: "Is MirrorSite currently in early access?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MirrorSite AI may currently be in early access. Features may change, functionality may be incomplete, performance may vary, and bugs may occur. We continuously improve the service based on testing, usage and user feedback.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite guarantee that my application will work in production?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MirrorSite AI generates application foundations as a starting point. Users must independently evaluate generated output, perform testing, security review, and configure production environments. MirrorSite does not guarantee production readiness for every generated application.",
      },
    },
    {
      "@type": "Question",
      name: "Does MirrorSite own my idea?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MirrorSite does not claim ownership of your ideas, concepts, prompts, or the applications you create. You retain your rights in your own content, subject to the limited license needed to operate the service.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use my own infrastructure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MirrorSite provides managed infrastructure options for generated applications. Users may deploy generated applications to their own infrastructure subject to the applicable licensing and technical requirements of the generated output.",
      },
    },
  ],
}

/* ═══════════════════════════════════════════════════════════════
   TABLE OF CONTENTS DATA
   ═══════════════════════════════════════════════════════════════ */

const tocSections = [
  { id: "acceptance", label: "1. Acceptance of These Terms" },
  { id: "about", label: "2. About MirrorSite AI" },
  { id: "eligibility", label: "3. Eligibility" },
  { id: "account", label: "4. Your Account" },
  { id: "service", label: "5. The MirrorSite AI Service" },
  { id: "ai-output", label: "6. AI-Generated Output" },
  { id: "website-analysis", label: "7. Website Analysis and Reproduction" },
  { id: "user-content", label: "8. User Content" },
  { id: "intellectual-property", label: "9. Intellectual Property" },
  { id: "generated-apps", label: "10. Your Applications and Projects" },
  { id: "credits", label: "11. Credits and Usage" },
  { id: "pricing", label: "12. Pricing" },
  { id: "payments", label: "13. Payments" },
  { id: "refunds", label: "14. Refunds" },
  { id: "referrals", label: "15. Referral Program" },
  { id: "third-party", label: "16. Third-Party Services" },
  { id: "infrastructure", label: "17. Infrastructure and Hosting" },
  { id: "early-access", label: "18. Early Access" },
  { id: "beta", label: "19. Beta and Experimental Features" },
  { id: "acceptable-use", label: "20. Acceptable Use" },
  { id: "prohibited", label: "21. Prohibited Activities" },
  { id: "security", label: "22. Security" },
  { id: "availability", label: "23. Service Availability" },
  { id: "disclaimers", label: "24. Disclaimers" },
  { id: "liability", label: "25. Limitation of Liability" },
  { id: "indemnification", label: "26. Indemnification" },
  { id: "suspension", label: "27. Account Suspension and Termination" },
  { id: "privacy", label: "28. Data and Privacy" },
  { id: "changes-service", label: "29. Changes to MirrorSite" },
  { id: "changes-terms", label: "30. Changes to These Terms" },
  { id: "governing-law", label: "31. Governing Law and Disputes" },
  { id: "general", label: "32. General Provisions" },
  { id: "contact", label: "33. Contact" },
  { id: "faq", label: "Frequently Asked Questions" },
]

/* ═══════════════════════════════════════════════════════════════
   FAQ DATA
   ═══════════════════════════════════════════════════════════════ */

const faqItems = [
  {
    q: "What is MirrorSite AI?",
    a: "MirrorSite AI is an AI-powered application development platform that helps users turn ideas, product concepts, and authorized website references into working full-stack applications using AI-powered analysis, planning, generation and infrastructure capabilities.",
  },
  {
    q: "Do I need permission to analyze a website?",
    a: "Yes. You must have the appropriate rights, permissions, or lawful basis to analyze and reproduce content from any website you submit. You are responsible for ensuring you have authorization to analyze the websites you submit.",
  },
  {
    q: "Who owns the application I create?",
    a: "Subject to these Terms, applicable third-party rights, and the rights in any third-party materials incorporated into the output, you retain your rights in the application or project you create using MirrorSite AI.",
  },
  {
    q: "Is AI-generated code guaranteed to be error-free?",
    a: "No. AI-generated code may contain mistakes, incomplete implementations, security vulnerabilities, dependency issues, or unexpected behavior. You must independently review, test, and verify generated output before production use.",
  },
  {
    q: "Can I use MirrorSite to build commercial applications?",
    a: "Yes. MirrorSite AI is a development and prototyping tool. You may use it to build commercial applications, subject to these Terms and applicable law. You remain responsible for the legality and compliance of your application.",
  },
  {
    q: "What are MirrorSite credits?",
    a: "MirrorSite credits are an internal usage unit consumed when MirrorSite AI generates applications, analyzes websites, or performs other platform actions. New users receive 500 free credits upon account verification. Credits can be purchased via Dodo Payments or earned through subscriptions.",
  },
  {
    q: "Can credits be exchanged for cash?",
    a: "No. MirrorSite credits have no cash value and cannot be exchanged for cash, transferred to other accounts, or redeemed for money, except where required by applicable law.",
  },
  {
    q: "What happens if I violate the Terms?",
    a: "MirrorSite may restrict, suspend, or terminate your account if you violate these Terms. This may include loss of access to projects, credits, and platform features.",
  },
  {
    q: "Is MirrorSite currently in early access?",
    a: "Yes. MirrorSite AI may currently be in early access. Features may change, functionality may be incomplete, performance may vary, and bugs may occur. We continuously improve the service based on testing, usage and user feedback.",
  },
  {
    q: "Does MirrorSite guarantee that my application will work in production?",
    a: "No. MirrorSite generates application foundations as a starting point. Users must independently evaluate generated output, perform testing, security review, and configure production environments.",
  },
  {
    q: "Does MirrorSite own my idea?",
    a: "No. MirrorSite does not claim ownership of your ideas, concepts, prompts, or the applications you create. You retain your rights in your own content, subject to the limited license needed to operate the service.",
  },
  {
    q: "Can I use my own infrastructure?",
    a: "MirrorSite provides managed infrastructure options for generated applications. Users may deploy generated applications to their own infrastructure subject to applicable licensing and technical requirements.",
  },
]

/* ═══════════════════════════════════════════════════════════════
   HELPER: Section wrapper
   ═══════════════════════════════════════════════════════════════ */

function Section({ id, number, icon: Icon, title, children }: {
  id: string
  number: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
        <Icon className="size-5 text-primary" /> {number}. {title}
      </h2>
      <div className="space-y-4 text-base leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(termsPageStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />

      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />

        <SiteHeader activePage="/terms" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }]} />

        {/* ═══════════════════════════════════════════════════════
           PAGE HEADER
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pt-12 pb-8 lg:px-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><FileText className="size-5 text-primary" /></div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Terms of Service</p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground max-w-2xl">
            These Terms of Service govern your access to and use of MirrorSite AI and its related services.
          </p>
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            Last Updated: September 1, 2026
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════
           QUICK SUMMARY — BEFORE YOU USE MIRRORSITE
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pb-12 lg:px-10">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-lg font-semibold mb-3">Before You Use MirrorSite</h2>
            <p className="text-sm leading-6 text-muted-foreground mb-4">
              MirrorSite AI helps users turn ideas, product concepts, and authorized website references into application projects using AI-powered analysis, planning, generation and infrastructure capabilities.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You are responsible for what you build.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You must have permission to analyze or reproduce websites or content.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> AI-generated output should be reviewed and tested before production use.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Credits and payments are subject to the applicable pricing rules.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> MirrorSite may be updated, changed, limited, suspended or discontinued.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Users must comply with applicable laws.</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground italic">
              This summary is for convenience only. The legally operative Terms are set out in the sections below.
            </p>
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

          {/* ── 1. Acceptance of These Terms ── */}
          <Section id="acceptance" number="1" icon={CheckCircle2} title="Acceptance of These Terms">
            <p>
              By accessing or using MirrorSite AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
            </p>
            <p>
              These Terms form a legally binding agreement between you and MirrorSite AI, operated by ATAI — Advanced Technologies and AI Enterprises (&quot;ATAI,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
            </p>
            <p>
              Additional policies may also apply to your use of the Service, including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> (these Terms)</li>
              <li><Link href="/database-terms" className="text-primary hover:underline">Database &amp; Infrastructure Terms</Link></li>
            </ul>
            <p>
              Where a separate policy applies, that policy forms part of your agreement with us. Only policies that actually exist are linked above.
            </p>
          </Section>

          {/* ── 2. About MirrorSite AI ── */}
          <Section id="about" number="2" icon={Layers3} title="About MirrorSite AI">
            <p>
              MirrorSite AI is an AI-powered application development platform designed to reduce the distance between an idea and a working full-stack MVP.
            </p>
            <p>
              Depending on the features available, MirrorSite may:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Analyze websites you submit for reference</li>
              <li>Create structured project context from your inputs</li>
              <li>Generate project plans and specifications</li>
              <li>Generate application code and components</li>
              <li>Create application infrastructure including authentication, database, storage, and deployment</li>
              <li>Provide previews and development environments</li>
              <li>Support deployment to free subdomains or custom domains</li>
            </ul>
            <p>
              Users may provide ideas, descriptions, website URLs, references, and project requirements as starting points for application generation.
            </p>
            <p>
              Features may vary by plan, product version, availability, project configuration and infrastructure.
            </p>
          </Section>

          {/* ── 3. Eligibility ── */}
          <Section id="eligibility" number="3" icon={Users} title="Eligibility">
            <p>
              You may use MirrorSite AI only if you are legally capable of entering into a binding agreement and are permitted to use the service under applicable law.
            </p>
            <p>
              If you use MirrorSite on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </p>
          </Section>

          {/* ── 4. Your Account ── */}
          <Section id="account" number="4" icon={Key} title="Your Account">
            <p>
              To use certain features of MirrorSite AI, you may need to create an account. When creating an account, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Keep your credentials secure and confidential</li>
              <li>Maintain the security of your account</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
              <li>Immediately notify us of any suspected unauthorized access</li>
            </ul>
            <p>
              You must not share your account credentials, create fraudulent accounts, impersonate others, or attempt unauthorized access to other accounts.
            </p>
            <p>
              MirrorSite supports sign-in via email/password and Google authentication. Account verification may be required for certain features.
            </p>
          </Section>

          {/* ── 5. The MirrorSite AI Service ── */}
          <Section id="service" number="5" icon={Zap} title="The MirrorSite AI Service">
            <p>
              MirrorSite AI provides an AI-powered platform for application development. The Service may include capabilities such as:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>AI-assisted application development and code generation</li>
              <li>Website analysis and structured project context creation</li>
              <li>Application planning and specification generation</li>
              <li>Full-stack application generation including frontend, backend, authentication, and database</li>
              <li>Project management and workspace tools</li>
              <li>Application infrastructure including authentication, database, storage, and hosting</li>
              <li>Deployment to free subdomains and custom domain connections</li>
              <li>AI-powered development prompts and follow-up modifications</li>
            </ul>
            <p>
              Features, workflows, capabilities, and availability may change as the Service evolves. MirrorSite may add, modify, or discontinue features at any time.
            </p>
          </Section>

          {/* ── 6. AI-Generated Output ── */}
          <Section id="ai-output" number="6" icon={Cpu} title="AI-Generated Content and Applications">
            <p>
              MirrorSite uses AI systems to generate or assist with code, application structures, user interfaces, content, configurations, plans, technical recommendations, and other outputs.
            </p>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">AI output may not be perfect.</p>
                <p>AI-generated content may contain mistakes, outdated information, incomplete implementations, incorrect assumptions, security vulnerabilities, dependency issues, or unexpected behavior.</p>
              </div>
            </div>
            <p>
              You must:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Review generated code before use</li>
              <li>Test functionality in a development environment</li>
              <li>Verify dependencies and their licenses</li>
              <li>Inspect for security vulnerabilities</li>
              <li>Validate business logic and data handling</li>
              <li>Review third-party integrations</li>
              <li>Test production behavior before deploying</li>
            </ul>
            <p>
              MirrorSite does not claim that generated output is error-free, guaranteed to be secure, guaranteed to be compatible with all systems, or guaranteed to achieve any particular commercial result.
            </p>
            <p>
              You remain responsible for determining whether generated output is appropriate for your intended use, including production deployment.
            </p>
          </Section>

          {/* ── 7. Website Analysis and Reproduction ── */}
          <Section id="website-analysis" number="7" icon={Globe} title="Website Analysis and Reproduction">
            <p>
              MirrorSite AI may provide capabilities for analyzing websites where users submit URLs. When you submit a URL for analysis, you represent that you have the appropriate rights, permissions, licenses, or lawful basis to analyze and reproduce the relevant materials.
            </p>
            <p>
              You must not use MirrorSite AI to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Infringe copyright or violate intellectual property rights</li>
              <li>Violate trademarks or trade dress</li>
              <li>Steal proprietary content or trade secrets</li>
              <li>Bypass access controls, authentication, or paywalls</li>
              <li>Obtain private or restricted information without authorization</li>
              <li>Circumvent technical access restrictions</li>
              <li>Violate applicable website terms of service</li>
              <li>Abuse websites through excessive or automated requests</li>
              <li>Perform unlawful scraping or data collection</li>
            </ul>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium mb-1">Important distinction</p>
              <p className="text-sm text-muted-foreground">
                MirrorSite provides technical capabilities for analysis. It does not grant you ownership of or licensing rights to third-party websites or content. Submitting a URL does not transfer any rights in the referenced website.
              </p>
            </div>
          </Section>

          {/* ── 8. User Content ── */}
          <Section id="user-content" number="8" icon={FileText} title="User Content">
            <p>
              &quot;User Content&quot; includes any content you submit to MirrorSite AI, such as prompts, text, ideas, website URLs, uploaded files, project specifications, designs, code, images, and other materials.
            </p>
            <p>
              You are responsible for ensuring you have the necessary rights and permissions to submit any User Content. You must not submit content that you are not authorized to provide.
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium mb-1">User Content License</p>
              <p className="text-sm text-muted-foreground">
                You grant MirrorSite the rights reasonably necessary to host, process, analyze, transmit and otherwise use your submitted content for the purpose of providing, maintaining, securing and improving the Service, subject to the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and applicable law.
              </p>
            </div>
            <p>
              This limited license is granted solely for the purpose of operating the Service. MirrorSite does not claim ownership of your User Content beyond what is necessary to provide the Service.
            </p>
          </Section>

          {/* ── 9. Intellectual Property ── */}
          <Section id="intellectual-property" number="9" icon={Shield} title="Intellectual Property">
            <p>
              Intellectual property in connection with MirrorSite AI falls into several categories:
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">MirrorSite intellectual property</h3>
            <p>
              MirrorSite AI, including its platform, software, interface, branding, logos, and proprietary technology, is owned by or licensed to ATAI. These Terms do not grant you any rights to use MirrorSite&apos;s trademarks, branding, or intellectual property except as necessary to use the Service.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">User content</h3>
            <p>
              You retain the rights you already have in your own content and materials. MirrorSite does not acquire ownership of your ideas, concepts, prompts, or creative work through your use of the Service.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Third-party content</h3>
            <p>
              Third-party materials, libraries, dependencies, and content remain owned by their respective owners. Use of the Service does not automatically transfer ownership of third-party content to you or to MirrorSite.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">AI-generated output</h3>
            <p>
              AI-generated output is produced based on your inputs and the training of the AI systems used. Your rights in AI-generated output are subject to these Terms, applicable third-party rights, and the rights in any third-party materials incorporated into the output.
            </p>
          </Section>

          {/* ── 10. Your Applications and Projects ── */}
          <Section id="generated-apps" number="10" icon={Rocket} title="Your Applications and Projects">
            <p>
              When you use MirrorSite AI to create an application or project, ownership of the generated output works as follows:
            </p>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm">
                Subject to these Terms, applicable third-party rights, and the rights in any third-party materials incorporated into the output, you retain your rights in the application or project you create using MirrorSite AI.
              </p>
            </div>
            <p>
              This means:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You own the application you create, subject to applicable third-party rights</li>
              <li>Third-party code, libraries, and dependencies remain owned by their respective owners</li>
              <li>MirrorSite does not claim ownership of your generated applications</li>
              <li>You are responsible for compliance with applicable licenses for any third-party components</li>
            </ul>
            <p>
              MirrorSite does not claim ownership of your ideas or the applications you create. However, MirrorSite may retain copies of project data for service operation, backups, and as described in the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </Section>

          {/* ── 11. Credits and Usage ── */}
          <Section id="credits" number="11" icon={CreditCard} title="Credits and Usage">
            <p>
              MirrorSite AI uses an internal credit system. Key aspects of the credit system:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Credits are an internal usage unit for the MirrorSite platform</li>
              <li>MirrorSite credits are consumed when building applications</li>
              <li>Credits are consumed for actions such as website analysis, plan generation, and application generation</li>
              <li>Different actions may consume different amounts of credits</li>
              <li>New users receive 500 free credits upon account verification</li>
              <li>Displayed credit requirements may change as the Service evolves</li>
            </ul>
            <p>
              Credits:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Have no cash value unless required by applicable law</li>
              <li>Cannot be transferred between accounts unless the product explicitly permits it</li>
              <li>Are not currency and are not redeemable for money</li>
              <li>Are consumed when MirrorSite performs credit-consuming actions on your behalf</li>
            </ul>
            <p>
              MirrorSite credits are conceptually separate from any third-party infrastructure or provider credits. Internal cost structures and provider economics are not exposed to users.
            </p>
          </Section>

          {/* ── 12. Pricing ── */}
          <Section id="pricing" number="12" icon={DollarSign} title="Pricing">
            <p>
              MirrorSite AI uses a credit-based pricing model. Application generation is priced at three tiers:
            </p>
            <div className="grid gap-3 sm:grid-cols-3 my-4">
              {[
                { tier: "Simple", credits: "25,000 credits", desc: "For smaller applications and straightforward experiences" },
                { tier: "Medium", credits: "50,000 credits", desc: "For more capable full-stack applications" },
                { tier: "Complex", credits: "75,000 credits", desc: "For advanced application projects" },
              ].map(({ tier, credits, desc }) => (
                <div key={tier} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-medium text-sm">{tier}</p>
                  <p className="font-mono text-xs text-primary mt-1">{credits}</p>
                  <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                </div>
              ))}
            </div>
            <p>
              Prices, plans, features, and credit requirements may change. Promotional offers may have additional terms. Applicable taxes may apply.
            </p>
            <p>
              Current prices and plan details are available on the <Link href="/pricing" className="text-primary hover:underline">MirrorSite AI pricing page</Link>.
            </p>
          </Section>

          {/* ── 13. Payments ── */}
          <Section id="payments" number="13" icon={CreditCard} title="Payments">
            <p>
              MirrorSite AI currently supports credit purchases via mobile money (MTN and Airtel). When you make a payment:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You authorize the payment for the selected credit package</li>
              <li>Payment is processed through the applicable mobile money provider</li>
              <li>MirrorSite receives transaction confirmation data for verification purposes</li>
              <li>Credits are awarded to your account upon successful verification</li>
              <li>Failed, duplicate, or fraudulent transactions may be investigated and reversed</li>
            </ul>
            <p>
              You are responsible for ensuring that your payment information is accurate and that you have sufficient funds for the transaction. MirrorSite does not directly collect or store credit card numbers.
            </p>
            <p>
              Credit packages are available in various amounts as displayed on the <Link href="/pricing" className="text-primary hover:underline">pricing page</Link>.
            </p>
          </Section>

          {/* ── 14. Refunds ── */}
          <Section id="refunds" number="14" icon={AlertCircle} title="Refunds">
            <p>
              Refund eligibility depends on the applicable purchase, payment method, promotional terms, and applicable law. For full details, see the <Link href="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.
            </p>
            <p>
              Key points:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Failed payments that deducted funds without awarding credits are eligible for investigation and resolution</li>
              <li>Duplicate transactions are eligible for refund of the duplicate amount</li>
              <li>Credits consumed through platform actions (analysis, generation, deployment) are not refundable</li>
              <li>Promotional and referral credits are not refundable and have no cash value</li>
            </ul>
            <p>
              Requests for refunds should be directed to MirrorSite support. MirrorSite reserves the right to deny refund requests where the terms of a specific purchase or promotion do not provide for refunds.
            </p>
          </Section>

          {/* ── 15. Referral Program ── */}
          <Section id="referrals" number="15" icon={Gift} title="Referral Program">
            <p>
              MirrorSite AI offers a referral program that allows users to earn promotional credits by inviting others to join the platform. The current referral program operates as follows:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Each user may have a unique referral code (format: MSA-XXXXXX)</li>
              <li>When a referred user registers using your referral code and verifies their account, you receive <strong className="text-foreground">500 credits</strong></li>
              <li>When the referred user reaches a qualifying usage threshold of 75,000 application-generation credits (successful builds only), you receive an additional <strong className="text-foreground">1,500 credits</strong></li>
              <li>The maximum referral reward per referred user is <strong className="text-foreground">2,000 credits</strong></li>
            </ul>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Referral rewards are promotional credits</p>
                <p>Referral rewards are promotional credits subject to eligibility and anti-abuse requirements. They have no cash value and cannot be exchanged for money. MirrorSite reserves the right to cancel referral rewards where fraudulent, abusive, or manipulative activity is detected.</p>
              </div>
            </div>
            <p>
              Self-referral, circular referral chains, creation of multiple accounts to exploit referral rewards, and other fraudulent activity are prohibited and may result in forfeiture of earned rewards and account suspension.
            </p>
          </Section>

          {/* ── 16. Third-Party Services ── */}
          <Section id="third-party" number="16" icon={ExternalLink} title="Third-Party Services">
            <p>
              MirrorSite AI may rely on third-party services and infrastructure providers to operate the Service. These may include providers of:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>AI processing and code generation</li>
              <li>Website analysis and crawling</li>
              <li>Database hosting and management</li>
              <li>Authentication services</li>
              <li>Payment processing</li>
              <li>File storage and asset management</li>
              <li>Email delivery</li>
              <li>Application hosting and deployment</li>
              <li>Analytics and monitoring</li>
            </ul>
            <p>
              Third-party services may have their own terms of service, privacy policies, availability limitations, and technical requirements. MirrorSite is not responsible for the practices or availability of third-party providers.
            </p>
            <p>
              The specific third-party providers and processing arrangements may change as the Service evolves.
            </p>
          </Section>

          {/* ── 17. Infrastructure and Hosting ── */}
          <Section id="infrastructure" number="17" icon={Server} title="Infrastructure and Hosting">
            <p>
              MirrorSite AI may provide or connect application infrastructure for your generated projects. This may include:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Database hosting and management</li>
              <li>Authentication infrastructure</li>
              <li>File storage</li>
              <li>Application hosting and deployment</li>
              <li>Free subdomain deployment (*.totalum-project.com)</li>
              <li>Custom domain connections</li>
            </ul>
            <p>
              You remain responsible for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your application&apos;s content and compliance</li>
              <li>Configuration and secrets management</li>
              <li>Access permissions and security</li>
              <li>Third-party services you integrate</li>
              <li>Production configuration and deployment decisions</li>
            </ul>
            <p>
              Infrastructure plans, storage limits, and usage policies are described in the <Link href="/database-terms" className="text-primary hover:underline">Database &amp; Infrastructure Terms</Link>.
            </p>
          </Section>

          {/* ── 18. Early Access ── */}
          <Section id="early-access" number="18" icon={Clock} title="Early Access">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Early Access</p>
                <p>MirrorSite AI may currently be in an early-access stage of development.</p>
              </div>
            </div>
            <p>
              Early access means:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Features may change without prior notice</li>
              <li>Functionality may be incomplete or under development</li>
              <li>Performance may vary and may change over time</li>
              <li>Infrastructure may be upgraded or modified</li>
              <li>Bugs, errors, or unexpected behavior may occur</li>
              <li>Workflows and processes may change</li>
              <li>Certain features may be experimental</li>
              <li>Data or projects may be affected by technical limitations</li>
            </ul>
            <p>
              We are continuously improving the Service based on technical testing, usage, and user feedback. Early-access status does not imply that the Service will achieve any particular level of maturity, performance, or availability.
            </p>
          </Section>

          {/* ── 19. Beta and Experimental Features ── */}
          <Section id="beta" number="19" icon={FlaskIcon} title="Beta and Experimental Features">
            <p>
              MirrorSite AI may from time to time offer beta or experimental features. Beta features:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>May change, be modified, or be removed at any time</li>
              <li>May not be supported on a permanent basis</li>
              <li>May have significant limitations or known issues</li>
              <li>May not be covered by the same availability or reliability standards as the main Service</li>
            </ul>
            <p>
              Use of beta features is optional and at your own risk. MirrorSite makes no guarantees about the availability, performance, or future of beta features.
            </p>
          </Section>

          {/* ── 20. Acceptable Use ── */}
          <Section id="acceptable-use" number="20" icon={ShieldCheck} title="Acceptable Use">
            <p>
              You agree to use MirrorSite AI only for lawful purposes and in accordance with these Terms. You must not use the Service to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Engage in any unlawful activity or violate applicable laws or regulations</li>
              <li>Commit fraud or engage in deceptive practices</li>
              <li>Impersonate any person or entity</li>
              <li>Create, distribute, or transmit malware or harmful software</li>
              <li>Engage in credential theft or phishing</li>
              <li>Attempt unauthorized access to systems, accounts, or data</li>
              <li>Launch attacks against other systems or networks</li>
              <li>Evasion of security controls or access restrictions</li>
              <li>Violate the privacy of others</li>
              <li>Infringe copyright, trademark, or other intellectual property rights</li>
              <li>Perform unauthorized scraping or data collection</li>
              <li>Engage in harassment, abuse, or bullying</li>
              <li>Send spam or engage in malicious automation</li>
              <li>Distribute harmful or malicious software</li>
              <li>Conduct activities designed to damage third-party systems</li>
            </ul>
          </Section>

          {/* ── 21. Prohibited Activities ── */}
          <Section id="prohibited" number="21" icon={Ban} title="Prohibited Website Activity">
            <p>
              Because website analysis is a core capability of MirrorSite AI, the following activities are specifically prohibited:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Bypassing authentication or login requirements</li>
              <li>Bypassing paywalls or subscription requirements</li>
              <li>Defeating technical access restrictions or DRM</li>
              <li>Scraping private, non-public, or access-restricted areas of websites</li>
              <li>Collecting personal data without authorization</li>
              <li>Making excessive automated requests intended to degrade a website&apos;s performance</li>
              <li>Evading anti-bot systems, CAPTCHAs, or rate limiting</li>
              <li>Unauthorized access to computer systems or networks</li>
              <li>Attempting to circumvent security mechanisms</li>
            </ul>
            <p>
              You must respect website owners, their terms of service, and applicable law when using MirrorSite&apos;s website analysis capabilities.
            </p>
          </Section>

          {/* ── 22. Security ── */}
          <Section id="security" number="22" icon={Lock} title="Security">
            <p>
              You are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Protecting your account credentials and API keys</li>
              <li>Reviewing generated code for security vulnerabilities</li>
              <li>Configuring production secrets and environment variables correctly</li>
              <li>Managing access permissions for your projects and infrastructure</li>
              <li>Reviewing generated dependencies for known vulnerabilities</li>
            </ul>
            <p>
              MirrorSite implements security measures designed to protect the Service, including password hashing, session token management, rate limiting, and access controls. However, no method of transmission or storage is completely secure, and MirrorSite cannot guarantee absolute security.
            </p>
          </Section>

          {/* ── 23. Service Availability ── */}
          <Section id="availability" number="23" icon={Server} title="Service Availability">
            <p>
              MirrorSite AI strives to maintain reliable service availability. However, the Service may experience:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Periodic outages or downtime</li>
              <li>Scheduled maintenance windows</li>
              <li>Infrastructure upgrades</li>
              <li>Third-party service interruptions</li>
              <li>AI provider interruptions or capacity limitations</li>
              <li>Network issues or latency</li>
            </ul>
            <p>
              The Service is provided without a guaranteed level of uninterrupted availability unless a separate agreement states otherwise. MirrorSite is not liable for any downtime, data loss, or disruption resulting from service interruptions.
            </p>
          </Section>

          {/* ── 24. Disclaimers ── */}
          <Section id="disclaimers" number="24" icon={AlertCircle} title="Disclaimers">
            <p>
              <strong className="text-foreground">No guarantee of business success.</strong> MirrorSite AI does not guarantee product-market fit, revenue, users, customer acquisition, business success, investment, application performance, search ranking, or conversion rates. The platform helps accelerate development but cannot guarantee the outcome of any business.
            </p>
            <p>
              <strong className="text-foreground">No guarantee of error-free output.</strong> AI-generated output may contain mistakes, outdated information, incomplete implementations, incorrect assumptions, security vulnerabilities, dependency issues, or unexpected behavior.
            </p>
            <p>
              <strong className="text-foreground">No production-readiness guarantee.</strong> MirrorSite does not guarantee that every generated application is production-ready. Users must independently evaluate generated output and perform appropriate testing, security review, code review, dependency review, backups, and monitoring before production use.
            </p>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. MIRRORSITE DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
            </p>
          </Section>

          {/* ── 25. Limitation of Liability ── */}
          <Section id="liability" number="25" icon={Scale} title="Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
            </p>
            <p>
              IN NO EVENT SHALL MIRRORSITE AI, ATAI, OR THEIR AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your access to, use of, or inability to use the Service</li>
              <li>Any conduct or content of any third party on the Service</li>
              <li>Any content obtained from the Service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              <li>AI-generated output or its use</li>
            </ul>
            <p>
              IN NO EVENT SHALL THE AGGREGATE LIABILITY OF MIRRORSITE AI EXCEED THE AMOUNT YOU PAID TO MIRRORSITE AI IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR [USD $100 / LOCAL CURRENCY EQUIVALENT], WHICHEVER IS GREATER.
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground italic">
                [Legal counsel should review and finalize jurisdiction-specific liability limitations before production deployment.]
              </p>
            </div>
          </Section>

          {/* ── 26. Indemnification ── */}
          <Section id="indemnification" number="26" icon={ShieldCheck} title="Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless MirrorSite AI, ATAI, and their affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of applicable law</li>
              <li>Your User Content, including content that infringes third-party rights</li>
              <li>Your unauthorized use of website analysis features</li>
              <li>Your applications and their deployment</li>
              <li>Your violation of third-party rights</li>
            </ul>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground italic">
                [This section should be reviewed by legal counsel for jurisdiction-specific enforceability.]
              </p>
            </div>
          </Section>

          {/* ── 27. Account Suspension and Termination ── */}
          <Section id="suspension" number="27" icon={Ban} title="Account Suspension and Termination">
            <h3 className="text-base font-medium text-foreground mt-6">Suspension by MirrorSite</h3>
            <p>
              MirrorSite may restrict or suspend your account where necessary because of:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Abuse or misuse of the Service</li>
              <li>Fraudulent activity</li>
              <li>Security threats</li>
              <li>Violations of these Terms</li>
              <li>Unlawful activity</li>
              <li>Payment issues or disputes</li>
              <li>Attempts to circumvent usage restrictions</li>
              <li>Threats to platform integrity or other users</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-6">Termination</h3>
            <p>
              You may close your account where supported by the platform. Upon termination:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your access to the Service may stop</li>
              <li>Projects may become inaccessible</li>
              <li>Remaining credits may be forfeited</li>
              <li>Data retention may apply as described in the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></li>
              <li>Provisions that by their nature should survive termination will survive, including intellectual property, limitation of liability, indemnification, and dispute resolution</li>
            </ul>
          </Section>

          {/* ── 28. Data and Privacy ── */}
          <Section id="privacy" number="28" icon={Eye} title="Data and Privacy">
            <p>
              Your use of MirrorSite AI is also subject to our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which explains how personal information and other data are collected, used, stored, and processed.
            </p>
            <p>
              By using the Service, you acknowledge that you have read and understood the Privacy Policy. The Privacy Policy is incorporated into these Terms by reference.
            </p>
          </Section>

          {/* ── 29. Changes to MirrorSite ── */}
          <Section id="changes-service" number="29" icon={TerminalSquare} title="Changes to MirrorSite">
            <p>
              MirrorSite AI is a continuously evolving service. We may:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Add new features and capabilities</li>
              <li>Remove or modify existing features</li>
              <li>Change workflows and processes</li>
              <li>Modify infrastructure and underlying systems</li>
              <li>Update AI models and systems</li>
              <li>Modify pricing, credits, and usage limits</li>
              <li>Improve security measures</li>
              <li>Discontinue features or capabilities</li>
            </ul>
            <p>
              We may provide reasonable notice of material changes where appropriate, but we do not guarantee specific notice periods for all changes.
            </p>
          </Section>

          {/* ── 30. Changes to These Terms ── */}
          <Section id="changes-terms" number="30" icon={FileText} title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we make material changes, we may provide notice through the Service or other reasonable means.
            </p>
            <p>
              The &quot;Last Updated&quot; date at the top of this page indicates when these Terms were last revised. Continued use of the Service after changes are posted constitutes your agreement to the updated Terms, unless otherwise required by applicable law.
            </p>
            <p>
              We encourage you to review these Terms periodically.
            </p>
          </Section>

          {/* ── 31. Governing Law and Disputes ── */}
          <Section id="governing-law" number="31" icon={Scale} title="Governing Law and Disputes">
            <p>
              Governing law and dispute-resolution provisions should be finalized by ATAI&apos;s legal counsel before production deployment.
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground italic">
                [Legal counsel should finalize the governing jurisdiction, applicable law, dispute resolution mechanisms, arbitration provisions (if applicable), and venue for this section.]
              </p>
            </div>
            <p>
              Any disputes arising from or relating to these Terms or the Service should first be addressed through good-faith negotiation. If informal resolution is not possible, the parties should pursue resolution through the applicable legal channels as determined by the finalized governing law provisions.
            </p>
          </Section>

          {/* ── 32. General Provisions ── */}
          <Section id="general" number="32" icon={BookOpen} title="General Provisions">
            <h3 className="text-base font-medium text-foreground mt-6">Severability</h3>
            <p>
              If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Waiver</h3>
            <p>
              Failure to enforce any provision of these Terms does not constitute a waiver of that provision or any other provision.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Assignment</h3>
            <p>
              You may not assign or transfer these Terms or your rights under them without MirrorSite&apos;s prior written consent. MirrorSite may assign these Terms in connection with a merger, acquisition, or sale of assets.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Entire Agreement</h3>
            <p>
              These Terms, together with the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and any other applicable policies, constitute the entire agreement between you and MirrorSite AI regarding the Service.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Relationship of Parties</h3>
            <p>
              Nothing in these Terms creates a partnership, joint venture, agency, or employment relationship between you and MirrorSite AI.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Force Majeure</h3>
            <p>
              MirrorSite is not liable for any failure or delay in performance resulting from causes beyond its reasonable control, including natural disasters, acts of government, infrastructure failures, network outages, or other force majeure events.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Notices</h3>
            <p>
              Notices to you may be provided through the Service, by email, or by other reasonable means. Notices to MirrorSite should be sent through the contact channels described in the Contact section below.
            </p>

            <h3 className="text-base font-medium text-foreground mt-6">Survival</h3>
            <p>
              Provisions that by their nature should survive termination will survive, including intellectual property, user content license, disclaimers, limitation of liability, indemnification, and dispute resolution.
            </p>
          </Section>

          {/* ── 33. Contact ── */}
          <Section id="contact" number="33" icon={Mail} title="Contact">
            <p>
              Questions about these Terms of Service?
            </p>
            <div className="rounded-xl border border-border bg-card p-5 mt-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10"><Mail className="size-4 text-primary" /></div>
                <p className="font-medium">Contact MirrorSite AI</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Reach MirrorSite support through the platform or call <span className="font-mono text-foreground">+256 761 819 885</span> for payment-related assistance.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                For legal inquiries, contact: <span className="text-primary">[OFFICIAL MIRRORSITE LEGAL CONTACT]</span>
              </p>
            </div>
          </Section>

          {/* ═══════════════════════════════════════════════════════
             FAQ
             ═══════════════════════════════════════════════════════ */}
          <section id="faq" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-6 flex items-center gap-3">
              <HelpCircle className="size-5 text-primary" /> Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqItems.map(({ q, a }, i) => (
                <details key={i} className="group rounded-xl border border-border bg-card overflow-hidden">
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium select-none hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm leading-6 text-muted-foreground">
                    {a}
                  </div>
                </details>
              ))}
            </div>
          </section>

        </article>

        {/* ═══════════════════════════════════════════════════════
           FINAL CTA
           ═══════════════════════════════════════════════════════ */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-4">Questions?</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Have questions about using MirrorSite AI?
            </h2>
            <p className="mt-3 text-muted-foreground">
              We&apos;re here to help. Reach out or learn more about the platform.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/about" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>
                About MirrorSite AI <ArrowRight className="size-4" />
              </Link>
              <Link href="/privacy" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-6"}>
                Privacy Policy
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-6"}>
                Start Building
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter activePage="/terms" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/resources", label: "Resources" }, { href: "/about", label: "About" }, { href: "/privacy", label: "Privacy" }, { href: "/refund-policy", label: "Refunds" }, { href: "/terms", label: "Terms" }]} />
      </main>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ICON: Flask (for beta section)
   ═══════════════════════════════════════════════════════════════ */

function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" />
      <path d="M10 3v7.4a2 2 0 0 1-.5 1.3L4 16.5c-1.2 1.4-1.1 3.5.1 4.7 1.3 1.2 3.3 1.1 4.5-.1L12 18.5l3.4 2.6c1.2 1.2 3.2 1.3 4.5.1 1.2-1.2 1.3-3.3.1-4.7L14.5 11.7a2 2 0 0 1-.5-1.3V3" />
    </svg>
  )
}
