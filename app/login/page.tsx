import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginMarketing } from "./login-marketing"

export const metadata: Metadata = {
  title: "Sign in — Atai",
  description: "Sign in to your Atai account and continue building your business.",
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back, founder."
      subtitle="Your team is ready. Pick up where you left off."
      footer={{ prompt: "Don't have an account?", linkLabel: "Start building free →", href: "/register" }}
      marketing={<LoginMarketing />}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
