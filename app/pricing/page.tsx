import Link from "next/link"
import { ArrowRight, Check, Zap, Code2, Layers3, Globe, Link as LinkIcon, Shield, Clock, Settings, DollarSign, AlertTriangle, X } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

const TIERS = [
  {
    name: "Simple",
    credits: "25,000",
    price: "25,000 UGX",
    description: "For smaller applications and straightforward website experiences.",
    icon: Code2,
    features: [
      "Basic website/application generation",
      "Standard pages and components",
      "Responsive UI",
      "Basic functionality",
      "Suitable for simpler projects",
    ],
  },
  {
    name: "Medium",
    credits: "50,000",
    price: "50,000 UGX",
    description: "For more capable full-stack applications.",
    icon: Layers3,
    popular: true,
    features: [
      "Multi-page applications",
      "Authentication",
      "Database-backed functionality",
      "APIs",
      "Dashboards",
      "More advanced application logic",
      "More customization",
    ],
  },
  {
    name: "Complex",
    credits: "75,000",
    price: "75,000 UGX",
    description: "For advanced application projects.",
    icon: Zap,
    features: [
      "Complex application structures",
      "Advanced backend functionality",
      "Multiple application features",
      "More sophisticated data flows",
      "Advanced integrations",
      "Larger full-stack projects",
    ],
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              M
            </span>
            <span>mirrorsite<span className="text-primary">.ai</span></span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/pricing" className="text-foreground">Pricing</Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Get Started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Pricing</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Build More With<br />MirrorSite Credits
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
          Use credits to create, improve and customize applications with MirrorSite AI.
          Start with 500 free credits on us.
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
              <p className="mt-4 font-medium">1 Credit = 1 UGX</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Simple, transparent pricing. What you see is what you pay.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="font-mono text-lg font-bold">2</span>
              </div>
              <p className="mt-4 font-medium">500 Free Credits</p>
              <p className="mt-2 text-sm text-muted-foreground">
                New users receive 500 credits to try MirrorSite AI.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="font-mono text-lg font-bold">3</span>
              </div>
              <p className="mt-4 font-medium">Top Up Anytime</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Buy more credits via MTN or Airtel Mobile Money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
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
              className={`relative flex flex-col rounded-xl border p-6 ${
                tier.popular
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
                <span className="ml-2 text-muted-foreground">credits</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tier.price}</p>

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
                className={`mt-6 block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tier.popular
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

          {/* Side-by-side cards */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Free Subdomain ── */}
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

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade-offs</p>
                <ul className="space-y-2">
                  {[
                    "Uses *.totalum-project.com subdomain",
                    "Less professional for client-facing projects",
                    "Cannot use your own branding in the URL",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Deployment Cost</span>
                  <span className="font-mono text-sm">500 credits</span>
                </div>
                <Link
                  href="/register"
                  className="block text-center py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>
            </div>

            {/* ── Custom Domain ── */}
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

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade-offs</p>
                <ul className="space-y-2">
                  {[
                    "Requires DNS configuration at your provider",
                    "DNS propagation may take up to 24 hours",
                    "Hosting is free for 6 months, then paid",
                    "Manual steps needed for DNS records",
                    "Requires owning a domain name",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Deployment Cost</span>
                  <span className="font-mono text-sm">500 credits</span>
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

          {/* When to choose each */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="size-5 text-primary" />
                <h3 className="font-semibold">Choose Free Subdomain if…</h3>
              </div>
              <ul className="space-y-2">
                {[
                  "You're prototyping or testing an idea",
                  "You want to share a demo with others quickly",
                  "You don't own a domain name yet",
                  "You want zero setup and instant deployment",
                  "Cost is your primary concern",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="size-3.5 text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <LinkIcon className="size-5 text-muted-foreground" />
                <h3 className="font-semibold">Choose Custom Domain if…</h3>
              </div>
              <ul className="space-y-2">
                {[
                  "You're building a production app or business",
                  "You want professional branding in the URL",
                  "SEO and domain authority matter to you",
                  "You need to build trust with customers",
                  "You already own a domain name",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
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
            Start with 500 free credits and see what MirrorSite AI can create.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg" }) + " h-12 px-6"}>
              Try MirrorSite AI <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-xs">© 2026 MirrorSite AI</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
