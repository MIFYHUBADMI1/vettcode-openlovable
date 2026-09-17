import type { Metadata } from "next"
import { VerifyEmailClient } from "@/components/auth/verify-email-client"

export const metadata: Metadata = {
  title: "Verify email — Atai",
  description: "Verify your Atai email address.",
  robots: { index: false, follow: false },
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  return <VerifyEmailClient searchParams={searchParams} />
}
