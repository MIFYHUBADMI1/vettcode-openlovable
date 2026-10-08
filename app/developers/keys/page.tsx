import { Suspense } from "react"
import { DevelopersKeysClient } from "@/components/developers/keys-client"

export const metadata = { title: "API Keys | Atai Developers" }

export default function DevelopersKeysPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <DevelopersKeysClient />
    </Suspense>
  )
}
