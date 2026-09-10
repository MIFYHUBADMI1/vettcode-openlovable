"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { postJson } from "@/lib/client/api"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

type Status = "confirming" | "success" | "error" | "missing"

export function ConfirmEmailChangeClient({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const [status, setStatus] = useState<Status>("confirming")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    searchParams.then(async (params) => {
      const token = params.token
      if (!token) {
        if (!cancelled) setStatus("missing")
        return
      }
      try {
        const result = await postJson<{ message: string }>("/api/auth/confirm-email-change", { token })
        if (!cancelled) {
          setStatus("success")
          setMessage(result.message)
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error")
          setMessage(err instanceof Error ? err.message : "This link is invalid or has expired.")
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <main className="workspace-environment flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-12">
      <span className="workspace-signal" aria-hidden="true" />
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        {status === "confirming" && (
          <>
            <Loader2 className="size-8 animate-spin text-primary mx-auto" />
            <h1 className="mt-4 text-lg font-semibold text-foreground">Confirming email change…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Hold on a moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="size-12 text-green-500 mx-auto" />
            <h1 className="mt-4 text-lg font-semibold text-foreground">Email updated</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {message ?? "Your email address has been changed successfully."}
            </p>
            <Link href="/settings/security" className={`${buttonVariants({ size: "lg" })} mt-6 w-full`}>
              Back to security settings
            </Link>
          </>
        )}
        {(status === "error" || status === "missing") && (
          <>
            <XCircle className="size-12 text-destructive mx-auto" />
            <h1 className="mt-4 text-lg font-semibold text-foreground">Change failed</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {status === "missing"
                ? "This link is missing a verification token."
                : message ?? "This link is invalid or has expired."}
            </p>
            <Link href="/settings/security" className={`${buttonVariants({ size: "lg" })} mt-6 w-full`}>
              Back to security settings
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
