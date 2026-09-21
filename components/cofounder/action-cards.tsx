"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Compass, Clock, AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { resolveNavigationTarget } from "@/lib/navigation/routes"
import { decideCofounderAction } from "@/lib/client/cofounder"
import type { CofounderMessageAction, CofounderConversationMessage } from "@/lib/cofounder/types"

/**
 * Action-card renderer (spec sections 40–41, 66). Every card is rendered
 * from STRUCTURED backend data — never from model prose. The model cannot
 * make a card appear by claiming something happened.
 */

function CardShell({
  children,
  tone = "default",
}: {
  children: React.ReactNode
  tone?: "default" | "success" | "error" | "warning"
}) {
  return (
    <div
      className={cn(
        "my-2 rounded-xl border p-3 text-sm",
        tone === "default" && "border-border bg-card",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/5",
        tone === "error" && "border-destructive/30 bg-destructive/5",
        tone === "warning" && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      {children}
    </div>
  )
}

function NavigationCard({ action }: { action: Extract<CofounderMessageAction, { kind: "navigation" }> }) {
  let href: string | null = null
  try {
    href = resolveNavigationTarget({ target: action.target, projectId: action.projectId })
  } catch {
    href = null
  }
  if (!href) {
    return (
      <CardShell tone="error">
        <p className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="size-3.5" /> I couldn&apos;t resolve that destination.
        </p>
      </CardShell>
    )
  }
  return (
    <CardShell>
      <Link href={href} className="flex items-center justify-between gap-3 group">
        <span className="flex items-center gap-2 font-medium">
          <Compass className="size-4 text-primary" />
          {action.projectId ? "Opening your project…" : "Taking you there…"}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
          Go <ExternalLink className="size-3" />
        </span>
      </Link>
    </CardShell>
  )
}

function ProjectPickerCard({ action }: { action: Extract<CofounderMessageAction, { kind: "project_picker" }> }) {
  return (
    <CardShell>
      <p className="mb-2 text-xs text-muted-foreground">Which one do you mean?</p>
      <ul className="space-y-1.5">
        {action.projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/project/${p.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-accent"
            >
              <span className="truncate font-medium">{p.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.state}</span>
            </Link>
          </li>
        ))}
      </ul>
    </CardShell>
  )
}

function ActionResultCard({ action }: { action: Extract<CofounderMessageAction, { kind: "action_result" }> }) {
  const { resultType, data, success } = action
  if (!success) {
    return (
      <CardShell tone="error">
        <p className="flex items-start gap-2">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>{String(data.message ?? "That didn't work.")}</span>
        </p>
      </CardShell>
    )
  }

  // Per-type rendering; keep copy plain and non-technical (spec section 41).
  if (resultType === "project_created") {
    const project = data.project as { id: string; name: string } | undefined
    return (
      <CardShell tone="success">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 text-emerald-500" /> Project created
        </p>
        {project ? <p className="mt-1 text-muted-foreground">{project.name}</p> : null}
        {project ? (
          <Link href={`/project/${project.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-fit")}>
            Open project
          </Link>
        ) : null}
      </CardShell>
    )
  }
  if (resultType === "plan_updated") {
    const updated = (data.updated as Array<{ label: string }> | undefined) ?? []
    return (
      <CardShell tone="success">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 text-emerald-500" /> Plan updated
        </p>
        <p className="mt-1 text-muted-foreground">{updated.map((u) => u.label).join(", ")}</p>
        {typeof data.projectId === "string" ? (
          <Link href={`/project/${data.projectId}/plan`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-fit")}>
            View plan
          </Link>
        ) : null}
      </CardShell>
    )
  }
  if (resultType === "build_started") {
    return (
      <CardShell tone="success">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 text-emerald-500" /> Build started
        </p>
        <p className="mt-1 text-muted-foreground">Your application is now building.</p>
        {typeof data.projectId === "string" ? (
          <Link href={`/project/${data.projectId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-fit")}>
            Open project
          </Link>
        ) : null}
      </CardShell>
    )
  }
  if (resultType === "deployment_started") {
    return (
      <CardShell tone="success">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 text-emerald-500" /> Deployment started
        </p>
        <p className="mt-1 text-muted-foreground">Your application is being published.</p>
      </CardShell>
    )
  }
  if (resultType === "auto_completed") {
    return (
      <CardShell tone="success">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4 text-emerald-500" /> Section drafted
        </p>
        <p className="mt-1 text-muted-foreground">
          {String(data.label ?? "Draft ready")}
          {typeof data.remaining === "number" && data.remaining > 0 ? ` · ${data.remaining} sections left` : ""}
        </p>
      </CardShell>
    )
  }
  if (resultType === "navigation") {
    return <NavigationCard action={{ kind: "navigation", target: (data as { target?: never }).target ?? "dashboard", projectId: data.projectId as string | undefined }} />
  }
  // Generic fallback for other result types.
  return (
    <CardShell tone="success">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-emerald-500" /> Done
      </p>
    </CardShell>
  )
}

function PendingActionCard({ action, onResolved }: { action: Extract<CofounderMessageAction, { kind: "pending_action" }>; onResolved?: () => void }) {
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null)
  // A card can arrive already resolved (persisted by the approval endpoint) —
  // render its final state instead of offering buttons that would 409.
  const [resolved, setResolved] = useState<"approved" | "rejected" | "failed" | null>(
    action.resolved === "executed" ? "approved" : action.resolved === "rejected" ? "rejected" : action.resolved === "failed" ? "failed" : null,
  )
  const [error, setError] = useState<string | null>(null)

  const isHardConfirm = action.risk === "HARD_CONFIRM"
  const confirmWord = action.confirmWord
  const needsWord = isHardConfirm && Boolean(confirmWord)
  const expired = action.expiresAt > 0 && action.expiresAt < Date.now()

  async function decide(decision: "approve" | "reject") {
    setBusy(decision)
    setError(null)
    try {
      const res = await decideCofounderAction(action.actionId, decision, needsWord ? confirmText : undefined)
      if (decision === "approve" && res.status === "executed" && res.result) {
        setResolved("approved")
        onResolved?.()
      } else {
        setResolved(decision === "approve" ? "approved" : "rejected")
        onResolved?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.")
      setResolved("failed")
    } finally {
      setBusy(null)
    }
  }

  if (resolved === "approved") {
    return (
      <CardShell tone="success">
        <p className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="size-4 text-emerald-500" /> Approved — {action.description}
        </p>
      </CardShell>
    )
  }
  if (resolved === "rejected") {
    return (
      <CardShell>
        <p className="flex items-center gap-2 text-muted-foreground">
          <XCircle className="size-4" /> Rejected — nothing was changed.
        </p>
      </CardShell>
    )
  }
  if (expired || resolved === "failed") {
    return (
      <CardShell tone="error">
        <p className="flex items-start gap-2">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span>
            {expired ? "That confirmation expired. Ask me to prepare it again if you still want it." : error ?? "That didn't work."}
          </span>
        </p>
      </CardShell>
    )
  }

  return (
    <CardShell tone={isHardConfirm ? "warning" : "default"}>
      <p className="font-medium">{action.description}</p>
      {action.cost ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Cost: {action.cost.amount.toLocaleString()} credits · You have {action.cost.creditsAvailable.toLocaleString()}
        </p>
      ) : null}
      {action.items?.length ? (
        <ul className="mt-2 space-y-2">
          {action.items.map((item) => (
            <li key={item.section} className="rounded-lg border border-border px-3 py-2 text-xs">
              <p className="font-medium">{item.label}</p>
              <p className="mt-1 text-muted-foreground">
                <span className="line-through">{item.currentValue || "(empty)"}</span>
                {" → "}
                <span className="text-foreground">{item.proposedValue}</span>
              </p>
              {item.reason ? <p className="mt-1 italic text-muted-foreground">{item.reason}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {needsWord ? (
        <div className="mt-2">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type "${confirmWord}" to confirm`}
            aria-label={`Type ${confirmWord} to confirm`}
            className="h-8 text-xs"
          />
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy !== null || (Boolean(needsWord) && confirmText.trim() !== confirmWord)}
          onClick={() => decide("approve")}
        >
          {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Confirm
        </Button>
        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => decide("reject")}>
          Cancel
        </Button>
        {isHardConfirm ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-600">
            <AlertTriangle className="size-3" /> Destructive
          </span>
        ) : null}
      </div>
    </CardShell>
  )
}

export function CofounderActionCard({ message, onActionResolved }: { message: CofounderConversationMessage; onActionResolved?: () => void }) {
  if (!message.action) return null
  switch (message.action.kind) {
    case "pending_action":
      return <PendingActionCard action={message.action} onResolved={onActionResolved} />
    case "action_result":
      return <ActionResultCard action={message.action} />
    case "navigation":
      return <NavigationCard action={message.action} />
    case "project_picker":
      return <ProjectPickerCard action={message.action} />
    default:
      return null
  }
}
