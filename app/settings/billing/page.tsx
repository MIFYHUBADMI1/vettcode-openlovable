import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/credits/credits"
import { store } from "@/lib/store/store"

export default async function BillingSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings%2Fbilling")
  const [balance, transactions] = await Promise.all([getBalance(user.id), store.listTransactions(user.id)])
  return <main className="min-h-svh bg-background text-foreground"><AppHeader /><div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10"><Link href="/settings" className="font-mono text-xs text-primary hover:underline">← Settings</Link><header><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Usage / billing</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Credits</h1></header><section className="border border-border bg-card p-6"><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Available balance</p><p className="mt-4 text-5xl font-semibold tabular-nums">{balance.toLocaleString()}</p><p className="mt-2 text-sm text-muted-foreground">Credits are reserved before builds and refunded when provider work fails.</p></section><section className="border border-border bg-card p-6"><h2 className="text-xl font-medium">Transaction history</h2><div className="mt-5 flex flex-col divide-y divide-border">{transactions.length ? transactions.slice(0, 50).map((tx) => <div key={tx.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{tx.reason}</span><span className={tx.amount >= 0 ? "font-mono text-primary" : "font-mono text-muted-foreground"}>{tx.amount >= 0 ? "+" : ""}{tx.amount}</span></div>) : <p className="py-4 text-sm text-muted-foreground">No transactions yet.</p>}</div></section></div></main>
}
