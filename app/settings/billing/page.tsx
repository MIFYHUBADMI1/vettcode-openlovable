import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance, getCreditHistory } from "@/lib/billing/credit-service"
import { subscriptionRecordsCol } from "@/lib/db/collections"
import { PERMANENT_CREDIT_PACKS, SUBSCRIPTION_PLANS, CREDIT_UNIT_NAME, formatUSD } from "@/lib/billing/config"
import { cn } from "@/lib/utils"
import { ArrowRight, Calendar, Check } from "lucide-react"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { PlanCard } from "@/components/billing/plan-card"
import { CancelSubscriptionButton } from "@/components/billing/cancel-subscription-button"

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

function formatPeriodEnd(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default async function BillingSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings%2Fbilling")

  const [balance, creditHistory, activeSubscription] = await Promise.all([
    getBalance(user.id),
    getCreditHistory(user.id, 50),
    (async () => {
      const col = await subscriptionRecordsCol()
      return col.findOne({ userId: user.id, status: { $in: ["active", "trialing"] } })
    })(),
  ])

  // Resolve the active plan — fall back to the Free plan when no paid subscription exists
  const FREE_PLAN = SUBSCRIPTION_PLANS.find((p) => p.id === "free")!
  const activePlan = activeSubscription
    ? (SUBSCRIPTION_PLANS.find((p) => p.id === activeSubscription.planId) ?? FREE_PLAN)
    : FREE_PLAN

  // Unix ms when the current billing period ends (null for free plan)
  const currentPeriodEnd: number | null = activeSubscription?.currentPeriodEnd ?? null

  // The planId passed to PlanCards — "free" when no paid sub
  const activePlanId = activeSubscription?.planId ?? "free"

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
        <Link href="/settings" className="font-mono text-xs text-primary hover:underline">
          ← Settings
        </Link>

        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Billing
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">MirrorSite Billing</h1>
        </header>

        {/* ── Credit Balance Card ── */}
        <section className="border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Available {CREDIT_UNIT_NAME}
              </p>
              <p className="mt-4 text-5xl font-semibold tabular-nums">
                {balance.total.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Subscription: </span>
                  <span className="font-mono font-medium">{balance.subscription.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Permanent: </span>
                  <span className="font-mono font-medium">{balance.permanent.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Subscription credits are consumed first and expire at the end of your billing period.
            Permanent credits never expire and are consumed after subscription credits.
          </p>
        </section>

        {/* ── Current Plan ── */}
        <section className="rounded-lg border border-border bg-card/50 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Current Plan
          </p>
          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{activePlan.name}</p>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="size-3" /> Active
                </span>
              </div>
              {activePlan.id === "free" ? (
                <p className="text-sm text-muted-foreground">
                  Free plan — upgrade to get monthly credits and more features.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formatUSD(activePlan.priceUSD)}/month
                  {" · "}{activePlan.mirrorCredits.toLocaleString()} {CREDIT_UNIT_NAME}/month
                </p>
              )}
              {currentPeriodEnd && (
                <>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3 shrink-0" />
                    Current period ends{" "}
                    <span className="font-medium text-foreground">
                      {formatPeriodEnd(currentPeriodEnd)}
                    </span>
                    {" "}— your credits remain available until then.
                  </p>
                  {activeSubscription && !activeSubscription.cancelAtPeriodEnd && (
                    <div className="mt-2">
                      <CancelSubscriptionButton
                        planName={activePlan.name}
                        periodEnd={currentPeriodEnd}
                        monthlyCredits={activePlan.mirrorCredits}
                        priceUSD={activePlan.priceUSD}
                      />
                    </div>
                  )}
                  {activeSubscription?.cancelAtPeriodEnd && (
                    <div className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                      <strong>Cancellation scheduled:</strong> Your subscription will end on{" "}
                      {formatPeriodEnd(currentPeriodEnd)}. You'll retain access until then.
                    </div>
                  )}
              </>
            )}
            </div>
          </div>
        </section>

        {/* ── How Credits Work ── */}
        <section className="rounded-lg border border-border bg-card/50 p-5">
          <p className="text-sm font-medium">How Credits Work</p>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <span className="font-mono text-primary">1</span>
              <span>Subscription credits are consumed first</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-primary">2</span>
              <span>Permanent credits are consumed second</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-primary">3</span>
              <span>New users get 500 free permanent credits on email verification</span>
            </div>
          </div>
        </section>

        {/* ── Subscription Plans ── */}
        <section className="border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Subscription Plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activePlan.id === "free"
              ? "Choose a plan to unlock monthly credits and more capabilities."
              : <>Monthly subscriptions with recurring credit grants.{" "}
                <span className="font-medium text-primary">Business plan recommended</span> for best value.
              </>
            }
          </p>
          {/* 5 columns: Free + Explorer + Starter + Business + Professional */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-start">
            {SUBSCRIPTION_PLANS.filter((p) => !p.custom).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                activePlanId={activePlanId}
                currentPeriodEnd={currentPeriodEnd}
                isLoggedIn={true}
              />
            ))}
          </div>
        </section>

        {/* ── Buy Permanent Credits ── */}
        <section className="border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Buy Permanent Credits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanent credits never expire and remain available after subscription cancellation.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERMANENT_CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={cn(
                  "rounded-lg border border-border p-4 transition-colors hover:border-primary/50",
                  pack.popular && "border-primary/30",
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{pack.label}</p>
                    <p className="mt-1 text-2xl font-bold text-primary">{formatUSD(pack.priceUSD)}</p>
                  </div>
                  {pack.popular && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Popular</span>
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  ${(pack.priceUSD / pack.credits).toFixed(4)} per credit
                </div>
                <CheckoutButton
                  type="permanent"
                  productId={pack.id}
                  className="mt-3 w-full"
                >
                  Buy {pack.label}
                </CheckoutButton>
              </div>
            ))}
          </div>
        </section>

        {/* ── Credit History ── */}
        <section className="border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Credit History</h2>

          {creditHistory.length > 0 ? (
            <div className="mt-5">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border pb-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <span>Description</span>
                  <span>Type</span>
                  <span>Date</span>
                  <span className="text-right">Credits</span>
                </div>
                <div className="divide-y divide-border">
                  {creditHistory.map((tx) => (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground truncate">{tx.reason}</span>
                      <span className="font-mono text-xs text-muted-foreground capitalize">
                        {tx.creditType}
                      </span>
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
                {creditHistory.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{tx.reason}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {tx.creditType} · {formatFullDate(tx.createdAt)}
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
