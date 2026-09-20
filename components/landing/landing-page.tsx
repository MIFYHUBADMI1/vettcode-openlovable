"use client"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { useSession } from "@/lib/client/api"
import { LandingHero } from "@/components/landing/hero"
import {
  LandingAudience,
  LandingBuild,
  LandingFinalCta,
  LandingGrow,
  LandingInfra,
  LandingLifecycle,
  LandingManage,
  LandingPlan,
  LandingStart,
  LandingTrust,
} from "@/components/landing/sections"

export default function LandingPage() {
  const { session } = useSession()
  const ctaHref = session ? "/dashboard" : "/register"
  const ctaLabel = session ? "Open dashboard" : "Get started free"

  return (
    <main className="lp-root min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="lp-ambient" aria-hidden />
      <SiteHeader />
      <LandingHero ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <LandingTrust />
      <LandingLifecycle />
      <LandingStart />
      <LandingPlan />
      <LandingBuild />
      <LandingInfra />
      <LandingManage />
      <LandingGrow />
      <LandingAudience />
      <LandingFinalCta ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <SiteFooter />
    </main>
  )
}
