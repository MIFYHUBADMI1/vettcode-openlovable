import type { Metadata } from "next"
import { AppHeader } from "@/components/app-header"
import { PlatformFinancesView } from "@/components/finances/platform-finances-view"
import { getPlatformFinances } from "@/lib/finances/platform-finances"
import { getCurrentUser } from "@/lib/auth/session"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Business finances - Atai",
  description: "Your whole business in numbers: runtime API spend, attributed earnings, and estimates — across every project.",
}

/**
 * Whole-business finances — live page (portfolio roll-up over projects).
 *
 * Signed-out visitors are redirected to login with a next-path. Every owned
 * project is included automatically: the roll-up is keyed by the signed-in
 * user's project list resolved server-side, so nothing needs re-explaining
 * per visit.
 *
 * Read-only assembly: viewing never charges credits.
 */
export default async function FinancesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/finances")
  const finances = await getPlatformFinances(user.id)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl px-6 pb-16">
        <PlatformFinancesView finances={finances} />
      </div>
    </main>
  )
}
