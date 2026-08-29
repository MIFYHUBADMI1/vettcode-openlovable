import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password — MirrorSite", description: "Reset your MirrorSite AI password." }

export default function ForgotPasswordPage() {
  return <AuthShell title="Forgot password?" subtitle="Enter your email and we&apos;ll send you a secure reset link." footer={{ prompt: "Remembered your password?", linkLabel: "Sign in", href: "/login" }}><ForgotPasswordForm /></AuthShell>
}
