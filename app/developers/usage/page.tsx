import { Suspense } from "react"
import { DevelopersUsageClient } from "@/components/developers/usage-client"

export const metadata = { title: "Usage & Health | Atai Developers" }

export default function DevelopersUsagePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DevelopersUsageClient />
    </Suspense>
  )
}
