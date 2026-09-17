import type { Metadata } from "next"
import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/register-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { RegisterMarketing } from "./register-marketing"

export const metadata: Metadata = {
  title: "Create account — Atai",
  description: "Create an Atai account.",
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start turning ideas into working apps."
      footer={{ prompt: "Already have an account?", linkLabel: "Sign in", href: "/login" }}
      marketing={<RegisterMarketing />}
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  )
}
