"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { postJson } from "@/lib/client/api"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await postJson("/api/auth/forgot-password", { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return <div className="flex flex-col gap-4 text-center"><p className="text-sm text-muted-foreground">If an account exists for that email, we&apos;ve sent a password reset link.</p><Link href="/login" className="text-sm font-medium underline underline-offset-4">Return to sign in</Link></div>
  }

  return <form onSubmit={handleSubmit} className="flex flex-col gap-4">
    <div className="flex flex-col gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" size="lg" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</Button>
  </form>
}
