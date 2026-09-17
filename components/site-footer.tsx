"use client"

import Link from "next/link"
import { useSession } from "@/lib/client/api"

interface FooterLink {
  href: string
  label: string
}

interface SiteFooterProps {
  activePage?: string
  links?: FooterLink[]
  wrapperClassName?: string
}

const FOOTER_COLS = [
  {
    heading: "Platform",
    links: [
      { href: "/new/idea", label: "Start from an idea" },
      { href: "/new/website", label: "Mirror a website" },
      { href: "/new/github", label: "Build from GitHub" },
      { href: "/pricing", label: "Pricing" },
      { href: "/explore", label: "Explore projects" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Atai" },
      { href: "/about#team", label: "The team" },
      { href: "/docs", label: "Documentation" },
      { href: "/resources", label: "Resources" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/refund-policy", label: "Refund policy" },
      { href: "/database-terms", label: "Database terms" },
    ],
  },
]

export function SiteFooter({ activePage, links, wrapperClassName }: SiteFooterProps) {
  const { session } = useSession()
  const isHome = !activePage

  // Simple single-line footer when links override is provided (inner pages)
  if (links) {
    return (
      <footer className="border-t border-border">
        <div className={wrapperClassName ?? "mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10"}>
          <div className="flex items-center gap-3">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">A</span>
            <span className="font-mono text-xs">© 2026 Atai — Advanced Technologies and AI Enterprises.</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={activePage === href.replace(/^\//, "") ? "text-foreground" : "hover:text-foreground"}
              >
                {label}
              </Link>
            ))}
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-border bg-card/40">
      {/* Multi-column footer */}
      <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">

          {/* Brand column */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-sm">A</span>
              <span className="font-mono text-sm font-bold tracking-tight text-foreground">Atai</span>
            </Link>
            <p className="text-sm leading-7 text-muted-foreground max-w-xs">
              The AI business-building platform. You bring the vision. Atai brings the team.
            </p>
            <p className="font-mono text-xs text-muted-foreground/60">
              From idea → business → growth.
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {["AI Co-Founder", "Engineering", "Growth", "Research", "Funding"].map((t) => (
                <span key={t} className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {col.heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
                {col.heading === "Platform" && (
                  <li>
                    <Link
                      href={session ? "/dashboard" : "/register"}
                      className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      {session ? "Go to dashboard →" : "Start free →"}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-muted-foreground">
            © 2026 Atai — Advanced Technologies and AI Enterprises.
          </p>
          <p className="font-mono text-xs text-muted-foreground/50">
            Built for founders who aren&apos;t thinking small.
          </p>
        </div>
      </div>
    </footer>
  )
}
