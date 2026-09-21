import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { AuthVisual } from "@/components/auth/auth-visual"

export const metadata: Metadata = {
  title: "Forgot password — Atai",
  description: "Reset your Atai password.",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password?"
      subtitle="Enter your email and we'll send a reset link."
      footer={{ prompt: "Remembered your password?", linkLabel: "Sign in", href: "/login" }}
      marketing={
        <AuthVisual
          eyebrow="Account"
          heading="Get back into your workspace."
          body="We'll email a time-limited reset link. Your businesses, plans, and credits stay as they are."
          primary={{
            src: "/landing-images/atai-workspace.png",
            alt: "Atai workspace you'll return to after resetting your password",
          }}
        />
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
