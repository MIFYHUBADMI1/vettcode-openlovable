"use client"

import Link from "next/link"
import { Compass } from "lucide-react"
import { CreditMeter } from "@/components/credit-meter"
import { AccountMenu } from "@/components/account-menu"
import { VerifyEmailBanner } from "@/components/verify-email-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-5">
          <BrandLogo size={28} />
          <nav className="hidden items-center sm:flex">
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
            >
              <Compass className="size-3.5" />
              Explore
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="sm:hidden inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Compass className="size-3" />
            Explore
          </Link>
          <ThemeToggle />
          <CreditMeter />
          <AccountMenu />
        </div>
      </div>
      <VerifyEmailBanner />
    </header>
  )
}
