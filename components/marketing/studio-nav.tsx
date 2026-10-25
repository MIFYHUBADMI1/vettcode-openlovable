import Link from "next/link"
import { cn } from "@/lib/utils"

export const STUDIO_TABS = [
  { key: "home", label: "Home" },
  { key: "create", label: "Create" },
  { key: "library", label: "Library" },
  { key: "calendar", label: "Calendar" },
  { key: "brand", label: "Brand" },
] as const

export type StudioTab = (typeof STUDIO_TABS)[number]["key"]

export function isStudioTab(value: string | undefined): value is StudioTab {
  return (STUDIO_TABS as readonly { key: string }[]).some((t) => t.key === value)
}

/**
 * Studio sub-navigation. Links (not client state) so every tab is a real URL
 * that survives refresh and can be bookmarked. The sidebar keeps "Market &
 * grow" active? No — the Studio is its own nav target, so this is the only
 * in-page navigation.
 */
export function StudioNav({ projectId, active }: { projectId: string; active: StudioTab }) {
  return (
    <nav aria-label="Marketing studio sections" className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2">
      {STUDIO_TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={`/project/${projectId}/studio?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
