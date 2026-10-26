"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sparkles, X, ArrowUp, Loader2, Mic } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { CofounderActionCard } from "@/components/cofounder/action-cards"
import { CofounderWorklog, buildCofounderWorklogSteps } from "@/components/cofounder/cofounder-worklog"
import { jsonFetcher } from "@/lib/client/api"
import { sendCofounderMessage } from "@/lib/client/cofounder"
import { useVoiceDictation } from "@/lib/client/use-voice-dictation"
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

export interface CofounderOpenOptions {
  draft?: string
}

interface PanelControls {
  open: (opts?: CofounderOpenOptions) => void
}

let openPanelExternally: ((opts?: CofounderOpenOptions) => void) | null = null

/** Imperative opener so any surface (header, dashboard cards) can launch the
 * panel without prop-drilling through the whole tree. */
export function useCofounderPanel(): PanelControls {
  return {
    open: (opts) => openPanelExternally?.(opts),
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
    else if (pathname.endsWith("/progress")) currentSurface = "progress"
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
  const [lastRun, setLastRun] = useState<{ id: number; message: string } | null>(null)
  const [worklogVisible, setWorklogVisible] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const dictation = useVoiceDictation({ value: draft, setValue: setDraft })

  // Expose the imperative opener.
  useEffect(() => {
    openPanelExternally = (opts) => {
      if (opts?.draft) setDraft(opts.draft)
      setOpen(true)
    }
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

  // Auto-scroll to the newest message. The ScrollArea viewport owns the
  // scroll (the inner content div does not), so anchor to a sentinel and let
  // the viewport follow it — including when the worklog appears.
  useEffect(() => {
    const anchor = bottomRef.current
    if (!anchor) return
    const viewport = anchor.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
    else anchor.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending, worklogVisible, loading])

  // Keep the completed worklog on screen briefly, then return to the
  // transcript; failures hide it immediately (the error card replaces it).
  useEffect(() => {
    if (sending) {
      setWorklogVisible(true)
      return
    }
    if (!worklogVisible) return
    const timer = window.setTimeout(() => setWorklogVisible(false), 900)
    return () => window.clearTimeout(timer)
  }, [sending, worklogVisible])

  const worklogSteps = useMemo(
    () => (lastRun ? buildCofounderWorklogSteps({ message: lastRun.message, surface: "workspace" }) : []),
    [lastRun],
  )

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
    // Catch a sentence the user finished speaking but didn't finalize before
    // hitting send — the interim transcript is not in the field yet.
    const pendingSpeech = dictation.listening ? dictation.partial.trim() : ""
    const text = [draft.trim(), pendingSpeech].filter(Boolean).join(" ")
    if (!text || sending) return
    if (dictation.listening) dictation.stop()
    setSending(true)
    setError(null)
    setDraft("")
    setLastRun({ id: Date.now(), message: text })
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dictation.stop()
        setOpen(next)
      }}
    >
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
          <div className="flex flex-col gap-3 px-4 py-4">
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
                <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                  {m.role === "assistant" ? (
                    <div className="w-full">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        <Sparkles className="size-3 text-primary" aria-hidden />
                        Co-founder
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{m.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[88%] text-right">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                        You
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">{m.content}</p>
                    </div>
                  )}
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
            {lastRun && worklogVisible && !error ? (
              <CofounderWorklog key={lastRun.id} steps={worklogSteps} active={sending} />
            ) : null}
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            <div ref={bottomRef} aria-hidden />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t border-border px-3 py-3">
          {dictation.listening ? (
            <div
              className="voice-panel mb-2 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2"
              role="status"
              aria-live="polite"
            >
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
                <span className="voice-halo absolute inset-0 rounded-full border border-primary/40" aria-hidden />
                <span className="flex h-4 items-end gap-[3px]" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="voice-bar w-[3px] rounded-full bg-primary"
                      style={{
                        height: `${Math.max(4, Math.min(18, 5 + dictation.level * 64 + (i % 2 === 0 ? 3 : 0)))}px`,
                      }}
                    />
                  ))}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                  Listening
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {dictation.partial ? (
                    <>
                      {dictation.partial}
                      <span
                        className="voice-caret ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-primary align-middle"
                        aria-hidden
                      />
                    </>
                  ) : (
                    "Speak — each phrase lands in the box as you finish it."
                  )}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={dictation.stop}
                className="h-7 shrink-0 px-2.5 text-xs"
              >
                Stop
              </Button>
            </div>
          ) : null}
          <div
            className={cn(
              "flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 transition-[border-color,box-shadow] duration-200 focus-within:border-ring",
              dictation.listening && "border-primary/50 ring-2 ring-primary/15",
            )}
          >
            <Textarea
              value={draft}
              onChange={(e) => dictation.typeText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={dictation.listening ? "Listening — speak now…" : "Message your co-founder…"}
              aria-label="Message your co-founder"
              rows={1}
              className="max-h-32 min-h-6 flex-1 resize-none border-0 p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={dictation.toggle}
              disabled={sending}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? "Stop voice input" : "Voice input"}
              className={cn(
                "relative shrink-0 text-muted-foreground hover:text-foreground",
                dictation.listening &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
            >
              {dictation.listening ? (
                <span className="voice-halo absolute -inset-1 rounded-full border border-primary/50" aria-hidden />
              ) : null}
              <Mic className={cn("size-4", dictation.listening && "relative")} />
            </Button>
            <Button
              size="icon-sm"
              onClick={() => void handleSend()}
              disabled={sending || (draft.trim().length === 0 && !dictation.partial.trim())}
              aria-label="Send message"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
          {dictation.error ? (
            <p role="alert" className="mt-1.5 px-1 text-[11px] text-destructive">
              {dictation.error}
            </p>
          ) : null}
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
