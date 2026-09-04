"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, ShoppingCart, CreditCard, ArrowLeft, Gauge, UserPlus, Database, MessageSquare } from "lucide-react"

const links = [
  { href: "/admin", label: "Admin", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: ShoppingCart },
  { href: "/admin/transactions", label: "Transactions", icon: CreditCard },
  { href: "/admin/referrals", label: "Referrals", icon: UserPlus },
  { href: "/admin/infrastructure", label: "Infrastructure", icon: Database },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/dashboard", label: "User Dashboard", icon: Gauge },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-6 py-2">
        <Link
          href="/settings"
          className="mr-4 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-mono text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        <div className="h-4 w-px bg-border mr-2" />
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
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
