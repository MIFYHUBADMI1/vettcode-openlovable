import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  FileText,
  Shield,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Clock,
  Mail,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"

/* ═══════════════════════════════════════════════════════════════
   SEO METADATA
   ═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "MirrorSite AI Refund Policy | Credit Purchases & Refunds",
  description:
    "Learn about MirrorSite AI's refund policy for credit purchases, mobile money payments, failed transactions, and account credits.",
  alternates: { canonical: "/refund-policy" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/refund-policy`,
    siteName: "MirrorSite AI",
    title: "MirrorSite AI Refund Policy | Credit Purchases & Refunds",
    description:
      "Learn about MirrorSite AI's refund policy for credit purchases, mobile money payments, failed transactions, and account credits.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Refund Policy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI Refund Policy | Credit Purchases & Refunds",
    description: "Learn about MirrorSite AI's refund policy for credit purchases, mobile money payments, failed transactions, and account credits.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Refund Policy" }],
  },
}

/* ═══════════════════════════════════════════════════════════════
   STRUCTURED DATA
   ═══════════════════════════════════════════════════════════════ */

const refundPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MirrorSite AI Refund Policy",
  description:
    "Refund policy for MirrorSite AI credit purchases, mobile money payments, failed transactions, and account credits.",
  url: `${SITE_URL}/refund-policy`,
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
      name: "Can I get a refund on MirrorSite credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Refund eligibility depends on the situation. Credits that have been consumed through platform actions (website analysis, plan generation, application generation) are not refundable. Unused credits may be eligible for refund if you experience a technical issue that prevents use of the service.",
      },
    },
    {
      "@type": "Question",
      name: "What if my payment fails but I was charged?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If your mobile money payment was deducted but credits were not awarded, contact support with your transaction ID and payment screenshot. MirrorSite will investigate and either award the credits or process a refund.",
      },
    },
    {
      "@type": "Question",
      name: "How do I request a refund?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Contact MirrorSite support with your account email, transaction details, and a description of the issue. Refund requests are reviewed on a case-by-case basis.",
      },
    },
    {
      "@type": "Question",
      name: "Are referral credits refundable?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Referral credits are promotional credits awarded through the referral program. They have no cash value and cannot be refunded, exchanged for money, or transferred.",
      },
    },
    {
      "@type": "Question",
      name: "How long does refund processing take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Refund processing times depend on the payment method and the nature of the refund. Mobile money refunds may take several business days. Credit adjustments are typically applied within 48 hours of approval.",
      },
    },
  ],
}

/* ═══════════════════════════════════════════════════════════════
   FAQ DATA
   ═══════════════════════════════════════════════════════════════ */

