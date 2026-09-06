import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Zap, Code2, Layers3, Globe, Link as LinkIcon, Shield, Clock, Settings, DollarSign, AlertTriangle, X, Coins } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SITE_URL } from "@/lib/env"
import { getCurrentUser } from "@/lib/auth/session"
import {
  BUILD_TIERS,
  SUBSCRIPTION_PLANS,
  PERMANENT_CREDIT_PACKS,
  CREDIT_UNIT_NAME,
  formatUSD,
  WELCOME_BONUS_CREDITS,
} from "@/lib/billing/config"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { PlanCard } from "@/components/billing/plan-card"

const TIERS = Object.values(BUILD_TIERS).map((tier) => ({
  name: tier.label,
  credits: tier.credits.toLocaleString(),
  price: `${tier.credits.toLocaleString()} ${CREDIT_UNIT_NAME}`,
  description: tier.description,
  icon: tier.id === "simple" ? Code2 : tier.id === "medium" ? Layers3 : Zap,
  popular: tier.id === "medium",
  features: tier.id === "simple"
    ? [
      "Basic website/application generation",
      "Standard pages and components",
      "Responsive UI",
      "Basic functionality",
      "Suitable for simpler projects",
    ]
    : tier.id === "medium"
      ? [
        "Multi-page applications",
        "Authentication",
        "Database-backed functionality",
        "APIs",
        "Dashboards",
        "More advanced application logic",
        "More customization",
      ]
      : [
        "Complex application structures",
        "Advanced backend functionality",
        "Multiple application features",
        "More sophisticated data flows",
        "Advanced integrations",
        "Larger full-stack projects",
      ],
}))

export const metadata: Metadata = {
  title: "MirrorSite AI Pricing | Credits & Application Generation Plans",
  description:
    "Choose a MirrorSite AI plan to generate full-stack applications. Simple, Medium, and Complex tiers with transparent credit-based pricing.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/pricing`,
    siteName: "MirrorSite AI",
    title: "MirrorSite AI Pricing | Credits & Application Generation Plans",
    description: "Choose a MirrorSite AI plan to generate full-stack applications. Simple, Medium, and Complex tiers with transparent credit-based pricing.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSite AI Pricing | Credits & Application Generation Plans",
    description: "Choose a MirrorSite AI plan to generate full-stack applications.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MirrorSite AI Pricing" }],
  },
}

const pricingStructuredData = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "MirrorSite AI",
  description: "AI-powered application builder that turns websites and ideas into working full-stack applications.",
  brand: { "@type": "Organization", name: "ATAI Enterprises", url: "https://atai.ink" },
  offers: SUBSCRIPTION_PLANS.filter((p) => !p.custom).map((plan) => ({
    "@type": "Offer",
    name: `${plan.name} Plan`,
    price: plan.priceUSD,
    priceCurrency: "USD",
    description: `${plan.mirrorCredits.toLocaleString()} ${CREDIT_UNIT_NAME} per month`,
    url: `${SITE_URL}/pricing`,
    availability: "https://schema.org/InStock",
    priceValidUntil: "2026-12-31",
  })),
}

