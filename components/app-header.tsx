import Link from "next/link"
import { CreditMeter } from "@/components/credit-meter"
import { AccountMenu } from "@/components/account-menu"
import { VerifyEmailBanner } from "@/components/verify-email-banner"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-sm bg-accent text-accent-foreground">
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path
                d="M14.2 14.2H17V6.9375C17 4.76288 15.2371 3 13.0625 3H5.8V5.8M14.2 14.2V7.79063L7.79062 14.2H14.2ZM14.2 14.2V17H6.9375C4.76288 17 3 15.2371 3 13.0625V5.8H5.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-mono text-sm font-medium tracking-tight text-foreground">MirrorSite</span>
        </Link>
        <div className="flex items-center gap-3">
          <CreditMeter />
          <AccountMenu />
        </div>
      </div>
      <VerifyEmailBanner />
    </header>
  )
}
