"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { jsonFetcher, useProjects, useSession } from "@/lib/client/api"
import { relativeTimeShort } from "@/lib/client/format"
import { buildNotificationInbox, type InboxItem } from "@/lib/dashboard/view-model"
import type { PublicFeatureRequest } from "@/lib/feature-requests/types"
import useSWR from "swr"

const STORAGE_KEY = "atai:dashboard-notifications-read"

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === "string")) : new Set()
  } catch {
    return new Set()
  }
}

function saveRead(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-120)))
  } catch {
    /* ignore quota */
  }
}

const KIND_LABEL: Record<InboxItem["kind"], string> = {
  action: "Needs you",
  progress: "In progress",
  update: "Update",
}

export function DashboardNotifications() {
  const router = useRouter()
  const { projects } = useProjects()
  const { session } = useSession()
  const { data: mine } = useSWR<{ items: PublicFeatureRequest[] }>(
    session ? "/api/feature-requests?mine=1&sort=updated" : null,
    jsonFetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 },
  )
  const [read, setRead] = useState<Set<string>>(new Set())

  useEffect(() => {
    setRead(loadRead())
  }, [])

  const items = useMemo(
    () =>
      buildNotificationInbox({
        projects,
        emailVerified: session?.user.emailVerified ?? true,
        creditsAvailable: session?.credits.available,
        featureRequests: mine?.items,
      }),
    [projects, session, mine],
  )

  const unread = items.filter((item) => !read.has(item.id)).length

  function persist(next: Set<string>) {
    setRead(next)
    saveRead(next)
  }

  function markRead(id: string) {
    const next = new Set(read)
    next.add(id)
    persist(next)
  }

  function markAllRead() {
    const next = new Set(read)
    for (const item of items) next.add(item.id)
    persist(next)
  }

  function openItem(item: InboxItem) {
    markRead(item.id)
    router.push(item.href)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Bell className="size-4" />
        <span className="sr-only">
          {unread > 0 ? `${unread} unread notifications` : "Notifications"}
        </span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-2 text-foreground">
            <span>Inbox</span>
            {unread > 0 ? (
              <button
                type="button"
                className="text-[11px] font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  markAllRead()
                }}
              >
                Mark all read
              </button>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {items.length === 0 ? (
            <>
              <DropdownMenuItem disabled className="items-start whitespace-normal">
                You&apos;re all caught up. When a plan needs review, a build fails, or a request ships, it shows up here.
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/new")}>Start a business</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/feature-requests")}>Shape Atai</DropdownMenuItem>
            </>
          ) : (
            items.map((item) => {
              const unseen = !read.has(item.id)
              return (
                <DropdownMenuItem
                  key={item.id}
                  className="items-start"
                  onClick={() => openItem(item)}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {unseen ? (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      ) : null}
                      <span>{KIND_LABEL[item.kind]}</span>
                      <span>·</span>
                      <span>{relativeTimeShort(item.at)}</span>
                    </span>
                    <span className="text-sm font-medium leading-snug">{item.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>
                    <span className="text-xs text-primary">{item.actionLabel}</span>
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
