import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { AuthVisual } from "@/components/auth/auth-visual"

export const metadata: Metadata = {
  title: "Choose a new password — Atai",
  description: "Set a new password for your Atai account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { token } = await searchParams
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Choose a new password, then sign in again."
      footer={{ prompt: "Remembered it after all?", linkLabel: "Sign in", href: "/login" }}
      marketing={
        <AuthVisual
          eyebrow="Account"
          heading="Back to your workspace in a moment."
          body="Your businesses, plans, and credits are untouched. Setting a new password signs out every other device."
          primary={{
            src: "/landing-images/atai-workspace.png",
            alt: "Atai workspace you'll return to after resetting your password",
          }}
        />
      }
    >
      <ResetPasswordForm token={typeof token === "string" ? token : null} />
    </AuthShell>
  )
}
