"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "", label: "Overview" },
  { href: "/keys", label: "API keys" },
  { href: "/models", label: "Models" },
  { href: "/limits", label: "Limits" },
  { href: "/usage", label: "Usage" },
  { href: "/requests", label: "Requests" },
  { href: "/health", label: "Health" },
] as const

export function RuntimeNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const base = `/project/${projectId}/runtime`

  return (
    <nav aria-label="Runtime" className="flex flex-wrap gap-1 border-b border-border pb-px">
      {LINKS.map((link) => {
        const href = `${base}${link.href}`
        const active =
          link.href === ""
            ? pathname === base || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-t-md px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
