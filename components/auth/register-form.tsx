"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { AuthPageAdapter } from "@/components/auth/auth-panel"
import { persistReferralCode } from "@/lib/auth/client-intent"

export function RegisterForm() {
  const searchParams = useSearchParams()
  const referralCode = searchParams.get("ref")
  const next = searchParams.get("next") || undefined

  useEffect(() => {
    persistReferralCode(referralCode)
  }, [referralCode])

  return <AuthPageAdapter initialView="signup" next={next} />
}
