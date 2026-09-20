"use client"

import {
  BarChart3,
  Database,
  Globe2,
  LayoutDashboard,
  Sparkles,
  Users,
} from "lucide-react"
import { BrandMark } from "@/components/brand-logo"

/** Demo product chrome for the hero — labelled as a sample workspace. */
export function HeroProductVisual() {
  return (
    <div className="lp-float relative mx-auto w-full max-w-[540px]">
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_70%)] blur-2xl" aria-hidden />

      <div className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/90 shadow-[0_24px_80px_-28px_rgba(37,99,235,0.45)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-xs font-semibold">Atai workspace</span>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Demo</span>
          </div>
          <div className="flex gap-1">
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
          </div>
        </div>

        <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr]">
          <aside className="hidden border-r border-border/60 bg-muted/20 p-3 sm:block">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Navigate</p>
            <ul className="space-y-1">
              {[
                { icon: LayoutDashboard, label: "Overview", active: true },
                { icon: Globe2, label: "Applications" },
                { icon: Users, label: "Customers" },
                { icon: BarChart3, label: "Analytics" },
                { icon: Database, label: "Database" },
              ].map(({ icon: Icon, label, active }) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                    active ? "bg-indigo-500/10 font-semibold text-indigo-600 dark:text-indigo-300" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {label}
                </li>
              ))}
            </ul>
          </aside>

          <div className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sample overview</p>
            <p className="mt-1 text-sm font-semibold">Your digital business, in one place</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Applications", value: "3" },
                { label: "Customers", value: "128" },
                { label: "Status", value: "Live" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/70 bg-background/80 px-2.5 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg font-bold tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium">Launch pipeline</p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Deployed</span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="w-[82%] bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">Plan → Build → Test → Deploy</p>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-float-delayed absolute -right-2 top-16 hidden w-40 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl sm:block">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">AI co-founder</p>
        <p className="mt-1 text-[11px] leading-4 text-foreground">Plan updated with billing flows and account management.</p>
      </div>
      <div className="lp-float-slow absolute -left-3 bottom-10 hidden w-36 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl sm:block">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Hosting</p>
        <p className="mt-1 text-xs font-semibold">HTTPS · CDN · Live</p>
      </div>
    </div>
  )
}

export function PlanModeMockup() {
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-[0_24px_60px_-32px_rgba(79,70,229,0.45)]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-indigo-500" />
          <p className="text-sm font-semibold">Plan Mode</p>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Sample plan</span>
        </div>
        <span className="text-[11px] text-muted-foreground">AI co-founder</span>
      </div>
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-border/60 p-5 lg:border-b-0 lg:border-r">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Business overview</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {["Market", "Product", "Features", "Strategy", "Pricing", "Users", "Infrastructure", "Launch"].map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm">
                <span className="size-1.5 rounded-full bg-indigo-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 bg-muted/20 p-5">
          <div className="self-end max-w-[90%] rounded-2xl rounded-br-md bg-indigo-500/10 px-3 py-2 text-sm">
            Add a subscription system.
          </div>
          <div className="max-w-[95%] rounded-2xl rounded-bl-md border border-border bg-background px-3 py-2 text-sm leading-6 text-muted-foreground">
            I&apos;ve updated the business plan to include subscription tiers, billing flows, account management, and payment requirements.
          </div>
          <p className="mt-auto font-mono text-[10px] text-muted-foreground">The approved plan becomes the source of truth before Atai builds.</p>
        </div>
      </div>
    </div>
  )
}

export function ManageDashboardMockup() {
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-card shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
      <div className="grid md:grid-cols-[10rem_1fr]">
        <aside className="hidden border-r border-border/60 bg-muted/20 p-4 md:block">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</p>
          <ul className="space-y-1 text-[12px]">
            {["Overview", "Applications", "Customers", "Payments", "Database", "AI", "Analytics", "Domains", "Deployment", "Settings"].map((item, i) => (
              <li
                key={item}
                className={`rounded-lg px-2 py-1.5 ${i === 0 ? "bg-indigo-500/10 font-medium text-indigo-600 dark:text-indigo-300" : "text-muted-foreground"}`}
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>
        <div className="p-5">
          <p className="text-sm font-semibold">Business overview</p>
          <p className="mt-1 text-xs text-muted-foreground">Manage the product and the operations around it — without dropping into infrastructure jargon.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Applications", value: "Live" },
              { label: "Customers", value: "Growing" },
              { label: "Deployment", value: "Healthy" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border/70 bg-background px-3 py-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-base font-bold">{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
