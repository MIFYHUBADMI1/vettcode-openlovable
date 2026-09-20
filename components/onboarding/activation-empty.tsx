"use client"

import Link from "next/link"
import { ONBOARDING_COPY } from "@/lib/onboarding/copy"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ActivationEmpty() {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">01 / Your vision</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{ONBOARDING_COPY.emptyHeading}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{ONBOARDING_COPY.emptyBody}</p>
      <div className="mt-5">
        <Link href="/dashboard?mission=1" className={cn(buttonVariants())}>{ONBOARDING_COPY.emptyCta}</Link>
      </div>
    </section>
  )
}
