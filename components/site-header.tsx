"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { AccountMenu } from "@/components/account-menu"
import { useSession } from "@/lib/client/api"

interface NavLink {
  href: string
  label: string
}

interface SiteHeaderProps {
  /** Which nav item to highlight as active */
  activePage?: string
  /** Override the default nav links */
  links?: NavLink[]
  /** Variant changes the outer container style */
  variant?: "default" | "bordered"
}

const defaultLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Resources" },
]

export function SiteHeader({ activePage, links = defaultLinks, variant = "default" }: SiteHeaderProps) {
  const { session, isLoading: sessionLoading } = useSession()

  const isHome = !activePage

  const Wrapper = variant === "bordered"
    ? ({ children }: { children: React.ReactNode }) => (
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">{children}</div>
        </header>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          {children}
        </header>
      )

  return (
    <Wrapper>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 font-mono text-sm font-semibold tracking-tight">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">M</span>
        <span>mirrorsite<span className="text-primary">.ai</span></span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
        {isHome ? (
          <>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#principles" className="transition-colors hover:text-foreground">Why MirrorSite</a>
            {session ? <Link href="/dashboard" className="text-foreground transition-colors hover:text-primary">Dashboard</Link> : null}
            <Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
            {session ? <AccountMenu /> : null}
            {!session && !sessionLoading ? (
              <>
                <Link href="/login" className="text-foreground transition-colors hover:text-primary">Sign in</Link>
                <Link href="/register" className={buttonVariants({ size: "sm" })}>Start building <ArrowRight className="size-4" /></Link>
              </>
            ) : null}
          </>
        ) : (
          <>
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={
                  activePage === href.replace(/^\//, "")
                    ? "text-foreground transition-colors hover:text-primary"
                    : "transition-colors hover:text-foreground"
                }
              >
                {label}
              </Link>
            ))}
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Start building <ArrowRight className="size-4" />
            </Link>
          </>
        )}
      </nav>

      {/* Mobile nav */}
      <div className="flex items-center gap-2 md:hidden">
        {isHome ? (
          session ? (
            <>
              <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>Dashboard</Link>
              <AccountMenu />
            </>
          ) : !sessionLoading ? (
            <Link href="/register" className={buttonVariants({ size: "sm" })}>Start</Link>
          ) : null
        ) : (
          <Link href="/register" className={buttonVariants({ size: "sm" })}>Start</Link>
        )}
      </div>
    </Wrapper>
  )
}
