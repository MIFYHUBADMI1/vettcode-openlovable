"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sparkles, X, ArrowUp, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { CofounderActionCard } from "@/components/cofounder/action-cards"
import { jsonFetcher } from "@/lib/client/api"
import { sendCofounderMessage } from "@/lib/client/cofounder"
import { resolveNavigationTarget } from "@/lib/navigation/routes"
import type { CofounderConversationMessage } from "@/lib/cofounder/types"
import { cn } from "@/lib/utils"

/**
 * The workspace-level Co-founder panel (spec sections 42–49).
 *
 * - The conversation belongs to the USER and survives navigation; opening the
 *   panel on any route reloads the latest conversation from the server.
 * - Route context (activeProjectId / currentRoute / currentSurface) is sent
 *   with every turn as CONTEXT ONLY — the server still authorizes everything.
 * - Action cards render from structured backend payloads, never model prose.
 */

interface PanelControls {
  open: () => void
}

let openPanelExternally: (() => void) | null = null

/** Imperative opener so any surface (header, dashboard cards) can launch the
 * panel without prop-drilling through the whole tree. */
export function useCofounderPanel(): PanelControls {
  return {
    open: () => openPanelExternally?.(),
  }
}

/** Surface metadata derived from the current route (spec section 48). */
function surfaceFromPathname(pathname: string): { activeProjectId?: string; currentSurface?: string } {
  const projectMatch = /^\/project\/([^/]+)/.exec(pathname)
  const activeProjectId = projectMatch?.[1]
  let currentSurface: string | undefined
  if (activeProjectId) {
    if (pathname.endsWith("/plan")) currentSurface = "plan"
    else if (pathname.endsWith("/collaborate")) currentSurface = "collaborate"
    else if (pathname.endsWith("/database")) currentSurface = "database"
    else if (pathname.endsWith("/runtime")) currentSurface = "runtime"
    else if (pathname.endsWith("/edit")) currentSurface = "edit"
    else if (pathname.endsWith("/source") || pathname.includes("/repo-code")) currentSurface = "source"
    else currentSurface = "overview"
  } else if (pathname.startsWith("/dashboard")) currentSurface = "dashboard"
  else if (pathname.startsWith("/projects")) currentSurface = "projects"
  else if (pathname.startsWith("/settings")) currentSurface = "settings"
  return { ...(activeProjectId ? { activeProjectId } : {}), ...(currentSurface ? { currentSurface } : {}) }
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Working late"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function CofounderPanel() {
  const router = useRouter()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<CofounderConversationMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Expose the imperative opener.
  useEffect(() => {
    openPanelExternally = () => setOpen(true)
    return () => {
      openPanelExternally = null
    }
  }, [])

  // Load (or resume) the conversation when the panel opens. The GET route
  // returns the user's latest conversation — history persists across
  // navigation and sessions (spec sections 27, 47).
  const loadConversation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await jsonFetcher<{ conversation: { id: string; messages: CofounderConversationMessage[] } | null }>(
        "/api/cofounder",
      )
      if (data.conversation) {
        setConversationId(data.conversation.id)
        setMessages(data.conversation.messages ?? [])
      } else {
        setConversationId(undefined)
        setMessages([])
      }
    } catch {
      setError("I couldn't load our conversation. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !conversationId) void loadConversation()
  }, [open, conversationId, loadConversation])

  // Refresh the route-context when the path changes while the panel is open —
  // the co-founder follows the founder across surfaces (spec section 48).
  const routeContext = useMemo(() => surfaceFromPathname(pathname), [pathname])

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  // Follow structured navigation results (spec section 65). The model never
  // produces an href — the client resolves the target through the registry.
  const followNavigation = useCallback(
    (msgs: CofounderConversationMessage[]) => {
      for (const m of msgs) {
        if (m.action?.kind === "navigation") {
          try {
            const href = resolveNavigationTarget({ target: m.action.target, projectId: m.action.projectId })
            setOpen(false)
            router.push(href)
            return
          } catch {
            // Unresolvable target → ignore; the card shows a safe error.
          }
        }
      }
    },
    [router],
  )

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    setDraft("")
    // Optimistic user message for immediate feedback; the server response
    // replaces the tail with the persisted canonical messages.
    const optimistic: CofounderConversationMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content: text,
      at: Date.now(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const turn = await sendCofounderMessage(text, conversationId, routeContext)
      setConversationId(turn.conversationId)
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), ...turn.messages])
      followNavigation(turn.messages)
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setDraft(text)
      setError(e instanceof Error ? e.message : "I couldn't send that. Please try again.")
    } finally {
      setSending(false)
    }
  }

  // Keyboard: Enter sends, Shift+Enter adds a line (desktop-first composer).
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  const hour = new Date().getHours()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-[calc(100%-0rem)] flex-col gap-0 rounded-none p-0 sm:h-[85vh] sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl",
        )}
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <DialogHeader className="gap-0">
                <DialogTitle className="truncate text-sm font-semibold">Your co-founder</DialogTitle>
                <DialogDescription className="sr-only">
                  Workspace-aware AI co-founder conversation
                </DialogDescription>
              </DialogHeader>
              <p className="truncate text-xs text-muted-foreground">
                {greetingForHour(hour)} — I know what you&apos;re building.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close co-founder">
            <X className="size-4" />
          </Button>
        </div>

        {/* Conversation */}
        <ScrollArea className="min-h-0 flex-1">
          <div ref={scrollRef} className="flex flex-col gap-3 px-4 py-4">
            {loading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium">What should we work on today?</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Ask about your projects, your plans, or what to do next. I can look at your workspace and act on it —
                  with your approval for anything that matters.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
                      m.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-card",
                    )}
                  >
                    {m.content}
                  </div>
                  {m.action ? (
                    <div className="w-full max-w-[95%]">
                      <CofounderActionCard
                        message={m}
                        onActionResolved={() => {
                          // Reload after a mutation so the transcript reflects
                          // the executed result cards (spec section 55).
                          void loadConversation()
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ))
            )}
            {sending ? (
              <div className="flex items-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-ring">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message your co-founder…"
              aria-label="Message your co-founder"
              rows={1}
              className="max-h-32 min-h-6 flex-1 resize-none border-0 p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button size="icon-sm" onClick={() => void handleSend()} disabled={sending || draft.trim().length === 0} aria-label="Send message">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            I&apos;ll ask before anything consequential — projects, plans, builds, deployments.{" "}
            <a
              href="/sdk"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              What can your app use? See the Atai SDK &amp; API →
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
