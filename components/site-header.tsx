"use client"

import Link from "next/link"
import { ArrowRight, Compass, BookOpen, DollarSign, Info, LayoutDashboard, Zap, HelpCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { AccountMenu } from "@/components/account-menu"
import { useSession } from "@/lib/client/api"

interface NavLink {
  href: string
  label: string
  icon?: React.ElementType
}

interface SiteHeaderProps {
  activePage?: string
  links?: NavLink[]
  variant?: "default" | "bordered"
}

const defaultLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/pricing", label: "Pricing", icon: DollarSign },
  { href: "/about", label: "About", icon: Info },
  { href: "/resources", label: "Resources", icon: HelpCircle },
]

const PILL = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
const PILL_ACTIVE = "inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"

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
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
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
      <nav className="hidden items-center gap-2 md:flex">
        {isHome ? (
          <>
            <a href="#how-it-works" className={PILL}>
              <Zap className="size-3.5" />
              How it works
            </a>
            <a href="#principles" className={PILL}>
              <Info className="size-3.5" />
              Why MirrorSite
            </a>
            <Link href="/docs" className={PILL}>
              <BookOpen className="size-3.5" />
              Docs
            </Link>
            <Link href="/pricing" className={PILL}>
              <DollarSign className="size-3.5" />
              Pricing
            </Link>
            <Link href="/explore" className={PILL}>
              <Compass className="size-3.5" />
              Explore
            </Link>
            {session && (
              <Link href="/dashboard" className={PILL}>
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
            )}
            {session && <AccountMenu />}
            {!session && !sessionLoading && (
              <>
                <Link href="/login" className={PILL}>Sign in</Link>
                <Link href="/register" className={buttonVariants({ size: "sm" })}>
                  Start building <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={activePage === href.replace(/^\//, "") ? PILL_ACTIVE : PILL}
              >
                {Icon && <Icon className="size-3.5" />}
                {label}
              </Link>
            ))}
            <Link href="/explore" className={PILL}>
              <Compass className="size-3.5" />
              Explore
            </Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Start building <ArrowRight className="size-4" />
            </Link>
          </>
        )}
      </nav>

      {/* Mobile nav */}
      <div className="flex items-center gap-2 md:hidden">
        <Link href="/explore" className="grid place-items-center rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Compass className="size-4" />
        </Link>
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
