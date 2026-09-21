"use client"

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Shield } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/account-menu"
import { cn } from "@/lib/utils"
import { ADMIN_LEAVE, ADMIN_NAV, allAdminNavItems, isAdminNavActive } from "./admin-nav-config"

const AdminShellContext = createContext(false)

export function useAdminShell() {
  return useContext(AdminShellContext)
}

export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerId = useId()
  const matched = allAdminNavItems()
    .filter((item) => isAdminNavActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  const heading = title ?? matched?.label ?? "Admin"

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <AdminShellContext.Provider value={true}>
      <div className="min-h-svh bg-background text-foreground">
        <div className="flex min-h-svh">
          <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-border bg-card/40 lg:flex">
            <AdminSidebar pathname={pathname} />
          </aside>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-background/70"
                aria-label="Close admin navigation"
                onClick={() => setMobileOpen(false)}
              />
              <aside id={drawerId} className="relative flex h-full w-72 flex-col border-r border-border bg-background">
                <AdminSidebar pathname={pathname} />
              </aside>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent lg:hidden"
                    aria-expanded={mobileOpen}
                    aria-controls={drawerId}
                    onClick={() => setMobileOpen(true)}
                  >
                    <Menu className="size-4" />
                    <span className="sr-only">Open admin navigation</span>
                  </button>
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Shield className="size-3" /> Admin
                    </p>
                    <h1 className="truncate text-sm font-semibold sm:text-base">{heading}</h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <AccountMenu />
                </div>
              </div>
            </header>
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </div>
    </AdminShellContext.Provider>
  )
}

function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className="px-1">
        <BrandLogo size={28} href="/admin" withWordmark />
        <p className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Atai control</p>
      </div>

      {ADMIN_NAV.map((group) => (
        <nav key={group.id} className="flex flex-col gap-1" aria-label={group.label}>
          <p className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
          {group.items.map((item) => {
            const Icon = item.icon
            const active = isAdminNavActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.description}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      ))}

      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
        {ADMIN_LEAVE.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
