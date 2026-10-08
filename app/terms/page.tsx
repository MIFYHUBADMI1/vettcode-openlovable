import type { Metadata } from "next"
import Link from "next/link"
import {
  FileText,
  Shield,
  Users,
  CreditCard,
  Globe,
  Server,
  Eye,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Key,
  Zap,
  AlertCircle,
  Scale,
  ExternalLink,
  Clock,
  Ban,
  Layers3,
  Rocket,
  DollarSign,
  Gift,
  ShieldCheck,
  Lightbulb,
  Handshake,
  Phone,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"

export const metadata: Metadata = {
  title: "Terms of Service | Atai",
  description:
    "Read the Atai Terms of Service. Understand your rights, our commitments, billing, credits, intellectual property, acceptable use, and how we support your business journey.",
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/terms`,
    siteName: "Atai",
    title: "Terms of Service | Atai",
    description:
      "Read the Atai Terms of Service — covering accounts, AI-generated applications, plans, billing, intellectual property, acceptable use, and our commitments to you.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai Terms of Service" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | Atai",
    description: "Read the Atai Terms of Service.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atai Terms of Service" }],
  },
}

const termsPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Atai Terms of Service",
  description: "Terms of Service governing access to and use of Atai — the AI-powered business launch platform.",
  url: `${SITE_URL}/terms`,
  isPartOf: { "@type": "WebSite", name: "Atai", url: SITE_URL },
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Atai?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atai (Advanced Technologies and AI Enterprises) is an AI-powered business launch platform that helps founders, entrepreneurs, and small businesses go from idea to a live, fully functional product — without writing code.",
      },
    },
    {
      "@type": "Question",
      name: "Who owns the application I build with Atai?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You do. Subject to these Terms and applicable third-party rights, you retain full ownership of the application and business you build using Atai. Atai does not claim ownership of your ideas, your brand, or the products you launch.",
      },
    },
    {
      "@type": "Question",
      name: "Is Atai suitable for non-technical founders?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. Atai is designed specifically for non-technical founders, entrepreneurs, startup operators, and small business owners. You do not need a technical background to plan, launch, and grow a real business on Atai.",
      },
    },
    {
      "@type": "Question",
      name: "What are Atai Credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atai Credits are an internal usage unit that powers platform actions such as building applications, analyzing websites, and generating plans. New users receive 500 free credits upon account verification.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Atai to build a commercial business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — that is exactly what Atai is built for. You can use Atai to build and launch commercial products and businesses. You remain responsible for the legality and compliance of your business.",
      },
    },
    {
      "@type": "Question",
      name: "Does Atai take equity in my business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atai does not take automatic equity in your business. In the future, Atai may introduce an optional partnership program for users who achieve significant success using the platform. Any such arrangement will always be disclosed in advance, is entirely optional, and will never be a condition of platform access.",
      },
    },
    {
      "@type": "Question",
      name: "How does Atai support me after I launch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atai is built for the full business lifecycle. After you launch, you can manage customers, monitor revenue, iterate on your product, connect a custom domain, track analytics, and keep building — all from one place. Our support team is reachable at support@atai.ink or +256761819885.",
      },
    },
    {
      "@type": "Question",
      name: "How do I contact Atai?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can reach us by email at support@atai.ink, by phone or WhatsApp at +256761819885, or through our YouTube channel at https://www.youtube.com/@mirrorsiteai.",
      },
    },
  ],
}

const tocSections = [
  { id: "acceptance", label: "1. Acceptance of These Terms" },
  { id: "about", label: "2. About Atai" },
  { id: "eligibility", label: "3. Eligibility" },
  { id: "account", label: "4. Your Account" },
  { id: "service", label: "5. The Atai Platform" },
  { id: "ai-output", label: "6. AI-Generated Applications & Output" },
  { id: "website-analysis", label: "7. Website Analysis" },
  { id: "user-content", label: "8. Your Content" },
  { id: "intellectual-property", label: "9. Intellectual Property" },
  { id: "generated-apps", label: "10. Your Applications & Business" },
  { id: "credits", label: "11. Atai Credits" },
  { id: "pricing", label: "12. Plans & Pricing" },
  { id: "payments", label: "13. Payments" },
  { id: "refunds", label: "14. Refunds" },
  { id: "referrals", label: "15. Referral Program" },
  { id: "partnership", label: "16. Future Partnership Program" },
  { id: "third-party", label: "17. Third-Party Services" },
  { id: "infrastructure", label: "18. Infrastructure & Hosting" },
  { id: "early-access", label: "19. Early Access" },
  { id: "beta", label: "20. Beta Features" },
  { id: "acceptable-use", label: "21. Acceptable Use" },
  { id: "prohibited", label: "22. Prohibited Activities" },
  { id: "security", label: "23. Security" },
  { id: "availability", label: "24. Service Availability" },
  { id: "disclaimers", label: "25. Disclaimers" },
  { id: "liability", label: "26. Limitation of Liability" },
  { id: "indemnification", label: "27. Indemnification" },
  { id: "suspension", label: "28. Account Suspension & Termination" },
  { id: "privacy-ref", label: "29. Privacy" },
  { id: "changes-service", label: "30. Changes to Atai" },
  { id: "changes-terms", label: "31. Changes to These Terms" },
  { id: "governing-law", label: "32. Governing Law & Disputes" },
  { id: "general", label: "33. General Provisions" },
  { id: "contact", label: "34. Contact Us" },
  { id: "faq", label: "Frequently Asked Questions" },
]

const faqItems = [
  {
    q: "What is Atai?",
    a: "Atai (Advanced Technologies and AI Enterprises) is an AI-powered business launch platform that helps founders, entrepreneurs, and small businesses go from idea to a live, fully functional product — without writing code.",
  },
  {
    q: "Who owns the application I build with Atai?",
    a: "You do. Subject to these Terms and applicable third-party rights, you retain full ownership of the application and business you build using Atai. Atai does not claim ownership of your ideas, your brand, or the products you launch.",
  },
  {
    q: "Is Atai suitable for non-technical founders?",
    a: "Absolutely. Atai is designed for non-technical founders, entrepreneurs, startup operators, and small business owners. No coding required.",
  },
  {
    q: "What are Atai Credits?",
    a: "Atai Credits power platform actions such as building applications, analyzing websites, and generating plans. New users receive 500 free credits upon account verification.",
  },
  {
    q: "Can I use Atai to build a commercial business?",
    a: "Yes — that is exactly what Atai is built for. You remain responsible for the legality and compliance of your business.",
  },
  {
    q: "Does Atai take equity in my business?",
    a: "No — not automatically and never as a condition of service. In the future, Atai may introduce an optional partnership program for high-growth users. Any arrangement will be disclosed in advance, is entirely voluntary, and will never affect your platform access.",
  },
  {
    q: "How does Atai support me after launch?",
    a: "After launch you can manage customers, monitor revenue, iterate, connect a custom domain, track analytics, and keep building — all from one place. Support is available at support@atai.ink or +256761819885.",
  },
  {
    q: "What plans does Atai offer?",
    a: "Atai offers six plans: Free, Explorer, Launch, Growth, Scale, and Enterprise. Full plan details are on the Atai pricing page.",
  },
  {
    q: "How do I get support?",
    a: "Email support@atai.ink, WhatsApp/call +256761819885, or visit our YouTube channel at https://www.youtube.com/@mirrorsiteai.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. Atai supports custom domain connections on paid plans. You manage domain, SSL, and SEO directly from your workspace.",
  },
]

function Section({
  id,
  number,
  icon: Icon,
  title,
  children,
}: {
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
      <div className="space-y-4 text-base leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(termsPageStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />

      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />

        <SiteHeader activePage="/terms" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }]} />

        {/* PAGE HEADER */}
        <section className="mx-auto max-w-4xl px-6 pt-12 pb-8 lg:px-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Legal</p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground max-w-2xl">
            These Terms govern your access to and use of Atai — the AI-powered platform that helps you turn ideas into real, live businesses.
          </p>
          <p className="mt-3 font-mono text-sm text-muted-foreground">Last Updated: September 21, 2026</p>
        </section>

        {/* QUICK SUMMARY */}
        <section className="mx-auto max-w-4xl px-6 pb-12 lg:px-10">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-lg font-semibold mb-3">Before You Start Building</h2>
            <p className="text-sm leading-6 text-muted-foreground mb-4">
              Atai is here to help you build, launch, and grow a real business — no code required. Here is a quick summary. The full legal terms are below.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You own everything you build — your ideas, your brand, your application.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Atai is designed to give you every advantage to succeed. We want to see you win.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> You are responsible for how you use the platform and what you build.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> AI-generated output should be reviewed before going live — we make it strong, you make it yours.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Credits and subscriptions are governed by the pricing terms below.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> We may update the platform and these Terms — we will always keep you informed.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Questions? Reach us at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a> or <a href="tel:+256761819885" className="text-primary hover:underline">+256761819885</a>.</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground italic">This summary is for convenience only. The legally operative Terms are in the sections below.</p>
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

          <Section id="acceptance" number="1" icon={CheckCircle2} title="Acceptance of These Terms">
            <p>By accessing or using Atai (&quot;the Service&quot; or &quot;the Platform&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Service.</p>
            <p>These Terms form a legally binding agreement between you and <strong className="text-foreground">ATAI — Advanced Technologies and AI Enterprises</strong> (&quot;ATAI,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).</p>
            <p>The following additional policies are incorporated by reference:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="text-primary hover:underline">Refund Policy</Link></li>
              <li><Link href="/database-terms" className="text-primary hover:underline">Database &amp; Infrastructure Terms</Link></li>
            </ul>
          </Section>

          <Section id="about" number="2" icon={Layers3} title="About Atai">
            <p>Atai — short for Advanced Technologies and AI Enterprises — is an AI-powered business launch platform. We exist to eliminate the technical barrier between a great idea and a real, live business. Whether you are a first-time founder, a seasoned entrepreneur, or a small business owner looking to go digital, Atai gives you everything you need: plan, build, launch, manage, and grow — all in one place.</p>
            <p>We believe that every great idea deserves a real shot. That belief is built into every feature we ship.</p>
            <p>Depending on features and plan availability, Atai may:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Help you refine and plan your business idea with AI collaboration</li>
              <li>Analyze reference websites to understand the product space</li>
              <li>Generate full-stack application code, UI, and infrastructure</li>
              <li>Set up authentication, database, storage, hosting, and payment scaffolding automatically</li>
              <li>Deploy your application live with a subdomain or custom domain</li>
              <li>Provide a business control panel for managing customers, revenue, and operations</li>
              <li>Enable ongoing AI-assisted iteration after launch</li>
            </ul>
            <p>Features may vary by plan, product version, project configuration, and availability. We are constantly improving the platform to deliver more value to every builder on Atai.</p>
          </Section>

          <Section id="eligibility" number="3" icon={Users} title="Eligibility">
            <p>You may use Atai if you are legally capable of entering into a binding agreement and are permitted to do so under applicable law.</p>
            <p>If you are using Atai on behalf of an organization, startup, or business, you represent that you have the authority to bind that organization to these Terms.</p>
            <p>Atai is open to founders, entrepreneurs, startups, small and medium businesses, product managers, co-founders, and anyone with an idea they want to turn into reality.</p>
          </Section>

          <Section id="account" number="4" icon={Key} title="Your Account">
            <p>To access the full platform, you need a free Atai account. When you register, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Keep your credentials secure and confidential</li>
              <li>Accept responsibility for all activity under your account</li>
              <li>Notify us immediately if you suspect unauthorized access</li>
            </ul>
            <p>You may sign in via email and password or via Google. Account verification unlocks your 500 free credits to start building straight away.</p>
            <p>You must not share account credentials, create fraudulent accounts, impersonate others, or attempt unauthorized access to any account or system.</p>
          </Section>

          <Section id="service" number="5" icon={Zap} title="The Atai Platform">
            <p>The Atai platform is your complete business-building environment. From your first idea to a live, growing business, we are with you at every stage:</p>
            <div className="grid gap-3 sm:grid-cols-2 my-4">
              {[
                { step: "01 — Idea", desc: "Share your business vision. Describe what you want to build in plain language." },
                { step: "02 — Plan", desc: "Collaborate with AI to map out your product, users, features, and business model before a single line of code is written." },
                { step: "03 — Build", desc: "AI agents generate your full-stack application — frontend, backend, auth, database, and payment scaffolding included." },
                { step: "04 — Launch", desc: "Deploy live with a subdomain or your own domain. Infrastructure configured automatically." },
                { step: "05 — Manage", desc: "Run your business from one control panel — customers, revenue, analytics, and operations." },
                { step: "06 — Grow", desc: "Iterate with AI, track growth, and scale your product as your business expands." },
              ].map(({ step, desc }) => (
                <div key={step} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-mono text-xs text-primary mb-1">{step}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="ai-output" number="6" icon={Cpu} title="AI-Generated Applications & Output">
            <p>Atai uses advanced AI systems to generate application code, user interfaces, database structures, infrastructure configurations, business plans, and other outputs based on your inputs.</p>
            <p>We take output quality seriously. The platform includes AI quality gates and production-readiness checks designed to make every generated application immediately launchable with real users in mind.</p>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">AI output is powerful — your review makes it perfect.</p>
                <p>Our generated applications are designed to be strong starting points ready for production. Before going live with real users or real transactions, we recommend reviewing the application, testing your key flows, and verifying it meets your specific business needs. No platform can predict every nuance of your unique vision — that final step is yours.</p>
              </div>
            </div>
            <p>As a user of Atai, your role includes:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Reviewing your generated application before going live</li>
              <li>Testing key user flows and business logic</li>
              <li>Configuring your production environment and secrets</li>
              <li>Inspecting third-party integrations and dependencies</li>
              <li>Verifying data handling and security configuration</li>
            </ul>
            <p>Our support team is available to help you through the review and launch process. We are in your corner.</p>
          </Section>

          <Section id="website-analysis" number="7" icon={Globe} title="Website Analysis">
            <p>Atai may allow you to submit a URL as a reference or starting point for your project. When you do so, you represent that you have the appropriate rights, permissions, or lawful basis to analyze and reference that content.</p>
            <p>Website analysis is a tool for inspiration and reference — not for reproducing businesses or content you do not own. You must not use Atai to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Infringe copyright, trademark, or intellectual property rights</li>
              <li>Bypass paywalls, authentication, or access controls</li>
              <li>Collect personal data from third-party websites without authorization</li>
              <li>Violate applicable website terms of service</li>
              <li>Perform unauthorized scraping or automated data collection</li>
            </ul>
            <p>Submitting a URL does not transfer any rights in that website to you or to Atai. You remain responsible for ensuring your use of reference materials complies with applicable law.</p>
          </Section>

          <Section id="user-content" number="8" icon={FileText} title="Your Content">
            <p>&quot;Your Content&quot; includes everything you submit to Atai — your ideas, prompts, business descriptions, uploaded files, project configurations, code, images, and any other materials you provide.</p>
            <p>Your Content belongs to you. You grant Atai the limited rights reasonably necessary to host, process, transmit, and use your content for the purpose of providing and improving the Service — nothing beyond that.</p>
            <p>You are responsible for ensuring you have the right to submit any content you provide. Please do not submit sensitive personal information about third parties unless it is necessary and you are authorized to do so.</p>
          </Section>

          <Section id="intellectual-property" number="9" icon={Shield} title="Intellectual Property">
            <h3 className="text-base font-medium text-foreground mt-4">Atai platform</h3>
            <p>The Atai platform, technology, interfaces, branding, and proprietary systems are owned by or licensed to ATAI. These Terms do not grant you rights to use Atai&apos;s trademarks or platform IP beyond what is necessary to use the Service.</p>

            <h3 className="text-base font-medium text-foreground mt-4">Your content and ideas</h3>
            <p>You retain all rights to your ideas, business concepts, prompts, and creative work. Atai does not acquire ownership of any of it through your use of the platform.</p>

            <h3 className="text-base font-medium text-foreground mt-4">Your generated application</h3>
            <p>Subject to these Terms and applicable third-party rights, you own the application you build on Atai. Third-party libraries and dependencies remain owned by their respective owners under their own licenses.</p>

            <h3 className="text-base font-medium text-foreground mt-4">Third-party content</h3>
            <p>Third-party materials incorporated into generated output remain owned by their respective owners. Atai does not grant you licensing rights to third-party content beyond what those owners have made available.</p>
          </Section>

          <Section id="generated-apps" number="10" icon={Rocket} title="Your Applications & Business">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 mb-4">
              <p className="text-sm font-medium text-foreground mb-1">Your business is yours.</p>
              <p className="text-sm text-muted-foreground">Subject to these Terms and applicable third-party rights, you own the application and business you build using Atai. We do not claim your idea, your brand, your customers, or your revenue. Atai is a platform that works for you.</p>
            </div>
            <p>This means:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You own the application you create</li>
              <li>You own your customer relationships and business data</li>
              <li>Third-party libraries remain owned by their respective owners</li>
              <li>Atai does not take a share of your business revenue</li>
              <li>You are responsible for the legal compliance of your business and application</li>
            </ul>
            <p>Atai may retain project data for service operation, backups, and support as described in the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
          </Section>

          <Section id="credits" number="11" icon={CreditCard} title="Atai Credits">
            <p>Atai Credits are the internal usage unit that powers the platform. Credits are consumed when you build applications, run AI planning sessions, analyze websites, and perform other platform actions.</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>New users receive 500 free credits upon account verification</li>
              <li>Credits are included in paid subscription plans</li>
              <li>Additional credits can be purchased</li>
              <li>Credits can be earned through the referral program</li>
            </ul>
            <p>Credits:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Have no cash value unless required by applicable law</li>
              <li>Are not currency and cannot be redeemed for money</li>
              <li>Cannot be transferred between accounts unless the platform explicitly permits it</li>
              <li>Are consumed when Atai performs actions on your behalf</li>
            </ul>
          </Section>

          <Section id="pricing" number="12" icon={DollarSign} title="Plans & Pricing">
            <p>Atai offers six subscription plans designed to meet you wherever you are in your business journey:</p>
            <div className="grid gap-3 sm:grid-cols-2 my-4">
              {[
                { plan: "Free", desc: "1 project, 1 build attempt, 30-day hosted trial. Perfect for exploring the platform." },
                { plan: "Explorer — $20/mo", desc: "3 projects, 5 builds/month, full database management, custom domain, standard support." },
                { plan: "Launch — $99/mo", desc: "10 projects, unlimited builds, database with backups, payment integration, priority builds, 2 team seats." },
                { plan: "Growth — $399/mo", desc: "25 projects, unlimited builds, advanced database, analytics, payment integration, 5 team seats." },
                { plan: "Scale — $599/mo", desc: "Unlimited projects, unlimited builds, dedicated infrastructure, 10 team seats, direct support." },
                { plan: "Enterprise", desc: "Everything in Scale plus SLA uptime, dedicated account manager, white-glove onboarding, and custom pricing." },
              ].map(({ plan, desc }) => (
                <div key={plan} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-medium text-sm text-foreground">{plan}</p>
                  <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                </div>
              ))}
            </div>
            <p>All paid plans are currently available at promotional prices — the current discounted rate and original list price are both shown on the <Link href="/pricing" className="text-primary hover:underline">Atai pricing page</Link>. Annual plans include free months. Prices and plan features may change with notice.</p>
          </Section>

          <Section id="payments" number="13" icon={CreditCard} title="Payments">
            <p>Atai processes payments via Dodo Payments and mobile money providers (MTN and Airtel). When you make a payment:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You authorize the payment for the selected plan or credit package</li>
              <li>Payment is processed through the applicable payment provider</li>
              <li>Credits or plan benefits are applied to your account upon successful verification</li>
              <li>Failed, duplicate, or fraudulent transactions will be investigated and resolved</li>
            </ul>
            <p>You are responsible for ensuring your payment details are accurate and sufficient funds are available. Atai does not directly collect or store card numbers — payment details are handled by our secure payment processors.</p>
          </Section>

          <Section id="refunds" number="14" icon={AlertCircle} title="Refunds">
            <p>We want every experience on Atai to be worth your investment. Refund eligibility depends on the purchase type, payment method, and applicable law. Full details are in the <Link href="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Failed payments that charged without awarding credits are eligible for investigation and resolution</li>
              <li>Duplicate transactions are eligible for refund of the duplicate amount</li>
              <li>Credits consumed through platform actions (builds, analysis, generation) are not refundable</li>
              <li>Promotional and referral credits have no cash value and are not refundable</li>
            </ul>
            <p>If you have any issue with a payment, contact us at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a> — we will make it right.</p>
          </Section>

          <Section id="referrals" number="15" icon={Gift} title="Referral Program">
            <p>Atai&apos;s referral program lets you earn credits by bringing other founders onto the platform. Every person you bring along makes the Atai community stronger — and we reward that.</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>When a referred user registers with your referral code and verifies their account, you earn <strong className="text-foreground">500 credits</strong></li>
              <li>When the referred user reaches a qualifying build threshold, you earn an additional <strong className="text-foreground">1,500 credits</strong></li>
              <li>Maximum referral reward per referred user: 2,000 credits</li>
            </ul>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Referral rewards are promotional credits</p>
                <p>Referral credits have no cash value and cannot be exchanged for money. Self-referral, fraudulent referral chains, and abuse of the program may result in forfeiture of rewards and account suspension.</p>
              </div>
            </div>
          </Section>

          <Section id="partnership" number="16" icon={Handshake} title="Future Partnership Program">
            <p>Atai&apos;s mission is to help you build and grow a real, thriving business. As part of that long-term vision, we are exploring a future voluntary partnership program for users who achieve significant business success on the platform.</p>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
              <p className="text-sm font-medium text-foreground mb-2">What this may mean for you</p>
              <p className="text-sm text-muted-foreground">In the future, Atai may introduce an optional program where users who build exceptional, high-growth businesses using the platform may be invited into a partnership arrangement. Under such an arrangement, Atai may propose a reservation of up to <strong className="text-foreground">15%</strong> of the business — not as a fee, but as a recognition of the platform&apos;s contribution to that success. Think of it as sharing in the journey together.</p>
            </div>
            <p>This is important to understand clearly:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong className="text-foreground">No automatic equity.</strong> Atai does not take any stake in your business automatically or as a condition of using the platform today.</li>
              <li><strong className="text-foreground">Always optional.</strong> Any partnership arrangement will be entirely voluntary and require a separate, explicit written agreement between you and Atai.</li>
              <li><strong className="text-foreground">Always disclosed in advance.</strong> If Atai introduces such a program, it will be clearly announced and you will have the opportunity to opt in or decline.</li>
              <li><strong className="text-foreground">Never a condition of service.</strong> Declining any future partnership arrangement will never affect your access to, or continued use of, the Atai platform.</li>
            </ul>
            <p>We are genuinely excited about what you are building. If and when this program launches, it will be designed to celebrate mutual success — not to claim what is rightfully yours.</p>
          </Section>

          <Section id="third-party" number="17" icon={ExternalLink} title="Third-Party Services">
            <p>Atai relies on best-in-class third-party services to deliver the platform reliably and at scale. These include providers of:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>AI processing and code generation</li>
              <li>Application build and infrastructure (Totalum)</li>
              <li>Website analysis and crawling (Firecrawl)</li>
              <li>Database hosting and management</li>
              <li>Authentication services</li>
              <li>Payment processing (Dodo Payments)</li>
              <li>File storage and asset management</li>
              <li>Email delivery (Resend)</li>
              <li>Application hosting and deployment</li>
              <li>Analytics and monitoring (PostHog)</li>
            </ul>
            <p>Third-party services have their own terms and privacy policies. Atai is not responsible for their practices or availability, but we carefully select providers that meet high standards of reliability, security, and data protection.</p>
          </Section>

          <Section id="infrastructure" number="18" icon={Server} title="Infrastructure & Hosting">
            <p>Atai configures and manages the technical infrastructure your application needs, so you can focus on your business, not your servers. This includes:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Database hosting and management</li>
              <li>Authentication infrastructure</li>
              <li>File storage</li>
              <li>Application hosting and deployment</li>
              <li>Free subdomain deployment</li>
              <li>Custom domain connections</li>
              <li>SSL certificates</li>
            </ul>
            <p>You remain responsible for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your application&apos;s content and legal compliance</li>
              <li>Secrets management and configuration</li>
              <li>Access permissions and security settings</li>
              <li>Third-party integrations you add</li>
              <li>Production configuration decisions</li>
            </ul>
            <p>Full infrastructure terms are in the <Link href="/database-terms" className="text-primary hover:underline">Database &amp; Infrastructure Terms</Link>.</p>
          </Section>

          <Section id="early-access" number="19" icon={Clock} title="Early Access">
            <p>Atai is in an active early-access stage. This means we are building, shipping, and improving fast — and you are part of that journey from the ground up.</p>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">What early access means</p>
                <p>Features may change, new capabilities are added regularly, performance may vary, and some areas of the platform are still being refined. We will always be transparent about the state of what we ship.</p>
              </div>
            </div>
            <p>We are committed to keeping your data safe and your projects intact throughout this process. Your feedback directly shapes what Atai becomes for every founder after you.</p>
          </Section>

          <Section id="beta" number="20" icon={Lightbulb} title="Beta Features">
            <p>Atai may offer beta or experimental features from time to time. These are early-access versions of capabilities we are building. They:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>May change, be modified, or be removed</li>
              <li>May have limitations or known issues</li>
              <li>Are entirely optional — you choose whether to use them</li>
            </ul>
            <p>Beta features give you early access to what comes next. Use them, give us feedback, and help make them better for the entire community.</p>
          </Section>

          <Section id="acceptable-use" number="21" icon={ShieldCheck} title="Acceptable Use">
            <p>Atai is built for builders, founders, and entrepreneurs working on legitimate businesses. You agree to use the platform only for lawful purposes. You must not use Atai to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Engage in fraud, deception, or unlawful activity</li>
              <li>Impersonate any person or organization</li>
              <li>Build or distribute malicious software</li>
              <li>Attempt unauthorized access to systems or accounts</li>
              <li>Violate the privacy or intellectual property rights of others</li>
              <li>Launch attacks against systems or networks</li>
              <li>Send spam or engage in malicious automation</li>
              <li>Harass, abuse, or cause harm to others</li>
              <li>Violate applicable laws or regulations</li>
            </ul>
          </Section>

          <Section id="prohibited" number="22" icon={Ban} title="Prohibited Activities">
            <p>The following are specifically prohibited:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Bypassing authentication, paywalls, or access controls on any website</li>
              <li>Collecting personal data from websites without authorization or legal basis</li>
              <li>Making excessive automated requests to degrade website performance</li>
              <li>Evading anti-bot systems or CAPTCHAs</li>
              <li>Self-referral or fraudulent referral schemes</li>
              <li>Creating multiple accounts to circumvent platform limits</li>
              <li>Building applications designed to commit fraud, phishing, or illegal activity</li>
              <li>Attempting to reverse-engineer or scrape the Atai platform</li>
            </ul>
            <p>Violation of these rules may result in immediate suspension or permanent termination of your account.</p>
          </Section>

          <Section id="security" number="23" icon={Lock} title="Security">
            <p>Atai takes platform security seriously. We implement password hashing, session token management, rate limiting, access controls, and infrastructure security measures to protect your account and data.</p>
            <p>Your security responsibilities include:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Protecting your account credentials and API keys</li>
              <li>Reviewing generated applications for security vulnerabilities before going live</li>
              <li>Configuring production secrets and environment variables correctly</li>
              <li>Managing access permissions for your projects</li>
            </ul>
            <p>If you discover a security vulnerability in the Atai platform, please report it responsibly to <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a>. We take every report seriously.</p>
          </Section>

          <Section id="availability" number="24" icon={Server} title="Service Availability">
            <p>We work hard to keep Atai available and reliable at all times. The platform may occasionally experience:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Scheduled maintenance windows — communicated in advance where possible</li>
              <li>Unplanned outages or infrastructure incidents</li>
              <li>Third-party service interruptions</li>
              <li>Infrastructure upgrades that improve long-term reliability</li>
            </ul>
            <p>We communicate planned maintenance and incidents through the platform and our official channels. Enterprise plans include SLA-backed uptime commitments.</p>
          </Section>

          <Section id="disclaimers" number="25" icon={AlertCircle} title="Disclaimers">
            <p><strong className="text-foreground">We are invested in your success.</strong> That said, there are important things to understand about what the platform can and cannot guarantee.</p>
            <p>Atai provides powerful tools, infrastructure, and AI assistance. We cannot guarantee specific business outcomes, revenue, user acquisition, investment, search rankings, or product-market fit. Business success depends on many factors — your idea, your execution, your market, and your customers. Atai gives you the strongest possible foundation; what you build on it is yours to drive.</p>
            <p>AI-generated output is designed to be production-ready and high quality. It may still contain imperfections, and we encourage you to review your application before launch. We continuously improve output quality with every release.</p>
            <p className="uppercase text-xs leading-6">THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ATAI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. ATAI DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR COMPLETELY ERROR-FREE.</p>
          </Section>

          <Section id="liability" number="26" icon={Scale} title="Limitation of Liability">
            <p className="uppercase text-xs leading-6">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ATAI OR ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.</p>
            <p className="uppercase text-xs leading-6">IN NO EVENT SHALL THE TOTAL AGGREGATE LIABILITY OF ATAI EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO ATAI IN THE TWELVE MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) USD $100 (OR LOCAL CURRENCY EQUIVALENT).</p>
            <p>Nothing in these Terms limits liability that cannot be excluded by law, including liability for death or personal injury caused by negligence, or for fraud or fraudulent misrepresentation.</p>
          </Section>

          <Section id="indemnification" number="27" icon={ShieldCheck} title="Indemnification">
            <p>You agree to indemnify, defend, and hold harmless ATAI and its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of applicable law</li>
              <li>Your violation of any third-party rights</li>
              <li>Content you submit or applications you build using the Service</li>
            </ul>
          </Section>

          <Section id="suspension" number="28" icon={Ban} title="Account Suspension & Termination">
            <p>We want every user to have a great experience on Atai. However, we reserve the right to suspend or terminate accounts that:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Violate these Terms</li>
              <li>Engage in fraudulent, abusive, or harmful behavior</li>
              <li>Attempt to harm other users or the platform</li>
              <li>Are subject to legal requirements compelling action</li>
            </ul>
            <p>Where possible, we will provide notice and an opportunity to resolve the issue before taking action. You may also close your account at any time through your account settings.</p>
            <p>On termination, your access to the platform ends. We will handle your data as described in the <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
          </Section>

          <Section id="privacy-ref" number="29" icon={Eye} title="Privacy">
            <p>Your privacy matters to us. How we collect, use, store, and protect your information is explained in detail in the <Link href="/privacy" className="text-primary hover:underline">Atai Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>
            <p>By using Atai, you acknowledge and accept our data practices as described in the Privacy Policy.</p>
          </Section>

          <Section id="changes-service" number="30" icon={Lightbulb} title="Changes to Atai">
            <p>We are constantly improving the platform. We may add, modify, or discontinue features at any time. For significant changes that affect existing workflows, we will provide advance notice through the platform or by email where feasible.</p>
            <p>We build for the long term and will always aim to make changes that improve the platform for every user.</p>
          </Section>

          <Section id="changes-terms" number="31" icon={FileText} title="Changes to These Terms">
            <p>We may update these Terms from time to time. When we make material changes, we will:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Update the &quot;Last Updated&quot; date at the top of this page</li>
              <li>Notify you via email or a platform notification for significant changes</li>
            </ul>
            <p>Your continued use of Atai after the updated Terms become effective constitutes your acceptance of the changes. If you do not agree to updated Terms, stop using the platform and close your account.</p>
          </Section>

          <Section id="governing-law" number="32" icon={Scale} title="Governing Law & Disputes">
            <p>These Terms and any disputes arising from them are governed by the laws of Uganda, without regard to conflict of law principles. We encourage you to contact us first at <a href="mailto:support@atai.ink" className="text-primary hover:underline">support@atai.ink</a> before initiating any formal dispute resolution — the vast majority of issues can be resolved quickly through direct communication.</p>
            <p>For Enterprise plan users, specific dispute resolution terms may be defined in a separate agreement.</p>
          </Section>

          <Section id="general" number="33" icon={FileText} title="General Provisions">
            <p><strong className="text-foreground">Entire agreement.</strong> These Terms, together with the Privacy Policy, Refund Policy, and Database &amp; Infrastructure Terms, constitute the entire agreement between you and ATAI regarding your use of the Service.</p>
            <p><strong className="text-foreground">Severability.</strong> If any provision of these Terms is found to be unenforceable, the remaining provisions continue in full force and effect.</p>
            <p><strong className="text-foreground">Waiver.</strong> Our failure to enforce any provision is not a waiver of that provision.</p>
            <p><strong className="text-foreground">Assignment.</strong> You may not assign your rights or obligations under these Terms without our prior written consent. We may assign our rights in connection with a merger, acquisition, or sale of assets.</p>
            <p><strong className="text-foreground">No agency.</strong> These Terms do not create a partnership, joint venture, agency, or employment relationship between you and ATAI.</p>
          </Section>

          <Section id="contact" number="34" icon={Phone} title="Contact Us">
            <p>We are here for you. If you have questions about these Terms, need support, or just want to share feedback, reach out through any of the following:</p>
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
            <p className="text-sm text-muted-foreground">We aim to respond to all enquiries within 1–2 business days.</p>
          </Section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-20 mt-16">
            <h2 className="text-2xl font-semibold tracking-tight mb-8 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> Frequently Asked Questions
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
