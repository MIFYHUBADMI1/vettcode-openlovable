import type { Metadata } from "next"
import { ConfirmEmailChangeClient } from "@/components/auth/confirm-email-change-client"

export const metadata: Metadata = {
  title: "Confirm email change — MirrorSite",
  description: "Confirm your new email address on MirrorSite AI.",
}

export default function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  return <ConfirmEmailChangeClient searchParams={searchParams} />
}
