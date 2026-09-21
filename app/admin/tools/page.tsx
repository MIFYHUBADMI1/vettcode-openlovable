"use client"

import { AdminSelfCredit } from "@/components/admin-self-credit"
import { ADMIN_LEAVE, ADMIN_NAV } from "@/components/admin/admin-nav-config"
import Link from "next/link"

export default function AdminToolsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Overview</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Admin tools</h2>
      <p className="mt-1 text-sm text-muted-foreground">Operator utilities that used to live only on Settings.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <AdminSelfCredit />
      </div>

      <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">All destinations</p>
      <ul className="mt-3 space-y-1">
        {ADMIN_NAV.flatMap((g) => g.items).map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm hover:underline">
              {item.label}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
          </li>
        ))}
        {ADMIN_LEAVE.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
