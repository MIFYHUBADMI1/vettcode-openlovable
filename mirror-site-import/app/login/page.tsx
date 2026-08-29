import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = {
  title: "Sign in — MirrorSite",
  description: "Sign in to your MirrorSite AI account.",
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Continue building with MirrorSite AI."
      footer={{ prompt: "Don't have an account?", linkLabel: "Create one", href: "/register" }}
    >
      <LoginForm searchParams={searchParams} />
    </AuthShell>
  )
}
