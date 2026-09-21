"use client"

import { postJson } from "@/lib/client/api"
import { restorePendingStart } from "@/lib/auth/client-intent"

export async function applyCheckoutReturn(search: URLSearchParams): Promise<"start" | "billing" | "none"> {
  const subscriptionId = search.get("subscription_id")
  const status = search.get("status")
  if (!subscriptionId || (status && status !== "active" && status !== "succeeded")) return "none"
  try {
    await postJson("/api/billing/sync", { subscriptionId })
  } catch {
    /* webhook may still catch up */
  }
  const pending = await restorePendingStart()
  return pending?.prompt ? "start" : "billing"
}
