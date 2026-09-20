"use client"

import { useSearchParams } from "next/navigation"
import { AuthPageAdapter } from "@/components/auth/auth-panel"

const OAUTH_ERROR_MESSAGE = "We couldn't sign you in. Please try again."

export function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const next = searchParams.get("next") || undefined

  let initialError: string | undefined
  if (error === "google_auth_failed" || error === "github_auth_failed") initialError = OAUTH_ERROR_MESSAGE
  if (error === "github_no_email") {
    initialError = "Your GitHub account has no public email. Please add a public email in GitHub settings and try again."
  }
  if (error === "account_banned") initialError = "This account has been banned. Please contact support."
  if (error === "account_suspended") initialError = "This account has been suspended. Please contact support."

  return <AuthPageAdapter initialView="login" next={next} initialError={initialError} />
}
