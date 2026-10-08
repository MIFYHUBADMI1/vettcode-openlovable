import type { Metadata } from "next"
import Link from "next/link"
import {
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
  FileText,
  AlertTriangle,
  CheckCircle2,
  Cookie,
  BarChart3,
  Cpu,
  Send,
  Key,
  Phone,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"

export const metadata: Metadata = {
  title: "Privacy Policy | Atai",
  description:
    "Learn how Atai collects, uses, stores, and protects your information. We are committed to keeping your personal data safe while helping you build and grow your business.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/privacy`,
    siteName: "Atai",
    title: "Privacy Policy | Atai",
    description: "Learn how Atai collects, uses, stores, and protects your information.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai Privacy Policy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Atai",
    description: "Learn how Atai collects, uses, stores, and protects your information.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai Privacy Policy" }],
  },
}

const privacyPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Atai Privacy Policy",
  description: "How Atai collects, processes, stores, and protects your information when you use the platform.",
  url: `${SITE_URL}/privacy`,
  isPartOf: { "@type": "WebSite", name: "Atai", url: SITE_URL },
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What information does Atai collect?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atai collects account information (name, email, authentication details), project information (ideas, prompts, generated applications), billing information (transaction records via payment providers), technical information (IP address, browser type, device info), and usage data necessary to operate the service.",
      },
    },
    {
      "@type": "Question",
      name: "Does Atai sell my personal information?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Atai does not sell personal information to third parties under any circumstances. Information is shared only with service providers necessary to operate the platform, as described in this Privacy Policy.",
      },
    },
    {
      "@type": "Question",
      name: "Who owns my projects and business data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You do. You retain ownership of the content you submit and the applications you create. Atai processes your project information to provide the service but does not claim ownership of your personal information, ideas, or project content.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data used to train AI models?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atai relies on third-party AI providers to process information and provide platform functionality. Whether those providers retain or use submitted data for model improvement depends on their own terms. Atai does not independently use your data to train AI models.",
      },
    },
    {
      "@type": "Question",
      name: "Can I delete my account and data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can request account deletion through your account settings or by contacting support@atai.ink. Deletion removes your ability to log in and strips personally identifiable information from your account. Some information may be retained where required by law or legitimate business records.",
      },
    },
    {
      "@type": "Question",
      name: "Does Atai use cookies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Atai uses essential cookies for authentication and session management. The session cookie is httpOnly, secure, and expires after 30 days. We also use analytics tools to understand how the platform is used.",
      },
    },
    {
      "@type": "Question",
      name: "How do I contact Atai about privacy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Contact us at support@atai.ink, by phone or WhatsApp at +256761819885, or through our YouTube channel at https://www.youtube.com/@mirrorsiteai.",
      },
    },
  ],
}

const tocSections = [
  { id: "about", label: "1. About This Policy" },
  { id: "who-we-are", label: "2. Who We Are" },
  { id: "info-collect", label: "3. Information We Collect" },
  { id: "info-provide", label: "4. Information You Provide" },
  { id: "project-ai", label: "5. Project, Prompt & AI Data" },
  { id: "website-analysis", label: "6. Website Analysis Data" },
  { id: "payment", label: "7. Payment & Billing Information" },
  { id: "referral", label: "8. Referral Information" },
  { id: "auto-collect", label: "9. Automatically Collected Information" },
  { id: "cookies", label: "10. Cookies" },
  { id: "how-use", label: "11. How We Use Your Information" },
  { id: "ai-processing", label: "12. AI Processing" },
  { id: "sharing", label: "13. How Information Is Shared" },
  { id: "third-party", label: "14. Third-Party Service Providers" },
  { id: "security", label: "15. Data Security" },
  { id: "retention", label: "16. Data Retention" },
  { id: "deletion", label: "17. Account & Data Deletion" },
  { id: "rights", label: "18. Your Privacy Rights" },
  { id: "children", label: "19. Children's Privacy" },
  { id: "international", label: "20. International Data Processing" },
  { id: "changes", label: "21. Changes to This Policy" },
  { id: "contact", label: "22. Contact Us" },
  { id: "faq", label: "Privacy FAQ" },
]

