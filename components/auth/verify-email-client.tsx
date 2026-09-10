"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { postJson } from "@/lib/client/api"

type Status = "verifying" | "success" | "error" | "missing"

export function VerifyEmailClient({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const [status, setStatus] = useState<Status>("verifying")
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
        await postJson("/api/auth/verify-email", { token })
        if (!cancelled) setStatus("success")
      } catch (err) {
        if (!cancelled) {
          setStatus("error")
          setMessage(err instanceof Error ? err.message : "This verification link is invalid.")
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <main className="workspace-environment flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-12"><span className="workspace-signal" aria-hidden="true" />
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        {status === "verifying" && (
          <>
            <h1 className="text-lg font-semibold text-foreground">Verifying your email…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Hold on a moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-lg font-semibold text-foreground">Email verified</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Your email address has been confirmed. You&apos;re all set.
            </p>
            <Link href="/" className={`${buttonVariants({ size: "lg" })} mt-6 w-full`}>Go to dashboard</Link>
          </>
        )}
        {(status === "error" || status === "missing") && (
          <>
            <h1 className="text-lg font-semibold text-foreground">Verification failed</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {status === "missing"
                ? "This link is missing a verification token."
                : message ?? "This verification link is invalid or has expired."}
            </p>
            <Link href="/" className={`${buttonVariants({ size: "lg" })} mt-6 w-full`}>Go to dashboard</Link>
          </>
        )}
      </div>
    </main>
  )
}
