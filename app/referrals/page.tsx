import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { ReferralDashboard } from "@/components/referral-dashboard"
import { AppHeader } from "@/components/app-header"

export const metadata: Metadata = {
  title: "Refer & Earn — MirrorSite",
  description: "Invite friends to MirrorSite AI and earn credits when they become active users.",
}

export default async function ReferralsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Freferrals")

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <ReferralDashboard />
    </main>
  )
}
