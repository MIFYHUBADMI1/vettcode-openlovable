"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardCommandCenter } from "@/components/dashboard/command-center"
import { useSession } from "@/lib/client/api"

export default function DashboardPage() {
  const router = useRouter()
  const { session, isLoading } = useSession()

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login?next=%2Fdashboard")
    }
  }, [session, isLoading, router])

  if (isLoading || !session) {
    return (
      <DashboardShell title="Home">
        <div className="px-6 py-10 text-sm text-muted-foreground">Loading your workspace…</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Home">
      <DashboardCommandCenter />
    </DashboardShell>
  )
}
