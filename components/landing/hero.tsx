"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HeroProductStack } from "@/components/landing/product-shot"
import { AuthTrigger } from "@/components/auth/auth-trigger"
import { useSession } from "@/lib/client/api"
import { LandingComposer } from "@/components/landing/composer"

export function LandingHero({
  ctaHref,
  ctaLabel,
}: {
  ctaHref: string
  ctaLabel: string
}) {
  const { session } = useSession()

  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 pb-14 pt-4 lg:px-10 lg:pb-20 lg:pt-6">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
        <div className="flex flex-col items-start">
          <p className="lp-badge mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/8 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            <span className="lp-live-dot size-1.5 rounded-full bg-indigo-500" />
            The AI business building platform
          </p>

          <h1 className="lp-h1 max-w-2xl text-balance text-[1.85rem] font-black leading-[1.12] tracking-[-0.04em] sm:text-4xl lg:text-[2.75rem]">
            Turn your idea into a{" "}
            <span className="lp-gradient-text">real business.</span>
          </h1>

          <p className="lp-copy mt-3 max-w-lg text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            Give Atai an idea, a URL, a website you like, or a GitHub repository. Atai helps you understand it, plan around it, and turn it into a real full-stack product — infrastructure configured out of the box, ready to launch and grow.
          </p>

          <div className="lp-hero-input mt-5 w-full">
            <LandingComposer />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {session ? (
              <Link href={ctaHref} className={cn(buttonVariants({ size: "sm" }), "lp-cta-primary h-9 gap-1.5 px-4 font-semibold")}>
                {ctaLabel}
                <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <AuthTrigger view="signup" next="/new/idea" className={cn(buttonVariants({ size: "sm" }), "lp-cta-primary h-9 gap-1.5 px-4 font-semibold")}>
                {ctaLabel}
                <ArrowRight className="size-3.5" />
              </AuthTrigger>
            )}
            <a href="#how-it-works" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-4")}>
              See how Atai works
            </a>
          </div>
        </div>

        <HeroProductStack className="lg:self-start lg:mt-6" />
      </div>
    </section>
  )
}
