import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = {
  title: "Create account — MirrorSite",
  description: "Create a MirrorSite AI account.",
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start turning websites into working apps."
      footer={{ prompt: "Already have an account?", linkLabel: "Sign in", href: "/login" }}
    >
      <RegisterForm />
    </AuthShell>
  )
}
