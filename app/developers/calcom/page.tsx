import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { CalComConsoleClient } from "@/components/developers/calcom-console-client"

export const metadata = { title: "Cal.com console | Atai Developers" }

/**
 * Owner-only debugging console for the platform's Cal.com integration.
 * Non-admin visitors are sent back to the portal; the API route re-checks
 * the admin session on every call.
 */
export default async function DevelopersCalComConsolePage() {
  const user = await getCurrentUser()
  if (!user?.isAdmin) redirect("/developers")
  return <CalComConsoleClient />
}
