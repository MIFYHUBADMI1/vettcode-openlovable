"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Brain,
  Camera,
  ClipboardList,
  Code2,
  Component,
  Compass,
  Database,
  FileText,
  Gauge,
  Hammer,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Palette,
  Rocket,
  Route,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type PlanOutlineItem = { id: string; label: string; icon: string; count?: number }
export type PlanOutlineGroup = { label: string; items: PlanOutlineItem[] }

const ICONS: Record<string, LucideIcon> = {
  overview: FileText,
  idea: Lightbulb,
  audience: Users,
  flows: Route,
  features: Zap,
  data: Database,
  technical: Server,
  design: Palette,
  business: TrendingUp,
  preferences: SlidersHorizontal,
  metadata: Layers,
  repo: Code2,
  analysis: Brain,
  functionality: ListChecks,
  userFlows: Route,
  components: Component,
  entities: Database,
  designSystem: Palette,
  structure: ClipboardList,
  pages: Compass,
  assets: ImageIcon,
  screenshots: Camera,
  evidence: ClipboardList,
  health: Gauge,
  notes: ListChecks,
  build: Hammer,
  secrets: ShieldCheck,
  deploy: Rocket,
  infrastructure: Server,
  activity: Activity,
  conversation: MessageSquare,
}

function NavItem({
  item,
  active,
  onSelect,
  variant,
}: {
  item: PlanOutlineItem
  active: boolean
  onSelect: (id: string) => void
  variant: "rail" | "bar"
}) {
  const Icon = ICONS[item.icon] ?? FileText
  if (variant === "bar") {
    return (
      <a
        href={`#${item.id}`}
        onClick={() => onSelect(item.id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
          active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="size-3.5" />
        {item.label}
        {typeof item.count === "number" ? (
          <span className="font-mono text-[10px] tabular-nums opacity-70">{item.count}</span>
        ) : null}
      </a>
    )
  }

  return (
    <a
      href={`#${item.id}`}
      onClick={() => onSelect(item.id)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/5 pl-3.5 font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {typeof item.count === "number" ? (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-px font-mono text-[10px] tabular-nums text-muted-foreground">
          {item.count}
        </span>
      ) : null}
    </a>
  )
}

/** Two-tier wayfinding for the plan: a sticky section rail on wide screens,
 *  a scrolling chip bar below the masthead everywhere else. */
export function PlanOutline({ groups }: { groups: PlanOutlineGroup[] }) {
  const [activeId, setActiveId] = useState(groups[0]?.items[0]?.id ?? "")

  // Sections come and go with the project's data, so re-observe whenever the
  // id set changes rather than on every parent render.
  const setKey = groups.map((g) => g.items.map((i) => i.id).join(",")).join("|")

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    )
    for (const group of groups) {
      for (const item of group.items) {
        const el = document.getElementById(item.id)
        if (el) observer.observe(el)
      }
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setKey])

  const select = (id: string) => setActiveId(id)

  return (
    <>
      <nav
        aria-label="Plan sections"
        className="sticky top-20 hidden max-h-[calc(100svh-6rem)] flex-col gap-4 overflow-y-auto border-r border-border pr-3 xl:flex xl:flex-col"
      >
        <p className="px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">On this plan</p>
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavItem key={item.id} item={item} active={item.id === activeId} onSelect={select} variant="rail" />
            ))}
          </div>
        ))}
      </nav>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 xl:hidden">
        <div className="flex w-max items-center gap-2 border-b border-border pb-1">
          {groups.flatMap((group) => group.items).map((item) => (
            <NavItem key={item.id} item={item} active={item.id === activeId} onSelect={select} variant="bar" />
          ))}
        </div>
      </div>
    </>
  )
}
