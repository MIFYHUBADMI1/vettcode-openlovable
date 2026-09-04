import type { Metadata } from "next"
import { VerifyEmailClient } from "@/components/auth/verify-email-client"

export const metadata: Metadata = {
  title: "Verify email — MirrorSite",
  description: "Verify your MirrorSite AI email address.",
  robots: { index: false, follow: false },
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  return <VerifyEmailClient searchParams={searchParams} />
}
