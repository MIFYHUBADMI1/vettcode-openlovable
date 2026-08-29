import Link from "next/link"
import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/credits/credits"
import { isTotalumConfigured } from "@/lib/integrations/totalum/client"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/service"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings")
  const balance = await getBalance(user.id)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="border-b border-border pb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Account</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your account, credits, and connected services.</p>
        </div>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Profile</p>
            <h2 className="mt-4 text-xl font-medium">{user.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-6 text-xs text-muted-foreground">Authentication: {user.authProvider === "google" ? "Google" : "Email and password"}</p><div className="mt-5 flex gap-4 font-mono text-xs"><Link href="/settings/profile" className="text-primary hover:underline">Profile →</Link><Link href="/settings/security" className="text-primary hover:underline">Security →</Link></div>
          </div>
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Credits</p>
            <p className="mt-4 text-4xl font-semibold tabular-nums">{balance.toLocaleString()}</p>
            <p className="mt-2 text-sm text-muted-foreground">Available build credits</p><Link href="/settings/billing" className="mt-4 inline-block font-mono text-xs text-primary hover:underline">View usage history →</Link>
          </div>
        </section>
        <section className="border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Connected services</p>
          <div className="mt-5 flex flex-col divide-y divide-border">
            <Service name="Totalum application builder" connected={isTotalumConfigured()} />
            <Service name="Firecrawl website analysis" connected={isFirecrawlConfigured()} />
          </div>
        </section>
      </div>
    </main>
  )
}

function Service({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 text-sm">
      <span>{name}</span>
      <span className={connected ? "font-mono text-xs text-primary" : "font-mono text-xs text-muted-foreground"}>
        {connected ? "connected" : "not configured"}
      </span>
    </div>
  )
}
