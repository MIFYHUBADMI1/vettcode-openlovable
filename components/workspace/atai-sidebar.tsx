"use client"

import type { FormEvent, ReactNode } from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, Search, X } from "lucide-react"
import { BrandMark } from "@/components/brand-logo"
import { CreditMeter } from "@/components/credit-meter"
import { AccountMenu } from "@/components/account-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { VerifyEmailBanner } from "@/components/verify-email-banner"
import { CofounderPanel, useCofounderPanel } from "@/components/cofounder/cofounder-panel"
import { ataiNav } from "@/components/workspace/atai-nav"
import { cn } from "@/lib/utils"

function NavBody({ projectId, onNavigate }: { projectId?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { open } = useCofounderPanel()
  const groups = ataiNav(projectId)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <BrandMark size={28} />
        <Link href="/dashboard" className="font-semibold tracking-tight text-atai-chrome-fg">
          Atai
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Atai">
        {groups.map((group) => (
          <div key={group.label}>
            {group.label !== "Atai" ? (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-atai-chrome-muted/70">{group.label}</p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const className = cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-atai-chrome-fg/12 text-atai-chrome-fg shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--atai-chrome-fg)_10%,transparent)]"
                    : "text-atai-chrome-muted hover:bg-atai-chrome-fg/6 hover:text-atai-chrome-fg",
                )
                if (item.kind === "cofounder") {
                  return (
                    <li key={item.label}>
                      <button type="button" onClick={() => { open(); onNavigate?.() }} className={className}>
                        <item.icon className="size-4 shrink-0 opacity-80" />
                        {item.label}
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={onNavigate} className={className}>
                      <item.icon className="size-4 shrink-0 opacity-80" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.kind === "soon" ? (
                        <span className="rounded-full bg-atai-chrome-fg/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-atai-chrome-muted">
                          Soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-atai-chrome-fg/10 p-3">
        <Link
          href="/settings/billing"
          className="block rounded-2xl bg-primary p-3.5 text-primary-foreground shadow-lg"
        >
          <p className="text-sm font-semibold">Upgrade to Pro</p>
          <p className="mt-1 text-[11px] leading-4 text-primary-foreground/80">Unlock more credits and team capacity when you need them.</p>
        </Link>
        <div className="flex items-center justify-between gap-2 px-0.5">
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

function AtaiTopbar() {
  const router = useRouter()
  const [q, setQ] = useState("")

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    router.push(query ? `/explore?q=${encodeURIComponent(query)}` : "/explore")
  }

  return (
    <header className="atai-chrome sticky top-0 z-20 hidden h-14 items-center gap-3 border-b border-atai-chrome-fg/10 px-4 lg:flex">
      <form onSubmit={onSearch} className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-atai-chrome-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Atai…"
          className="h-9 w-full rounded-full border border-atai-chrome-fg/12 bg-atai-chrome-fg/8 pl-9 pr-3 text-sm text-atai-chrome-fg placeholder:text-atai-chrome-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
      <CreditMeter />
      <AccountMenu />
    </header>
  )
}

export function AtaiSidebar({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <CofounderPanel />
      <aside className="atai-chrome sticky top-0 hidden h-svh w-[248px] shrink-0 overflow-hidden lg:block">
        <NavBody projectId={projectId} />
      </aside>
      <div className="atai-chrome sticky top-0 z-30 flex items-center justify-between border-b border-atai-chrome-fg/10 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <BrandMark size={24} />
          <span className="font-semibold">Atai</span>
        </div>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-atai-chrome-fg/20"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/40" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div className="atai-chrome relative h-full w-[min(248px,80vw)]">
            <NavBody projectId={projectId} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="lg:hidden">
        <VerifyEmailBanner />
      </div>
    </>
  )
}

export function WorkspaceShell({ children, projectId }: { children: ReactNode; projectId?: string }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh flex-col lg:flex-row">
        <AtaiSidebar projectId={projectId} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AtaiTopbar />
          <div className="hidden lg:block">
            <VerifyEmailBanner />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