export default async function PricingPage() {
  let user = null
  try {
    user = await getCurrentUser()
  } catch {
    // Not logged in — show register buttons
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingStructuredData) }} />
      <SiteHeader activePage="/pricing" variant="bordered" />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Pricing</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Build More With<br />{CREDIT_UNIT_NAME}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
          Use credits to create, improve and customize applications with MirrorSite AI.
          Start with {WELCOME_BONUS_CREDITS.toLocaleString()} free credits on us.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>
            Start Building <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* How Credits Work */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h2 className="text-2xl font-semibold tracking-tight text-center">How Credits Work</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="font-mono text-lg font-bold">1</span>
              </div>
              <p className="mt-4 font-medium">Subscription Credits</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Monthly credits from your plan. Consumed first, expire at period end.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="font-mono text-lg font-bold">2</span>
              </div>
              <p className="mt-4 font-medium">Permanent Credits</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Buy once, use forever. Never expire, consumed after subscription credits.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="font-mono text-lg font-bold">3</span>
              </div>
              <p className="mt-4 font-medium">{WELCOME_BONUS_CREDITS.toLocaleString()} Free Credits</p>
              <p className="mt-2 text-sm text-muted-foreground">
                New users receive {WELCOME_BONUS_CREDITS.toLocaleString()} permanent credits to try MirrorSite AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Subscription Plans</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Choose Your Plan</h2>
          <p className="mt-3 text-muted-foreground">
            Start for free — upgrade any time for monthly {CREDIT_UNIT_NAME} and more capabilities.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-start">
          {SUBSCRIPTION_PLANS.filter((p) => !p.custom).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isLoggedIn={!!user}
            />
          ))}
        </div>
      </section>

      {/* Permanent Credit Packs */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Permanent Credits</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Buy Once, Use Forever</h2>
            <p className="mt-3 text-muted-foreground">
              Permanent credits never expire and remain available after subscription cancellation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERMANENT_CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`rounded-xl border bg-card p-5 ${pack.popular ? "border-primary/50 shadow-lg shadow-primary/5" : "border-border"
                  }`}
              >
                {pack.popular && (
                  <div className="mb-3 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    Best Value
                  </div>
                )}
                <p className="text-2xl font-bold">{pack.credits.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">{CREDIT_UNIT_NAME}</p>
                <p className="mt-3 text-xl font-semibold">{formatUSD(pack.priceUSD)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ${(pack.priceUSD / pack.credits).toFixed(4)} per credit
                </p>
                {user ? (
                  <CheckoutButton
                    type="permanent"
                    productId={pack.id}
                    className="mt-4 w-full bg-background text-foreground border border-border hover:bg-accent"
                  >
                    Buy Now
                  </CheckoutButton>
                ) : (
                  <Link
                    href="/register"
                    className="mt-4 block text-center py-2 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors"
                  >
                    Get Started
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Generation Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Application Generation</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Choose Your Project Size</h2>
          <p className="mt-3 text-muted-foreground">
            Credits are consumed when MirrorSite AI builds your application.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-xl border p-6 ${tier.popular
                ? "border-primary/50 bg-card shadow-lg shadow-primary/5"
                : "border-border bg-card"
                }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <tier.icon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>
              </div>

              <div className="mt-6">
                <span className="text-3xl font-bold">{tier.credits}</span>
                <span className="ml-2 text-muted-foreground">{CREDIT_UNIT_NAME}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`mt-6 block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${tier.popular
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border hover:bg-accent"
                  }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Hosting Comparison ────────────────────────────────────── */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Hosting Options</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Free Subdomain vs Custom Domain</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              After building your app, you can publish it to a free subdomain or connect your own domain.
              Both options cost 500 credits and include HTTPS, CDN, and lifetime hosting.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Free Subdomain */}
            <div className="relative flex flex-col rounded-xl border-2 border-primary/30 bg-card p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Recommended
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Free Subdomain</h3>
                  <p className="text-sm text-muted-foreground">Zero setup required</p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 mb-5">
                <p className="font-mono text-sm text-foreground">yourapp.totalum-project.com</p>
              </div>

              <div className="space-y-2 mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Benefits</p>
                <ul className="space-y-2">
                  {[
                    "Free forever — no hosting fees, ever",
                    "Instant deploy — no DNS configuration",
                    "Auto HTTPS & global CDN included",
                    "Lifetime hosting at no extra cost",
                    "Perfect for prototyping & demos",
                    "Share with anyone instantly",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Deployment Cost</span>
                  <span className="font-mono text-sm">500 {CREDIT_UNIT_NAME}</span>
                </div>
                <Link
                  href="/register"
                  className="block text-center py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>
            </div>

            {/* Custom Domain */}
            <div className="relative flex flex-col rounded-xl border border-border bg-card p-6">
              <div className="absolute -top-3 left-6 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
                Advanced
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <LinkIcon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Custom Domain</h3>
                  <p className="text-sm text-muted-foreground">Use your own domain</p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 mb-5">
                <p className="font-mono text-sm text-muted-foreground">app.yourdomain.com</p>
              </div>

              <div className="space-y-2 mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Benefits</p>
                <ul className="space-y-2">
                  {[
                    "Professional branding with your own domain",
                    "Better SEO — your domain builds authority",
                    "Full control over your web identity",
                    "Auto HTTPS setup — no certificate management",
                    "Ideal for production apps & businesses",
                    "Build trust with customers via your brand",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Deployment Cost</span>
                  <span className="font-mono text-sm">500 {CREDIT_UNIT_NAME}</span>
                </div>
                <Link
                  href="/register"
                  className="block text-center py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>

          {/* Feature comparison table */}
          <div className="mt-12 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-5 py-3.5 text-center font-medium">Free Subdomain</th>
                  <th className="px-5 py-3.5 text-center font-medium">Custom Domain</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Setup time", subdomain: "Instant", custom: "Minutes + DNS" },
                  { feature: "DNS configuration", subdomain: "None required", custom: "Manual setup" },
                  { feature: "HTTPS / SSL", subdomain: "Auto-included", custom: "Auto-included" },
                  { feature: "Global CDN", subdomain: "Included", custom: "Included" },
                  { feature: "Hosting cost", subdomain: "Free forever", custom: "Free 6 months, then paid" },
                  { feature: "Custom branding", subdomain: false, custom: true },
                  { feature: "SEO domain authority", subdomain: false, custom: true },
                  { feature: "Professional appearance", subdomain: "Basic", custom: "Full branding" },
                  { feature: "Deployment cost", subdomain: "500 credits", custom: "500 credits" },
                  { feature: "Can add/remove anytime", subdomain: true, custom: true },
                ].map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-5 py-3 text-foreground font-medium">{row.feature}</td>
                    <td className="px-5 py-3 text-center">
                      {typeof row.subdomain === "boolean" ? (
                        row.subdomain ? (
                          <Check className="size-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="size-4 text-muted-foreground/40 mx-auto" />
                        )
                      ) : (
                        <span className="text-foreground">{row.subdomain}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {typeof row.custom === "boolean" ? (
                        row.custom ? (
                          <Check className="size-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="size-4 text-muted-foreground/40 mx-auto" />
                        )
                      ) : (
                        <span className="text-foreground">{row.custom}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready to build something real?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start with {WELCOME_BONUS_CREDITS.toLocaleString()} free credits and see what MirrorSite AI can create.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>
              Try MirrorSite AI <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter activePage="/pricing" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }, { href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }]} wrapperClassName="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between" />
    </main>
  )
}
