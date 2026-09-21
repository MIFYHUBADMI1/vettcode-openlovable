"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { BrandLogo } from "@/components/brand-logo"

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
  marketing,
}: {
  title: string
  subtitle: string
  footer: { prompt: string; linkLabel: string; href: string }
  children: ReactNode
  marketing?: ReactNode
}) {
  return (
    <main className="workspace-environment min-h-screen w-full">
      <span className="workspace-signal" aria-hidden="true" />

      <div className="grid min-h-screen w-full lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12">
          <BrandLogo href="/" size={40} className="mb-10" />

          <div className="w-full max-w-sm">
            <div className="auth-glass-card rounded-2xl p-8">
              <div className="mb-7 flex flex-col gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              </div>
              {children}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {footer.prompt}{" "}
              <Link
                href={footer.href}
                className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
              >
                {footer.linkLabel}
              </Link>
            </p>
          </div>
        </div>

        {marketing ? (
          <div className="relative z-10 hidden items-center overflow-hidden px-10 py-16 lg:flex 2xl:px-16">
            <div className="auth-gradient-divider absolute bottom-[10%] left-0 top-[10%]" aria-hidden />
            <div className="auth-aurora auth-aurora-1" />
            <div className="auth-aurora auth-aurora-2" />
            <div className="relative w-full">{marketing}</div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
