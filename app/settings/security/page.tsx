import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings%2Fsecurity")
  return <main className="min-h-svh bg-background text-foreground"><AppHeader /><div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10"><Link href="/settings" className="font-mono text-xs text-primary hover:underline">← Settings</Link><header><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Account</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Security</h1></header><section className="border border-border bg-card p-6"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Sign-in security</p><p className="mt-4 text-sm leading-6 text-muted-foreground">Your account uses {user.authProvider === "google" ? "Google authentication" : "email and password authentication"}. Sessions are protected with server-side cookies and ownership checks.</p><Link href="/forgot-password" className="mt-5 inline-block font-mono text-xs text-primary hover:underline">Reset password →</Link></section></div></main>
}
