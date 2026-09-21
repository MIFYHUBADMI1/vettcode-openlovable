"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { applyCheckoutReturn } from "@/lib/billing/checkout-return-client"

export function BillingCheckoutReturn() {
  return (
    <Suspense fallback={null}>
      <BillingCheckoutReturnInner />
    </Suspense>
  )
}

function BillingCheckoutReturnInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const started = useRef(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (started.current) return
    if (!searchParams.get("subscription_id")) return
    started.current = true
    setBusy(true)
    void applyCheckoutReturn(searchParams).then((next) => {
      if (next === "start") router.replace("/start")
      else router.replace("/settings/billing")
    })
  }, [router, searchParams])

  if (!busy) return null
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      Confirming your plan and picking up where you left off…
    </div>
  )
}
