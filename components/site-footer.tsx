"use client"

import Link from "next/link"
import { useSession } from "@/lib/client/api"

interface FooterLink {
  href: string
  label: string
}

interface SiteFooterProps {
  /** Which nav item to highlight as active */
  activePage?: string
  /** Override the default footer links */
  links?: FooterLink[]
  /** Override the outer wrapper className */
  wrapperClassName?: string
}

const defaultLinks: FooterLink[] = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
]

export function SiteFooter({ activePage, links = defaultLinks, wrapperClassName }: SiteFooterProps) {
  const { session } = useSession()

  const isHome = !activePage

  return (
    <footer className="border-t border-border">
      <div className={wrapperClassName ?? "mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10"}>
        <span className="font-mono text-xs">© 2026 MirrorSite AI</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {isHome ? (
            <>
              <a href="#how-it-works" className="hover:text-foreground">How it works</a>
              <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
              <Link href="/about" className="hover:text-foreground">About</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href={session ? "/dashboard" : "/login"} className="hover:text-foreground">
                {session ? "Dashboard" : "Sign in"}
              </Link>
            </>
          ) : (
            <>
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={
                    activePage === href.replace(/^\//, "")
                      ? "text-foreground"
                      : "hover:text-foreground"
                  }
                >
                  {label}
                </Link>
              ))}
              <Link href="/login" className="hover:text-foreground">Sign in</Link>
            </>
          )}
        </div>
      </div>
    </footer>
  )
}
