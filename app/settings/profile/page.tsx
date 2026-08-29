import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings%2Fprofile")
  return <main className="min-h-svh bg-background text-foreground"><AppHeader /><div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10"><Link href="/settings" className="font-mono text-xs text-primary hover:underline">← Settings</Link><header><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Account</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Profile</h1></header><section className="border border-border bg-card p-6"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Current profile</p><dl className="mt-5 flex flex-col gap-4 text-sm"><div><dt className="text-muted-foreground">Name</dt><dd className="mt-1">{user.name}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1">{user.email}</dd></div><div><dt className="text-muted-foreground">Authentication</dt><dd className="mt-1">{user.authProvider === "google" ? "Google" : "Email and password"}</dd></div></dl></section></div></main>
}