const faqItems = [
  {
    q: "Can I get a refund on MirrorSite credits?",
    a: "Refund eligibility depends on the situation. Credits that have been consumed through platform actions (website analysis, plan generation, application generation) are not refundable. Unused credits may be eligible for refund if you experience a technical issue that prevents use of the service.",
  },
  {
    q: "What if my payment fails but I was charged?",
    a: "If your mobile money payment was deducted but credits were not awarded, contact support with your transaction ID and payment screenshot. MirrorSite will investigate and either award the credits or process a refund.",
  },
  {
    q: "How do I request a refund?",
    a: "Contact MirrorSite support with your account email, transaction details, and a description of the issue. Refund requests are reviewed on a case-by-case basis.",
  },
  {
    q: "Are referral credits refundable?",
    a: "No. Referral credits are promotional credits awarded through the referral program. They have no cash value and cannot be refunded, exchanged for money, or transferred.",
  },
  {
    q: "How long does refund processing take?",
    a: "Refund processing times depend on the payment method and the nature of the refund. Mobile money refunds may take several business days. Credit adjustments are typically applied within 48 hours of approval.",
  },
]

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function RefundPolicyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(refundPageStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />

      <main className="workspace-environment min-h-svh overflow-hidden bg-background text-foreground">
        <span className="workspace-signal" aria-hidden="true" />

        <SiteHeader activePage="/refund-policy" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }]} />

        {/* ═══════════════════════════════════════════════════════
           PAGE HEADER
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pt-12 pb-8 lg:px-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><RefreshCw className="size-5 text-primary" /></div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Refund Policy</p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Refund Policy
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground max-w-2xl">
            This Refund Policy explains when and how refunds may be available for MirrorSite AI credit purchases, payments, and promotional credits.
          </p>
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            Last Updated: September 1, 2026
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════
           AT A GLANCE
           ═══════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 pb-12 lg:px-10">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="text-lg font-semibold mb-3">Refund Summary</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Failed payments that deducted funds without awarding credits are eligible for investigation and resolution.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Duplicate transactions are eligible for refund of the duplicate amount.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" /> Technical issues preventing use of purchased credits may qualify for a credit adjustment or refund.</li>
              <li className="flex items-start gap-2"><XCircle className="size-4 text-destructive mt-0.5 shrink-0" /> Credits that have been consumed through platform actions are not refundable.</li>
              <li className="flex items-start gap-2"><XCircle className="size-4 text-destructive mt-0.5 shrink-0" /> Promotional and referral credits are not refundable and have no cash value.</li>
              <li className="flex items-start gap-2"><XCircle className="size-4 text-destructive mt-0.5 shrink-0" /> Refund eligibility is evaluated on a case-by-case basis.</li>
            </ul>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
           CONTENT
           ═══════════════════════════════════════════════════════ */}
        <article className="mx-auto max-w-4xl px-6 pb-24 lg:px-10 prose-custom">

          {/* ── 1. Overview ── */}
          <section id="overview" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> 1. Overview
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite AI sells credits that are used to access platform features such as website analysis, application planning, application generation, and deployment. This Refund Policy explains when refunds or credit adjustments may be available.
              </p>
              <p>
                By purchasing credits on MirrorSite AI, you acknowledge that you have read and understood this Refund Policy. This policy forms part of the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
              </p>
              <p>
                Refund eligibility depends on the nature of the purchase, the payment method, promotional terms, and applicable law.
              </p>
            </div>
          </section>

          {/* ── 2. Credit Purchases ── */}
          <section id="credit-purchases" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <CreditCard className="size-5 text-primary" /> 2. Credit Purchases
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <h3 className="text-base font-medium text-foreground mt-6">Unused credits</h3>
              <p>
                Credits that have not been consumed through platform actions may be eligible for refund, subject to review. Requests for unused credit refunds are evaluated on a case-by-case basis.
              </p>

              <h3 className="text-base font-medium text-foreground mt-6">Consumed credits</h3>
              <p>
                Credits that have been consumed through platform actions — including website analysis, plan generation, application generation, and deployment — are not refundable. This includes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Credits consumed during successful website analysis (5 credits)</li>
                <li>Credits consumed during plan generation (5 credits)</li>
                <li>Credits consumed during application generation (25,000 / 50,000 / 75,000 credits)</li>
                <li>Credits consumed during deployment (500 credits)</li>
                <li>Credits consumed during follow-up AI development prompts</li>
              </ul>
              <p>
                Even if the generated output does not meet your expectations, consumed credits are not refunded because the platform performed the requested action.
              </p>

              <h3 className="text-base font-medium text-foreground mt-6">Partially consumed reservations</h3>
              <p>
                When credits are reserved for an operation but only partially consumed (for example, if an AI build uses fewer credits than reserved), the unused portion is automatically refunded to your account.
              </p>
            </div>
          </section>

          {/* ── 3. Failed Payments ── */}
          <section id="failed-payments" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <AlertCircle className="size-5 text-primary" /> 3. Failed Payments
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                If your mobile money payment was deducted from your account but credits were not awarded to your MirrorSite account:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Contact MirrorSite support with your transaction ID and payment confirmation screenshot</li>
                <li>MirrorSite will investigate the payment</li>
                <li>If the payment is verified, credits will be awarded to your account</li>
                <li>If the payment cannot be verified, a refund will be processed through your payment provider</li>
              </ul>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium mb-1">What to include when reporting a failed payment</p>
                <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                  <li>• Your MirrorSite account email</li>
                  <li>• Mobile money transaction ID</li>
                  <li>• Amount paid</li>
                  <li>• Date and time of payment</li>
                  <li>• Payment confirmation screenshot</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── 4. Duplicate Transactions ── */}
          <section id="duplicates" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <RefreshCw className="size-5 text-primary" /> 4. Duplicate Transactions
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                If you were charged twice for the same transaction due to a technical error, the duplicate charge is eligible for full refund. Contact support with both transaction IDs and payment confirmations so the duplicate can be identified and refunded.
              </p>
            </div>
          </section>

          {/* ── 5. Technical Issues ── */}
          <section id="technical-issues" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <AlertTriangle className="size-5 text-primary" /> 5. Technical Issues
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                If a technical issue on MirrorSite&apos;s side prevents you from using credits you have purchased — for example, if the platform is unavailable or a feature malfunctions during a paid operation — MirrorSite may, at its discretion:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Restore the consumed credits to your account</li>
                <li>Provide a credit adjustment equivalent to the affected amount</li>
                <li>Process a refund if the credits cannot be restored</li>
              </ul>
              <p>
                MirrorSite will investigate reported technical issues and make a reasonable determination based on the circumstances.
              </p>
            </div>
          </section>

          {/* ── 6. Non-Refundable Items ── */}
          <section id="non-refundable" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <XCircle className="size-5 text-primary" /> 6. Non-Refundable Items
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>The following are not eligible for refund:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Credits consumed through platform actions (website analysis, plan generation, application generation, deployment)</li>
                <li>Promotional credits (including welcome bonus credits)</li>
                <li>Referral program credits (verification rewards and milestone rewards)</li>
                <li>Credits consumed during beta or experimental feature usage</li>
                <li>Infrastructure plan payments that have been activated and used</li>
                <li>Credits consumed due to user error in configuration or input</li>
                <li>Credits consumed on projects that the user later chooses to delete</li>
              </ul>
            </div>
          </section>

          {/* ── 7. Promotional Credits ── */}
          <section id="promotional" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <CheckCircle2 className="size-5 text-primary" /> 7. Promotional Credits
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                Promotional credits — including the 500 free welcome credits, referral verification rewards (500 credits), and referral milestone rewards (1,500 credits) — are not eligible for refund, cash exchange, or transfer.
              </p>
              <p>
                Promotional credits have no cash value and cannot be redeemed for money except where required by applicable law.
              </p>
            </div>
          </section>

          {/* ── 8. How to Request a Refund ── */}
          <section id="how-to-request" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Mail className="size-5 text-primary" /> 8. How to Request a Refund
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>To request a refund, contact MirrorSite support with:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your MirrorSite account email</li>
                <li>The transaction ID or payment reference</li>
                <li>The date and amount of the purchase</li>
                <li>A description of the issue and why you are requesting a refund</li>
                <li>Any supporting evidence (payment screenshots, error messages, etc.)</li>
              </ul>
              <div className="rounded-xl border border-border bg-card p-5 mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10"><Mail className="size-4 text-primary" /></div>
                  <p className="font-medium">Contact Support</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reach MirrorSite support through the platform or call <span className="font-mono text-foreground">+256 761 819 885</span> for payment-related assistance.
                </p>
              </div>
            </div>
          </section>

          {/* ── 9. Processing Times ── */}
          <section id="processing-times" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <Clock className="size-5 text-primary" /> 9. Processing Times
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium">Refund Type</th>
                      <th className="px-4 py-3 text-left font-medium">Processing Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium">Credit restoration</td>
                      <td className="px-4 py-3">Typically within 48 hours of approval</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium">Mobile money refund</td>
                      <td className="px-4 py-3">3–7 business days after approval</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium">Investigation required</td>
                      <td className="px-4 py-3">Up to 14 business days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Processing times may vary depending on the payment provider, your mobile money operator, and the complexity of the refund request.
              </p>
            </div>
          </section>

          {/* ── 10. Changes to This Policy ── */}
          <section id="changes" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight mt-16 mb-4 flex items-center gap-3">
              <FileText className="size-5 text-primary" /> 10. Changes to This Policy
            </h2>
            <div className="space-y-4 text-base leading-7 text-muted-foreground">
              <p>
                MirrorSite may update this Refund Policy from time to time. When material changes are made, we may provide notice through the platform or other reasonable means.
              </p>
              <p>
                The &quot;Last Updated&quot; date at the top of this page indicates when this policy was last revised. Purchases made before a policy change are generally subject to the policy in effect at the time of purchase.
              </p>
            </div>
          </section>

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
            <h2 className="text-2xl font-semibold tracking-tight">
              Need help with a refund?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Contact support with your transaction details and we&apos;ll review your request.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/pricing" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>
                View Pricing <ArrowRight className="size-4" />
              </Link>
              <Link href="/terms" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-6"}>
                Terms of Service
              </Link>
              <Link href="/privacy" className={buttonVariants({ variant: "outline", size: "lg" }) + " h-12 px-6"}>
                Privacy Policy
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter activePage="/refund-policy" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/resources", label: "Resources" }, { href: "/about", label: "About" }, { href: "/privacy", label: "Privacy" }, { href: "/refund-policy", label: "Refunds" }, { href: "/terms", label: "Terms" }]} />
      </main>
    </>
  )
}
