"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "", label: "Overview" },
  { href: "/keys", label: "API keys" },
  { href: "/usage", label: "Usage & health" },
  { href: "/playground", label: "Playground" },
] as const

/** Portal nav. Every link preserves ?project=<id> so tabs stay on one project. */
export function DeveloperNav() {
  const pathname = usePathname()
  const params = useSearchParams()
  const project = params.get("project")

  return (
    <nav aria-label="Developer portal" className="flex flex-wrap gap-1 border-b border-border pb-px">
      {LINKS.map((link) => {
        const href = `/developers${link.href}${project ? `?project=${project}` : ""}`
        const active = link.href === "" ? pathname === "/developers" : pathname === `/developers${link.href}`
        return (
          <Link
            key={link.href}
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
