"use client"

import { useState } from "react"
import { MailWarning, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { postJson, useSession } from "@/lib/client/api"

type ResendResult = { sent: true } | { sent: false; reason: "unconfigured" | "delivery_failed" } | { alreadyVerified: true }

/**
 * Persistent nudge shown on authenticated pages until the user verifies
 * their email. Makes the resend action honest: if SMTP isn't configured on
 * this deployment, we say so instead of pretending an email went out.
 */
export function VerifyEmailBanner() {
  const { session, isLoading, refresh } = useSession()
  const [sending, setSending] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || !session || session.user.emailVerified || dismissed) return null

  async function handleResend() {
    setSending(true)
    console.log("[v0] verify-email-banner: resend clicked", { userId: session!.user.id })
    try {
      const result = await postJson<ResendResult>("/api/auth/resend-verification")
      console.log("[v0] verify-email-banner: resend result", result)
      if ("alreadyVerified" in result && result.alreadyVerified) {
        toast.success("Your email is already verified.")
        refresh()
      } else if ("sent" in result && result.sent) {
        toast.success("Verification email sent. Check your inbox.")
      } else if ("reason" in result && result.reason === "unconfigured") {
        toast.error("Email sending isn't configured on this deployment yet, so we couldn't deliver the link.")
      } else {
        toast.error("We couldn't send the email right now. Please try again shortly.")
      }
    } catch (err) {
      console.log("[v0] verify-email-banner: resend failed", { error: (err as Error).message })
      toast.error((err as Error).message || "Couldn't resend the verification email.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 lg:px-10">
      <div className="flex items-center gap-3">
        <MailWarning className="size-4 shrink-0 text-amber-500" />
        <p className="text-sm text-foreground">
          Verify <span className="font-medium">{session.user.email}</span> to unlock your 500 welcome credits and every feature.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={sending} onClick={handleResend} className="h-7 font-mono text-xs">
          {sending ? "Sending…" : "Resend link"}
        </Button>
        <button
          type="button"
          aria-label="Dismiss verification reminder"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
