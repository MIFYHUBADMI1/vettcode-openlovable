import Link from "next/link"
import type { ReactNode } from "react"

/**
 * Shared centered card layout for /login and /register. Keeps the
 * build-console aesthetic (dark, monospace brand mark, single accent) rather
 * than introducing a generic auth-page template.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string
  subtitle: string
  footer: { prompt: string; linkLabel: string; href: string }
  children: ReactNode
}) {
  return (
    <main className="workspace-environment flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-12"><span className="workspace-signal" aria-hidden="true" />
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-sm bg-accent text-accent-foreground">
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path
              d="M14.2 14.2H17V6.9375C17 4.76288 15.2371 3 13.0625 3H5.8V5.8M14.2 14.2V7.79063L7.79062 14.2H14.2ZM14.2 14.2V17H6.9375C4.76288 17 3 15.2371 3 13.0625V5.8H5.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="font-mono text-sm font-medium tracking-tight text-foreground">MirrorSite</span>
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground text-balance">{title}</h1>
          <p className="text-sm text-muted-foreground text-pretty">{subtitle}</p>
        </div>
        {children}
      </div>

      <p className="text-sm text-muted-foreground">
        {footer.prompt}{" "}
        <Link href={footer.href} className="font-medium text-primary underline-offset-4 hover:underline">
          {footer.linkLabel}
        </Link>
      </p>
    </main>
  )
}
