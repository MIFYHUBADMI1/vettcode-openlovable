import { Suspense } from "react"
import { PlaygroundClient } from "@/components/developers/playground-client"

export const metadata = { title: "Playground | Atai Developers" }

export default function DevelopersPlaygroundPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PlaygroundClient />
    </Suspense>
  )
}
