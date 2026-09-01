import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/credits/credits"
import { store } from "@/lib/store/store"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

function formatCredits(amount: number): string {
  const abs = Math.abs(amount)
  return amount >= 0 ? `+${abs.toLocaleString()}` : `-${abs.toLocaleString()}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function BillingSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings%2Fbilling")

  const [balance, transactions] = await Promise.all([
    getBalance(user.id),
    store.listTransactions(user.id),
  ])

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <Link href="/settings" className="font-mono text-xs text-primary hover:underline">
          ← Settings
        </Link>

        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Billing
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Credits</h1>
        </header>

        {/* Credit Balance Card */}
        <section className="border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Your Credits
              </p>
              <p className="mt-4 text-5xl font-semibold tabular-nums">
                {balance.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Available credits
              </p>
            </div>
            <Link
              href="/billing/top-up"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-4" />
              Top Up Credits
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Credits are used to build, improve and customize applications with MirrorSite AI.
          </p>
        </section>

        {/* How Credits Work */}
        <section className="rounded-lg border border-border bg-card/50 p-5">
          <p className="text-sm font-medium">How Credits Work</p>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <span className="font-mono text-primary">1</span>
              <span>1 Credit = 1 UGX</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-primary">2</span>
              <span>New users get 500 free credits</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-primary">3</span>
              <span>Buy more via Mobile Money</span>
            </div>
          </div>
        </section>

        {/* Credit History */}
        <section className="border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Credit History</h2>

          {transactions.length > 0 ? (
            <div className="mt-5">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border pb-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>Description</span>
                  <span>Date</span>
                  <span className="text-right">Credits</span>
                </div>
                <div className="divide-y divide-border">
                  {transactions.slice(0, 50).map((tx) => (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground truncate">{tx.reason}</span>
                      <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-sm font-medium tabular-nums text-right",
                          tx.amount >= 0 ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {formatCredits(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile list */}
              <div className="sm:hidden space-y-3">
                {transactions.slice(0, 50).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{tx.reason}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatFullDate(tx.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-sm font-medium tabular-nums shrink-0",
                        tx.amount >= 0 ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {formatCredits(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No transactions yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}