const faqItems = [
  {
    q: "What information does Atai collect?",
    a: "Atai collects account information (name, email, authentication details), project information (ideas, prompts, generated applications), billing information (transaction records via payment providers), technical information (IP address, browser type, device info), and usage data necessary to operate the service.",
  },
  {
    q: "Does Atai sell my personal information?",
    a: "No. Atai does not sell personal information to third parties under any circumstances. Information is shared only with service providers necessary to operate the platform.",
  },
  {
    q: "Who owns my projects and business data?",
    a: "You do. You retain ownership of the content you submit and the applications you create. Atai processes your project information to provide the service but does not claim ownership of your ideas or project content.",
  },
  {
    q: "Does Atai store my projects?",
    a: "Yes. Atai stores project information including your ideas, prompts, website references, generated specifications, application code, and project metadata. This is stored to provide the service and maintain your project history.",
  },
  {
    q: "Does Atai send my project data to AI providers?",
    a: "Yes. Atai transmits project inputs (prompts, ideas, website analysis data, and project context) to third-party AI infrastructure providers when necessary to generate applications and provide platform functionality.",
  },
  {
    q: "Is my data used to train AI models?",
    a: "Atai relies on third-party AI providers to process information. Whether those providers retain or use submitted data for model improvement depends on their own terms. Atai does not independently use your data to train AI models.",
  },
  {
    q: "Does Atai collect payment card information?",
    a: "No. Atai does not directly collect or store card numbers. Payments are processed via secure providers (Dodo Payments, MTN, and Airtel). Atai receives transaction confirmation data (transaction ID, amount, status) but not raw card details.",
  },
  {
    q: "Can I delete my account and data?",
    a: "Yes. You can request account deletion through your account settings or by contacting support@atai.ink. Deletion removes your ability to log in and strips personally identifiable information. Some data may be retained where required by law.",
  },
  {
    q: "Does Atai use cookies?",
    a: "Yes. Atai uses essential cookies for authentication (session cookies) and security. The session cookie is httpOnly, secure, and expires after 30 days. We also use analytics to understand how the platform is used.",
  },
  {
    q: "Is my information shared with third parties?",
    a: "Atai shares information only with service providers necessary to operate the platform, including hosting, database, AI processing, website analysis, email, payment, and analytics providers. We do not sell your data.",
  },
  {
    q: "How long does Atai keep my information?",
    a: "Atai retains information for as long as reasonably necessary to provide the service, maintain legitimate business records, comply with legal requirements, and prevent abuse. Session tokens expire after 30 days.",
  },
  {
    q: "How do I contact Atai about privacy?",
    a: "Email support@atai.ink, call or WhatsApp +256761819885, or visit our YouTube channel at https://www.youtube.com/@mirrorsiteai.",
  },
]

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(privacyPageStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />

      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />

        <SiteHeader activePage="/privacy" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }]} />

        {/* PAGE HEADER */}
        <section className="mx-auto max-w-4xl px-6 pt-12 pb-8 lg:px-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="size-5 text-primary" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Legal</p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground max-w-2xl">
            This Privacy Policy explains how Atai collects, uses, stores, protects, and shares information when you use our platform to build and grow your business.
          </p>
          <p className="mt-3 font-mono text-sm text-muted-foreground">Last Updated: September 21, 2026</p>
        </section>

        {/* PRIVACY AT A GLANCE */}
        <section className="mx-auto max-w-4xl px-6 pb-12 lg:px-10">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-lg font-semibold mb-3">Privacy at a Glance</h2>
            <p className="text-sm leading-6 text-muted-foreground mb-4">
              We collect the information needed to power your account, build your applications, process payments, keep you secure, and improve the platform. Here is the short version:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We collect information you provide and some information automatically as you use the platform.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We use your data to provide the service — not to sell it.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We do not sell your personal information. Ever.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Your projects, ideas, and business content belong to you.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Third-party providers may process some information to deliver platform features.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You can access, correct, and delete your data at any time.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Read this Policy alongside the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> for the complete picture.</li>
            </ul>
          </div>
        </section>

        {/* TABLE OF CONTENTS */}
        <section className="mx-auto max-w-4xl px-6 pb-8 lg:px-10">
          <details open className="rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
              Table of Contents
              <span className="ml-4 shrink-0 text-muted-foreground">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
            </summary>
            <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {tocSections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors py-0.5">{s.label}</a>
              ))}
            </div>
          </details>
        </section>

        {/* CONTENT */}
        <article className="mx-auto max-w-4xl px-6 pb-24 lg:px-10 prose-custom">

          {/* 1. About This Policy */}
          <section id="about" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> 1. About This Privacy Policy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>This Privacy Policy describes how Atai handles your information when you visit the website, create an account, use the platform, create and build projects, submit prompts or website references, use AI features, purchase a plan or credits, participate in referrals, or contact support.</p>
              <p>The information we process depends on how you interact with the platform. Separate notices may apply to specific features where required by law.</p>
              <p>By using Atai, you acknowledge that you have read and understood this Privacy Policy. We encourage you to review this Policy together with the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> regularly.</p>
            </div>
          </section>

          {/* 2. Who We Are */}
          <section id="who-we-are" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Users className="size-5 text-primary" /> 2. Who We Are
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai is a product created and operated by <strong className="text-foreground">ATAI — Advanced Technologies and AI Enterprises</strong>. We build AI-powered technology that transforms complex technical workflows into accessible, automated experiences — making it possible for anyone with a great idea to launch and grow a real business.</p>
              <p>Our platform is available at <a href="https://atai.ink" className="text-primary hover:underline">atai.ink</a>.</p>
              <p>For any privacy-related questions, contact us at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a>.</p>
            </div>
          </section>

          {/* 3. Information We Collect */}
          <section id="info-collect" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Eye className="size-5 text-primary" /> 3. Information We Collect
            </h2>
            <p className="text-base leading-7 text-muted-foreground mb-6">Atai processes different categories of information depending on how you use the platform:</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Key,
                  title: "Account Information",
                  items: ["Email address", "Name", "Authentication method (password or Google)", "Google ID (if using Google sign-in)", "Profile image URL (if using Google)", "Email verification status", "Account status and role", "Referral code"],
                },
                {
                  icon: Database,
                  title: "Project Information",
                  items: ["Project name and description", "Project mode (website or idea)", "Source URLs submitted", "Ideas, prompts, and requirements", "Project preferences and settings", "Generated specifications", "Generated application code", "Build history"],
                },
                {
                  icon: Cpu,
                  title: "AI & Processing Data",
                  items: ["Prompts and instructions", "Website analysis results", "Generated application plans", "Conversation history with AI", "Build summaries and outputs"],
                },
                {
                  icon: CreditCard,
                  title: "Billing & Transaction Information",
                  items: ["Credit balance and history", "Plan subscription details", "Payment references and transaction IDs", "Transaction status and amounts", "Package or plan selections"],
                },
                {
                  icon: Globe,
                  title: "Website Analysis Data",
                  items: ["Submitted URLs", "Crawled page content (publicly accessible)", "Page structure and navigation", "Screenshots", "Visual patterns and layout information"],
                },
                {
                  icon: Server,
                  title: "Technical Information",
                  items: ["IP address", "Browser type and version", "Device type and operating system", "Session identifiers", "Access timestamps", "Error logs"],
                },
              ].map(({ icon: Icon, title, items }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="size-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">{title}</h3>
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

          {/* 4. Information You Provide */}
          <section id="info-provide" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Send className="size-5 text-primary" /> 4. Information You Provide
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>You voluntarily provide information when you:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Create an account (email, name, password)</li>
                <li>Complete your profile</li>
                <li>Submit prompts, ideas, or business requirements</li>
                <li>Provide website URLs for analysis and reference</li>
                <li>Create and configure projects</li>
                <li>Upload files or assets</li>
                <li>Submit support requests or feedback</li>
                <li>Participate in the referral program</li>
                <li>Purchase a plan or credits</li>
              </ul>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm">Please do not submit sensitive personal information about third parties into prompts, projects, or uploads unless it is necessary for your project and you are authorized to provide it.</p>
              </div>
            </div>
          </section>

          {/* 5. Project and AI Data */}
          <section id="project-ai" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Cpu className="size-5 text-primary" /> 5. Project, Prompt & AI Processing
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>When you submit ideas, prompts, business requirements, project information, website references, or other development content to Atai, we process that information to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Understand the application or business you want to build</li>
                <li>Create structured project context and planning</li>
                <li>Generate project plans and specifications</li>
                <li>Generate application code, UI, and infrastructure configuration</li>
                <li>Provide development previews and deployment</li>
                <li>Support AI-assisted iteration after launch</li>
                <li>Maintain your project state and history</li>
              </ul>
              <p>Your prompts and project inputs may be transmitted to third-party AI infrastructure providers when necessary to provide the requested functionality. The specific providers and processing arrangements may change as the platform evolves.</p>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground mb-1">AI Training</p>
                <p className="text-sm text-muted-foreground">Atai relies on third-party AI providers to process information and power platform features. Whether those providers retain or use submitted data for their own model improvement depends on their terms and configuration. Atai does not independently use your data to train AI models.</p>
              </div>
            </div>
          </section>

          {/* 6. Website Analysis */}
          <section id="website-analysis" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Globe className="size-5 text-primary" /> 6. Website Analysis Data
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>When you submit a website URL for analysis, Atai uses a third-party website analysis service to crawl and analyze publicly accessible content from that URL. The system extracts page structure, layout, navigation, content patterns, and visual information to create structured development context.</p>
              <p>This data is used to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Understand the reference product you want to build from</li>
                <li>Generate an application plan and specification</li>
                <li>Inform the build process</li>
              </ul>
              <p>Website analysis is performed on publicly accessible content only. You are responsible for ensuring you have the appropriate rights to submit any URL for analysis.</p>
            </div>
          </section>

          {/* 7. Payment Information */}
          <section id="payment" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <CreditCard className="size-5 text-primary" /> 7. Payment & Billing Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai processes payments through Dodo Payments and mobile money providers (MTN and Airtel). <strong className="text-foreground">Atai does not directly collect or store credit card numbers.</strong></p>
              <p>Atai receives the following transaction confirmation data from payment providers:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Transaction ID and reference</li>
                <li>Amount and currency</li>
                <li>Payment status</li>
                <li>Timestamps</li>
                <li>Plan or package selected</li>
              </ul>
              <p>This information is used to verify payments, credit your account, resolve disputes, and maintain financial records. Payment provider data is governed by the applicable provider&apos;s privacy policy.</p>
            </div>
          </section>

          {/* 8. Referral Information */}
          <section id="referral" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Users className="size-5 text-primary" /> 8. Referral Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>If you participate in the Atai referral program, we collect and process referral information including your referral code, the accounts registered using your code, and the referral reward credits earned.</p>
              <p>We use this information to track referral eligibility, apply earned credits to your account, and prevent fraudulent referral activity.</p>
            </div>
          </section>

          {/* 9. Automatically Collected Information */}
          <section id="auto-collect" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Server className="size-5 text-primary" /> 9. Automatically Collected Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>When you use Atai, we automatically collect certain technical information, including:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Device type and operating system</li>
                <li>Pages visited and actions taken on the platform</li>
                <li>Session identifiers and access timestamps</li>
                <li>Error and performance data</li>
              </ul>
              <p>This information is used to operate the platform securely, diagnose technical issues, prevent abuse, and improve performance and user experience.</p>
            </div>
          </section>

          {/* 10. Cookies */}
          <section id="cookies" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Cookie className="size-5 text-primary" /> 10. Cookies
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai uses cookies and similar technologies to operate the platform effectively:</p>
              <div className="rounded-lg border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground mb-2">Session Cookie</p>
                <p className="text-sm text-muted-foreground">Used for authentication and session management. This cookie is httpOnly, secure, and expires after 30 days. It is essential for keeping you logged in to your account.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground mb-2">Analytics</p>
                <p className="text-sm text-muted-foreground">Atai uses analytics tools (including Vercel Analytics and PostHog) in production to understand how the platform is used. Analytics data helps us improve the experience for every user. This data is collected at an aggregate level and is not used to identify individual users.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground mb-2">Preferences</p>
                <p className="text-sm text-muted-foreground">We store user preferences such as theme selection in localStorage to maintain a consistent experience across sessions.</p>
              </div>
            </div>
          </section>

          {/* 11. How We Use Your Information */}
          <section id="how-use" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Eye className="size-5 text-primary" /> 11. How We Use Your Information
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Create and manage your account</li>
                <li>Provide, operate, and improve the Atai platform</li>
                <li>Process your project and application build requests</li>
                <li>Power AI planning, generation, and analysis features</li>
                <li>Process payments and manage your plan or credits</li>
                <li>Deliver email notifications and platform communications</li>
                <li>Provide customer support and respond to enquiries</li>
                <li>Maintain platform security and prevent fraud and abuse</li>
                <li>Comply with applicable legal obligations</li>
                <li>Improve platform performance, reliability, and user experience</li>
                <li>Analyze usage patterns to guide product development</li>
              </ul>
              <p>We do not use your information for advertising to third parties or sell it to data brokers.</p>
            </div>
          </section>

          {/* 12. AI Processing */}
          <section id="ai-processing" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Cpu className="size-5 text-primary" /> 12. AI Processing
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai uses advanced AI systems — including third-party AI providers via OpenRouter — to power application planning, generation, and iteration. When you submit a prompt, idea, or project input, that information is transmitted to the AI processing infrastructure necessary to generate your application.</p>
              <p>We select AI providers based on performance, security, and reliability. The specific providers used may change as the platform evolves.</p>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground mb-1">Important note on AI training</p>
                <p className="text-sm text-muted-foreground">Atai does not independently use your project data to train AI models. Third-party AI providers may have their own data retention and usage policies — their practices are governed by their terms, not solely by ours.</p>
              </div>
            </div>
          </section>

          {/* 13. How Information Is Shared */}
          <section id="sharing" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Users className="size-5 text-primary" /> 13. How Information Is Shared
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>We share information only in the following circumstances:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong className="text-foreground">Service providers.</strong> We share necessary information with third-party providers who help us operate the platform (see Section 14).</li>
                <li><strong className="text-foreground">Legal compliance.</strong> We may disclose information if required to do so by law, court order, or governmental authority.</li>
                <li><strong className="text-foreground">Safety and security.</strong> We may share information to protect the rights, property, or safety of Atai, our users, or the public.</li>
                <li><strong className="text-foreground">Terms enforcement.</strong> We may share information to investigate and enforce violations of our Terms of Service.</li>
                <li><strong className="text-foreground">Business transfers.</strong> In the event of a merger, acquisition, or sale of assets, user information may be transferred as part of that transaction, subject to applicable privacy protections.</li>
              </ul>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground mb-1">We do not sell your data.</p>
                <p className="text-sm text-muted-foreground">Atai does not sell personal information to third parties for advertising or any other purpose. Your data is used to power your experience on the platform — full stop.</p>
              </div>
            </div>
          </section>

          {/* 14. Third-Party Providers */}
          <section id="third-party" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Server className="size-5 text-primary" /> 14. Third-Party Service Providers
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai works with carefully selected third-party providers to deliver a high-quality platform. These providers may process certain information on our behalf:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { category: "Hosting & Infrastructure", desc: "Vercel (platform hosting and deployment)" },
                  { category: "Database", desc: "MongoDB Atlas (application database)" },
                  { category: "AI Processing", desc: "OpenRouter (AI model routing and generation)" },
                  { category: "Application Build", desc: "Totalum (application generation and infrastructure)" },
                  { category: "Website Analysis", desc: "Firecrawl (website crawling and analysis)" },
                  { category: "Payment Processing", desc: "Dodo Payments, MTN, Airtel (payments)" },
                  { category: "Email", desc: "Resend (transactional email delivery)" },
                  { category: "Analytics", desc: "Vercel Analytics, PostHog (usage analytics)" },
                  { category: "Authentication", desc: "Atai platform auth (session management)" },
                  { category: "Storage", desc: "Cloudflare R2 / S3-compatible (file storage)" },
                ].map(({ category, desc }) => (
                  <div key={category} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-medium text-foreground">{category}</p>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                ))}
              </div>
              <p>These providers are selected for reliability, security, and data protection standards. They are authorized to process information only as necessary to deliver the service. The specific providers used may change over time.</p>
            </div>
          </section>

          {/* 15. Data Security */}
          <section id="security" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Lock className="size-5 text-primary" /> 15. Data Security
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai implements technical and organizational security measures to protect your information, including:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Password hashing using industry-standard algorithms</li>
                <li>Secure, httpOnly session tokens with expiry</li>
                <li>Rate limiting and abuse prevention controls</li>
                <li>HTTPS encryption for all data in transit</li>
                <li>Access controls limiting internal data access to authorized personnel</li>
                <li>Infrastructure security through our hosting and database providers</li>
              </ul>
              <p>No method of data transmission or storage is 100% secure. While we implement strong measures, we cannot guarantee absolute security. If you suspect unauthorized access to your account, contact us immediately at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a>.</p>
            </div>
          </section>

          {/* 16. Data Retention */}
          <section id="retention" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Server className="size-5 text-primary" /> 16. Data Retention
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai retains information for as long as reasonably necessary to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide and improve the service</li>
                <li>Maintain your account and project history</li>
                <li>Maintain legitimate financial and business records</li>
                <li>Comply with applicable legal requirements</li>
                <li>Resolve disputes and prevent abuse</li>
                <li>Enforce these agreements</li>
              </ul>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Session tokens expire after 30 days</li>
                <li>Account and project data is retained while your account is active</li>
                <li>On account deletion, personally identifiable information is stripped from your account record</li>
                <li>Some information (e.g. financial transaction records) may be retained longer where required by law</li>
              </ul>
            </div>
          </section>

          {/* 17. Deletion */}
          <section id="deletion" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Trash2 className="size-5 text-primary" /> 17. Account & Data Deletion
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>You can request account deletion at any time through your account settings or by contacting <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a>.</p>
              <p>Account deletion:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Removes your ability to log in to the platform</li>
                <li>Strips personally identifiable information from your account record</li>
                <li>Removes access to your projects and generated applications</li>
              </ul>
              <p>Some information may be retained after deletion where required by law, for fraud prevention, security, dispute resolution, or legitimate financial record-keeping obligations. We will always be transparent with you about what we retain and why.</p>
            </div>
          </section>

          {/* 18. Your Rights */}
          <section id="rights" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Shield className="size-5 text-primary" /> 18. Your Privacy Rights
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Depending on your location and applicable law, you may have rights including:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong className="text-foreground">Access.</strong> Request a copy of the personal information we hold about you.</li>
                <li><strong className="text-foreground">Correction.</strong> Request correction of inaccurate or incomplete information.</li>
                <li><strong className="text-foreground">Deletion.</strong> Request deletion of your personal information, subject to legal retention requirements.</li>
                <li><strong className="text-foreground">Portability.</strong> Request a portable copy of your data where technically feasible.</li>
                <li><strong className="text-foreground">Restriction.</strong> Request restriction of processing in certain circumstances.</li>
                <li><strong className="text-foreground">Objection.</strong> Object to certain processing activities.</li>
              </ul>
              <p>To exercise any of these rights, contact us at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a>. We will respond to all requests in a timely manner in accordance with applicable law. We will never make it difficult for you to exercise your rights.</p>
            </div>
          </section>

          {/* 19. Children */}
          <section id="children" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Users className="size-5 text-primary" /> 19. Children&apos;s Privacy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai is designed for adults and is not directed at children under the age of 16 (or the applicable age of digital consent in your jurisdiction). We do not knowingly collect personal information from children.</p>
              <p>If you believe a child has created an account or submitted personal information, please contact us at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a> and we will take prompt action to remove that information.</p>
            </div>
          </section>

          {/* 20. International */}
          <section id="international" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Globe className="size-5 text-primary" /> 20. International Data Processing
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>Atai operates globally and serves users around the world. Your information may be processed in countries outside your country of residence, including countries that may have different data protection laws.</p>
              <p>We take steps to ensure that your information is protected regardless of where it is processed. When we work with third-party providers located in other countries, we rely on appropriate safeguards to protect your data.</p>
              <p>By using Atai, you acknowledge that your information may be transferred to and processed in other countries as described in this Privacy Policy.</p>
            </div>
          </section>

          {/* 21. Changes */}
          <section id="changes" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> 21. Changes to This Policy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>We may update this Privacy Policy from time to time. When we make material changes, we will:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Update the &quot;Last Updated&quot; date at the top of this page</li>
                <li>Notify you via email or a platform notification for significant changes</li>
              </ul>
              <p>Your continued use of Atai after the updated Policy becomes effective constitutes your acceptance of the changes. We encourage you to review this Policy regularly.</p>
            </div>
          </section>

          {/* 22. Contact */}
          <section id="contact" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Phone className="size-5 text-primary" /> 22. Contact Us
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>If you have any questions about this Privacy Policy, want to exercise your privacy rights, or have a privacy-related concern, we are here to help:</p>
              <div className="grid gap-4 sm:grid-cols-3 my-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="font-medium text-sm text-foreground mb-2">Email</p>
                  <a href="mailto:support@atai.ink" className="text-sm text-primary hover:underline break-all">support@atai.ink</a>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="font-medium text-sm text-foreground mb-2">Phone / WhatsApp</p>
                  <a href="tel:+256761819885" className="text-sm text-primary hover:underline">+256 761 819 885</a>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="font-medium text-sm text-foreground mb-2">YouTube</p>
                  <a href="https://www.youtube.com/@mirrorsiteai" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">@mirrorsiteai</a>
                </div>
              </div>
              <p>We aim to respond to all privacy enquiries within 5 business days.</p>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-20 mt-16">
            <h2 className="text-2xl font-semibold tracking-tight mb-8 flex items-center gap-3">
              <Shield className="size-5 text-primary" /> Privacy FAQ
            </h2>
            <div className="space-y-4">
              {faqItems.map(({ q, a }) => (
                <details key={q} className="group rounded-xl border border-border bg-card">
                  <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="ml-4 shrink-0 text-muted-foreground">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </span>
                  </summary>
                  <div className="px-6 pb-5 text-sm text-muted-foreground leading-7">{a}</div>
                </details>
              ))}
            </div>
          </section>

        </article>

        <SiteFooter />
      </main>
    </>
  )
}
