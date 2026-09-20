"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, BookOpen, Compass, DollarSign, Info, LayoutDashboard, Menu, X, Zap } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { AccountMenu } from "@/components/account-menu"
import { useSession } from "@/lib/client/api"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand-logo"
import { AuthTrigger } from "@/components/auth/auth-trigger"

interface NavLink {
  href: string
  label: string
  icon?: import("react").ElementType
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
  { href: "/resources", label: "Resources" },
]

const NAV_LINK =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const NAV_LINK_ACTIVE = "inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"

export function SiteHeader({ activePage, links = defaultLinks, variant = "default" }: SiteHeaderProps) {
  const { session, isLoading: sessionLoading } = useSession()
  const router = useRouter()
  const isHome = !activePage
  const [mobileOpen, setMobileOpen] = useState(false)

  const startLabel = session ? "Open dashboard" : "Get started free"

  const inner = (
    <>
      <BrandLogo size={32} priority />

      <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
        {isHome ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger className={NAV_LINK}>
                Product
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                <DropdownMenuItem onClick={() => { document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }) }}>
                  How Atai works
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { document.getElementById("plan")?.scrollIntoView({ behavior: "smooth" }) }}>
                  Plan Mode
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/new/idea")}>Start from an idea</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/new/website")}>Mirror a website</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/new/github")}>Build from GitHub</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/explore")}>Explore projects</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/pricing" className={NAV_LINK}>Pricing</Link>
            <Link href="/resources" className={NAV_LINK}>Resources</Link>
            <Link href="/docs" className={NAV_LINK}>Docs</Link>
            <Link href="/about" className={NAV_LINK}>About</Link>
            <Link href="/explore" className={NAV_LINK}>
              <Compass className="size-3.5" />
              Explore
            </Link>
            {session ? (
              <Link href="/dashboard" className={NAV_LINK}>
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
            ) : null}
          </>
        ) : (
          <>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={activePage === href || activePage === href.replace(/^\//, "") ? NAV_LINK_ACTIVE : NAV_LINK}
              >
                {Icon && <Icon className="size-3.5" />}
                {label}
              </Link>
            ))}
            <Link href="/explore" className={NAV_LINK}>
              <Compass className="size-3.5" />
              Explore
            </Link>
            {session ? (
              <Link href="/dashboard" className={activePage === "/dashboard" ? NAV_LINK_ACTIVE : NAV_LINK}>
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
            ) : null}
          </>
        )}
      </nav>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {session ? (
          <>
            <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "hidden gap-1.5 sm:inline-flex")}>
              {startLabel}
              <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1.5 sm:hidden")}>
              Dashboard
            </Link>
            <AccountMenu />
          </>
        ) : (
          <>
            <AuthTrigger view="login" className={NAV_LINK}>
              Sign in
            </AuthTrigger>
            <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Get started</span>
              <ArrowRight className="hidden size-3.5 sm:block" />
            </AuthTrigger>
          </>
        )}
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="site-mobile-nav"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
    </>
  )

  return (
    <header className={cn(
      "sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl",
      variant === "bordered" && "border-border",
    )}>
      <div className={cn(
        "mx-auto flex w-full items-center justify-between px-6 py-3",
        variant === "bordered" ? "max-w-5xl" : "max-w-7xl lg:px-10",
      )}>
        {inner}
      </div>

      {mobileOpen && (
        <nav
          id="site-mobile-nav"
          className="border-t border-border bg-background px-6 py-4 lg:hidden"
          aria-label="Mobile"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {isHome ? (
              <>
                <a href="#how-it-works" className={NAV_LINK} onClick={() => setMobileOpen(false)}>
                  <Zap className="size-3.5" /> How Atai works
                </a>
                <Link href="/new/idea" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Start from an idea</Link>
                <Link href="/new/website" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Mirror a website</Link>
                <Link href="/new/github" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Build from GitHub</Link>
                <Link href="/pricing" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Pricing</Link>
                <Link href="/resources" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Resources</Link>
                <Link href="/docs" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Docs</Link>
                <Link href="/about" className={NAV_LINK} onClick={() => setMobileOpen(false)}>About</Link>
                <Link href="/explore" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Explore</Link>
              </>
            ) : (
              <>
                {links.map(({ href, label }) => (
                  <Link key={href} href={href} className={NAV_LINK} onClick={() => setMobileOpen(false)}>
                    {label}
                  </Link>
                ))}
                <Link href="/explore" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Explore</Link>
              </>
            )}
            {!session && !sessionLoading && (
              <>
                <AuthTrigger view="login" className={NAV_LINK} onClick={() => setMobileOpen(false)}>Sign in</AuthTrigger>
                <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants(), "mt-2 justify-center")} onClick={() => setMobileOpen(false)}>
                  Get started free
                </AuthTrigger>
              </>
            )}
            {session && (
              <Link href="/dashboard" className={cn(buttonVariants(), "mt-2 justify-center")} onClick={() => setMobileOpen(false)}>
                Open dashboard
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
