import type { Metadata } from "next"
import { ConfirmEmailChangeClient } from "@/components/auth/confirm-email-change-client"

export const metadata: Metadata = {
  title: "Confirm email change — Atai",
  description: "Confirm your new email address on Atai.",
}

export default function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  return <ConfirmEmailChangeClient searchParams={searchParams} />
}
