"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useAdminShell } from "@/components/admin/admin-shell"
import { ADMIN_NAV, ADMIN_LEAVE, isAdminNavActive } from "@/components/admin/admin-nav-config"
import { cn } from "@/lib/utils"

/** Legacy top bar. Inside AdminShell it renders nothing so pages keep compiling. */
export function AdminNav() {
  const inShell = useAdminShell()
  const pathname = usePathname()
  if (inShell) return null

  const links = [...ADMIN_NAV.flatMap((g) => g.items), ...ADMIN_LEAVE.filter((i) => i.href === "/dashboard")]

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-6 py-2">
        <Link
          href="/settings"
          className="mr-2 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        {links.map(({ href, label, icon: Icon }) => {
          const active = isAdminNavActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
