"use client"

import { useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  Compass,
  Home,
  Menu,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { AccountMenu } from "@/components/account-menu"
import { CreditMeter } from "@/components/credit-meter"
import { ThemeToggle } from "@/components/theme-toggle"
import { VerifyEmailBanner } from "@/components/verify-email-banner"
import { DashboardNotifications } from "@/components/dashboard/dashboard-notifications"
import { useProjects } from "@/lib/client/api"
import { interpretProjectState, selectActiveProject } from "@/lib/dashboard/view-model"
import type { ProjectSummary } from "@/lib/types/project"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/projects", label: "Businesses", icon: Building2 },
  { href: "/new", label: "New business", icon: Sparkles },
  { href: "/explore", label: "Explore", icon: Compass },
] as const

export function DashboardShell({ children, title = "Home" }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname()
  const { projects } = useProjects()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerId = useId()
  const active = selectActiveProject(projects)
  const askHref = active ? `/project/${active.id}/collaborate` : "/new"

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const recent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh">
        <aside
          className={cn(
            "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-card/40 md:flex",
            collapsed ? "w-[4.25rem]" : "w-60",
          )}
        >
          <SidebarBody
            collapsed={collapsed}
            pathname={pathname}
            recent={recent}
            active={active}
            askHref={askHref}
          />
          <button
            type="button"
            className="m-2 inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-background/70"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              id={drawerId}
              className="relative z-50 flex h-full w-72 flex-col border-r border-border bg-background shadow-lg"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <BrandLogo size={28} href="/dashboard" />
                <button
                  type="button"
                  className="rounded-lg p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarBody collapsed={false} pathname={pathname} recent={recent} active={active} askHref={askHref} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-border p-2 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={mobileOpen}
                  aria-controls={drawerId}
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="size-4" />
                  <span className="sr-only">Open navigation</span>
                </button>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Atai</p>
                  <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <ProjectSearch projects={projects} />
                <Link
                  href="/docs"
                  className="hidden rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Help
                </Link>
                <DashboardNotifications project={active} />
                <div className="hidden lg:block">
                  <CreditMeter />
                </div>
                <ThemeToggle />
                <AccountMenu />
              </div>
            </div>
            <VerifyEmailBanner />
          </header>
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

function SidebarBody({
  collapsed,
  pathname,
  recent,
  active,
  askHref,
}: {
  collapsed: boolean
  pathname: string
  recent: ProjectSummary[]
  active: ProjectSummary | null
  askHref: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className={cn("px-1", collapsed && "flex justify-center")}>
        <BrandLogo size={28} href="/dashboard" withWordmark={!collapsed} />
      </div>

      {!collapsed && active ? (
        <div className="rounded-xl border border-border bg-background px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current business</p>
          <p className="mt-1 truncate text-sm font-medium">{active.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {interpretProjectState(active.state, active.id).founderLabel}
          </p>
        </div>
      ) : null}

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV.map((item) => {
          const activeNav =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsed && "justify-center px-0",
                activeNav
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          )
        })}
      </nav>

      {!collapsed ? (
        <div>
          <p className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Businesses</p>
          <ul className="mt-2 space-y-1">
            {recent.length === 0 ? (
              <li className="px-2 text-xs text-muted-foreground">No businesses yet</li>
            ) : (
              recent.map((project) => {
                const status = interpretProjectState(project.state, project.id)
                return (
                  <li key={project.id}>
                    <Link
                      href={`/project/${project.id}`}
                      className="block rounded-lg px-2 py-1.5 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block truncate text-sm">{project.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{status.founderLabel}</span>
                    </Link>
                  </li>
                )
              })
            )}
            <li>
              <Link href="/projects" className="block px-2 py-1 text-xs text-primary hover:underline">
                View all businesses
              </Link>
            </li>
            <li>
              <Link href="/new" className="block px-2 py-1 text-xs text-primary hover:underline">
                Create new project
              </Link>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-1">
        <Link
          href="/settings"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0",
          )}
        >
          <Settings className="size-4" />
          {collapsed ? <span className="sr-only">Settings</span> : "Settings"}
        </Link>
        <Link
          href={askHref}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-primary px-2.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0",
          )}
        >
          <MessageSquare className="size-4" />
          {collapsed ? <span className="sr-only">Ask Atai</span> : "Ask Atai"}
        </Link>
      </div>
    </div>
  )
}

function ProjectSearch({ projects }: { projects: ProjectSummary[] }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return projects.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8)
  }, [projects, q])

  return (
    <div className="relative hidden md:block">
      <label className="sr-only" htmlFor="dashboard-search">
        Search businesses
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          id="dashboard-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Find a business"
          className="w-40 bg-transparent text-sm outline-none lg:w-52"
        />
      </div>
      {open && q.trim() ? (
        <ul className="absolute right-0 z-40 mt-1 w-64 rounded-xl border border-border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">No matching businesses</li>
          ) : (
            matches.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}`}
                  className="block rounded-lg px-2 py-2 text-sm hover:bg-accent"
                >
                  {project.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
