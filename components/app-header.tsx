"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Compass, LayoutDashboard, Lightbulb, Menu, Sparkles } from "lucide-react"
import { CreditMeter } from "@/components/credit-meter"
import { AccountMenu } from "@/components/account-menu"
import { VerifyEmailBanner } from "@/components/verify-email-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { CofounderLauncherButton } from "@/components/cofounder/cofounder-launcher"
import { CofounderPanel, useCofounderPanel } from "@/components/cofounder/cofounder-panel"
import { useSession } from "@/lib/client/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const NAV_LINK =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const ICON_BUTTON =
  "grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      {/* One panel instance for the whole header — both the desktop button and the mobile menu use it. */}
      <CofounderPanel />
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 lg:gap-5">
          <BrandLogo size={28} className="shrink-0" />
          <nav className="hidden items-center gap-2 lg:flex" aria-label="Primary">
            <CofounderLauncherButton withPanel={false} />
            <Link href="/explore" className={NAV_LINK}>
              <Compass className="size-3.5" />
              Explore
            </Link>
            <div className="hidden xl:block">
              <Link href="/feature-requests" className={NAV_LINK}>
                <Lightbulb className="size-3.5" />
                Feature requests
              </Link>
            </div>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
          <AppHeaderMenu />
          <ThemeToggle />
          <div className="hidden sm:block">
            <CreditMeter />
          </div>
          <AccountMenu />
        </div>
      </div>
      <VerifyEmailBanner />
    </header>
  )
}

function AppHeaderMenu() {
  const router = useRouter()
  const { open } = useCofounderPanel()
  const { session } = useSession()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${ICON_BUTTON} lg:hidden`} aria-label="Open menu">
        <Menu className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {session ? (
          <>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <span>Credits</span>
              <span className="font-mono text-xs tabular-nums text-foreground">
                {session.credits.available.toLocaleString()}
              </span>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => open()} className="gap-2">
          <Sparkles className="size-4 text-primary" />
          Ask your co-founder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard")} className="gap-2">
          <LayoutDashboard className="size-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/projects")} className="gap-2">
          <Building2 className="size-4" />
          Businesses
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/explore")} className="gap-2">
          <Compass className="size-4" />
          Explore
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/feature-requests")} className="gap-2">
          <Lightbulb className="size-4" />
          Feature requests
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
