import type { Metadata } from "next"
import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist on Atai.",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-10 flex justify-center">
          <BrandLogo href="/" size={36} />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page isn’t here</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          The link may be old, or this page was never created. Nothing on your account was changed.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Home
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Need help?{" "}
          <Link href="/docs" className="font-medium text-primary hover:underline">
            Open docs
          </Link>
        </p>
      </div>
    </main>
  )
}
