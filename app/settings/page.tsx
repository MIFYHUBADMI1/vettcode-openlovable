import Link from "next/link"
import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/credits/credits"
import { AdminSelfCredit } from "@/components/admin-self-credit"

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
            <p className="mt-2 text-sm text-muted-foreground">Available build credits</p>
            <div className="mt-4 flex gap-3">
              <Link href="/billing/top-up" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">+ Top Up</Link>
              <Link href="/settings/billing" className="inline-block font-mono text-xs text-primary hover:underline">View history →</Link>
            </div>
          </div>
        </section>
        {user.isAdmin ? (
          <section className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
            <div className="mt-5 flex flex-col divide-y divide-border">
              <Link href="/admin" className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-primary">
                <span className="font-medium">Dashboard</span>
                <span className="font-mono text-xs text-primary">→</span>
              </Link>
              <Link href="/admin/payments" className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-primary">
                <span>Payment Verifications</span>
                <span className="font-mono text-xs text-primary">→</span>
              </Link>
              <Link href="/admin/users" className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-primary">
                <span>User Management</span>
                <span className="font-mono text-xs text-primary">→</span>
              </Link>
              <Link href="/admin/transactions" className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-primary">
                <span>Credit Transactions</span>
                <span className="font-mono text-xs text-primary">→</span>
              </Link>
            </div>
            <AdminSelfCredit />
            <div className="mt-5 border-t border-border pt-5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Account</p>
              <div className="flex flex-col divide-y divide-border">
                <Link href="/settings/profile" className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-primary">
                  <span>Edit profile &amp; avatar</span>
                  <span className="font-mono text-xs text-primary">→</span>
                </Link>
                <Link href="/settings/security" className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-primary">
                  <span>Change password &amp; security</span>
                  <span className="font-mono text-xs text-primary">→</span>
                </Link>
              </div>
            </div>
          </section>
        ) : null}
        {/* ── WhatsApp Community Banner ── */}
        <a
          href="https://chat.whatsapp.com/CB3zVz7UnsQLfDjjk04gt1"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden rounded-xl border border-[#25D366]/40 bg-gradient-to-br from-[#25D366]/10 via-[#128C7E]/5 to-[#075E54]/10 p-6 transition-all duration-200 hover:border-[#25D366]/70 hover:shadow-lg hover:shadow-[#25D366]/10"
        >
          {/* New badge */}
          <span className="absolute right-4 top-4 animate-pulse rounded-full bg-[#25D366] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
            New
          </span>

          <div className="flex items-start gap-4">
            {/* WhatsApp icon */}
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] shadow-md shadow-[#25D366]/30 transition-transform duration-200 group-hover:scale-105">
              <svg viewBox="0 0 32 32" className="size-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2C8.268 2 2 8.268 2 16c0 2.417.638 4.683 1.754 6.65L2 30l7.555-1.73A13.934 13.934 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2Zm0 25.5a11.44 11.44 0 0 1-5.844-1.602l-.418-.248-4.486 1.027 1.063-4.363-.274-.436A11.46 11.46 0 0 1 4.5 16C4.5 9.649 9.649 4.5 16 4.5S27.5 9.649 27.5 16 22.351 27.5 16 27.5Zm6.29-8.558c-.345-.172-2.04-1.006-2.356-1.12-.316-.115-.546-.172-.776.172-.23.345-.89 1.12-1.09 1.35-.2.23-.4.259-.745.086-.345-.172-1.456-.537-2.773-1.71-1.025-.913-1.717-2.04-1.917-2.385-.2-.345-.021-.531.15-.703.155-.154.345-.4.518-.601.172-.2.23-.345.345-.575.115-.23.057-.431-.029-.603-.086-.172-.776-1.87-1.063-2.56-.28-.673-.565-.582-.776-.593l-.66-.011c-.23 0-.603.086-.918.431s-1.206 1.178-1.206 2.872 1.235 3.33 1.407 3.56c.172.23 2.432 3.712 5.893 5.207.824.356 1.466.568 1.967.728.826.263 1.579.226 2.172.137.663-.099 2.04-.834 2.328-1.638.287-.804.287-1.493.2-1.638-.085-.144-.315-.23-.66-.4Z" />
              </svg>
            </div>

            <div className="min-w-0 flex-1 pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">Join the MirrorSite Community on WhatsApp</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                🎁 <strong className="text-foreground">Monthly token drops</strong> & exclusive discount codes — up to{" "}
                <strong className="text-[#25D366]">96% off</strong> any plan. Holiday deals, building competitions (win free credits!), and insider perks before anyone else. Don't miss out — the community is where the real rewards happen.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-medium text-[#25D366] transition-all group-hover:gap-2.5">
                Join the group
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </p>
            </div>
          </div>
        </a>


      </div>
    </main>
  )
}


