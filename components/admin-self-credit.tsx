"use client"

import { useState } from "react"
import { Coins } from "lucide-react"
import { postJson } from "@/lib/client/api"
import { toast } from "sonner"

export function AdminSelfCredit() {
  const [amount, setAmount] = useState<string>("100000")
  const [loading, setLoading] = useState(false)

  async function handleGrant() {
    const num = parseInt(amount, 10)
    if (!num || num <= 0) {
      toast.error("Enter a valid amount.")
      return
    }

    setLoading(true)
    try {
      const res = await postJson<{ message: string; newBalance: number }>("/api/admin/self-credits", {
        amount: num,
      })
      toast.success(`${res.message} New balance: ${res.newBalance.toLocaleString()}`)
      setAmount("100000")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant credits.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Self-Credit (Testing)</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          min={1}
          max={1000000}
        />
        <button
          onClick={handleGrant}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Coins className="size-3.5" />
          {loading ? "Granting…" : "Grant credits"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Max 1,000,000 per operation.</p>
    </div>
  )
}
