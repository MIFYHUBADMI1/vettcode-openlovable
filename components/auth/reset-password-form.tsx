"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { postJson, type ApiError } from "@/lib/client/api"

type Status = "ready" | "missing" | "submitting" | "done" | "expired" | "invalid"

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>(token ? "ready" : "missing")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current || !token || status !== "ready") return
    setError(null)
    if (password.length < 8 || password.length > 1024) {
      setError("Choose a password between 8 and 1,024 characters.")
      return
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.")
      return
    }
    pending.current = true
    setStatus("submitting")
    try {
      await postJson("/api/auth/reset-password", { token, password })
      setPassword("")
      setConfirm("")
      window.history.replaceState(null, "", "/reset-password")
      setStatus("done")
    } catch (err) {
      const code = (err as ApiError)?.code
      if (code === "VERIFICATION_EXPIRED") setStatus("expired")
      else if (code === "VERIFICATION_INVALID") setStatus("invalid")
      else {
        setStatus("ready")
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      }
    } finally {
      pending.current = false
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-4 text-center" role="status">
        <p className="text-sm text-muted-foreground text-pretty">
          Your password is set and existing sessions have been signed out. Sign in again with your new password.
        </p>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>Sign in</Link>
      </div>
    )
  }

  if (status === "missing" || status === "expired" || status === "invalid") {
    const message = status === "missing"
      ? "This link is missing its reset token. Open the link from your email, or request a new one."
      : status === "expired"
        ? "This reset link has expired. Reset links last one hour. Request a new one to continue."
        : "This reset link is invalid or has already been used. Request a new one to continue."
    return (
      <div className="flex flex-col gap-4 text-center" role="status">
        <p className="text-sm text-muted-foreground text-pretty">{message}</p>
        <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>Send a new link</Link>
      </div>
    )
  }

  const submitting = status === "submitting"
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={submitting}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={1024}
          className="text-base" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={1024}
          className="text-base" value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={submitting} />
      </div>
      <p className="text-xs text-muted-foreground">At least 8 characters. This link works once and expires an hour after it was sent.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Setting your password…" : "Set new password"}
      </Button>
    </form>
  )
}
