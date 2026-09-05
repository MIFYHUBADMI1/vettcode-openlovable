"use client"

import { useState } from "react"
import useSWR from "swr"
import { Check, X, Plus, Trash2, Loader2, ExternalLink, RefreshCw } from "lucide-react"
import { AdminNav } from "@/components/admin-nav"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatUSD } from "@/lib/billing/config"
import { jsonFetcher } from "@/lib/client/api"
import Link from "next/link"

interface DodoProduct {
  id: string
  name: string
  priceUSD: number
  credits: number
  type: "subscription" | "permanent"
  dodoProductId: string
  configured: boolean
  dodoStatus: "synced" | "not_found" | "not_created"
  dodoData: {
    product_id: string
    name: string
    status: string
  } | null
}

export default function DodoProductsAdminPage() {
  const { data, error, isLoading, mutate } = useSWR<{
    products: DodoProduct[]
    total: number
  }>("/api/admin/dodo-products", jsonFetcher)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    type: "subscription" as "subscription" | "permanent",
    name: "",
    description: "",
    priceUSD: "",
    credits: "",
    interval: "monthly" as "monthly" | "yearly",
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/admin/dodo-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: createForm.type,
          name: createForm.name,
          description: createForm.description,
          priceUSD: parseFloat(createForm.priceUSD),
          credits: createForm.type === "permanent" ? parseInt(createForm.credits) : undefined,
          interval: createForm.interval,
        }),
      })
      if (res.ok) {
        setCreateDialogOpen(false)
        setCreateForm({ type: "subscription", name: "", description: "", priceUSD: "", credits: "", interval: "monthly" })
        mutate()
      } else {
        const json = await res.json()
        setCreateError(json.error?.message ?? "Failed to create product")
      }
    } catch {
      setCreateError("Network error. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Delete this product in Dodo? This cannot be undone.")) return
    const res = await fetch(`/api/admin/dodo-products?productId=${productId}`, { method: "DELETE" })
    if (res.ok) mutate()
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dodo Products</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage payment products for subscriptions and credit packs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => mutate()} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </button>
            <Link
              href="https://dashboard.dodopayments.com/products"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="mr-1.5 size-3.5" />
              Dodo Dashboard
            </Link>
            <button onClick={() => setCreateDialogOpen(true)} className={buttonVariants({ size: "sm" })}>
              <Plus className="mr-1.5 size-3.5" />
              Create Product
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load products. Please refresh.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="subscriptions">
            <TabsList>
              <TabsTrigger value="subscriptions">
                Subscriptions ({data?.products.filter((p) => p.type === "subscription").length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="permanent">
                Permanent Credits ({data?.products.filter((p) => p.type === "permanent").length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="all">All ({data?.total ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="subscriptions">
              <ProductTable products={data?.products.filter((p) => p.type === "subscription") ?? []} onDelete={handleDelete} />
            </TabsContent>
            <TabsContent value="permanent">
              <ProductTable products={data?.products.filter((p) => p.type === "permanent") ?? []} onDelete={handleDelete} />
            </TabsContent>
            <TabsContent value="all">
              <ProductTable products={data?.products ?? []} onDelete={handleDelete} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create product dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Dodo Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as "subscription" | "permanent" }))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="subscription">Subscription</option>
                  <option value="permanent">One-time (Permanent Credits)</option>
                </select>
              </div>
              {createForm.type === "subscription" && (
                <div className="grid gap-2">
                  <Label htmlFor="interval">Billing Interval</Label>
                  <select
                    id="interval"
                    value={createForm.interval}
                    onChange={(e) => setCreateForm((f) => ({ ...f, interval: e.target.value as "monthly" | "yearly" }))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Product Name</Label>
              <Input id="name" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="MirrorSite AI — Business" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="600,000 MirrorSite Credits per month."
                className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priceUSD">Price (USD)</Label>
              <Input id="priceUSD" type="number" step="0.01" min="0" value={createForm.priceUSD} onChange={(e) => setCreateForm((f) => ({ ...f, priceUSD: e.target.value }))} placeholder="139.00" />
            </div>
            {createForm.type === "permanent" && (
              <div className="grid gap-2">
                <Label htmlFor="credits">Credits</Label>
                <Input id="credits" type="number" min="0" value={createForm.credits} onChange={(e) => setCreateForm((f) => ({ ...f, credits: e.target.value }))} placeholder="600000" />
              </div>
            )}

            {createError && <p className="text-xs text-destructive">{createError}</p>}

            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setCreateDialogOpen(false)} disabled={creating} className={buttonVariants({ variant: "outline" })}>Cancel</button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !createForm.name || !createForm.description || !createForm.priceUSD}
                className={buttonVariants()}
              >
                {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                Create Product
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function ProductTable({ products, onDelete }: { products: DodoProduct[]; onDelete: (id: string) => void }) {
  if (products.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted/50 p-3">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No products configured yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Products ({products.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Credits</th>
                <th className="px-5 py-3 text-center font-medium text-muted-foreground">Dodo Status</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, i) => (
                <tr key={product.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${product.type === "subscription" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"}`}>
                        {product.type === "subscription" ? "Sub" : "One-time"}
                      </span>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {formatUSD(product.priceUSD)}
                    {product.type === "subscription" && <span className="ml-0.5 text-xs text-muted-foreground">/mo</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {product.credits.toLocaleString()}
                    <span className="ml-1 text-xs text-muted-foreground">cr</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={
                        product.dodoStatus === "synced"
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : product.dodoStatus === "not_found"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-muted text-muted-foreground"
                      }
                    >
                      {product.dodoStatus === "synced" && <Check className="mr-1 size-3" />}
                      {product.dodoStatus === "not_found" && <X className="mr-1 size-3" />}
                      {product.dodoStatus === "synced" ? "Synced" : product.dodoStatus === "not_found" ? "Not Found" : "Not Created"}
                    </Badge>
                    {product.dodoData && (
                      <a
                        href={`https://dashboard.dodopayments.com/products/${product.dodoData.product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        View <ExternalLink className="size-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => onDelete(product.dodoProductId || product.id)}
                      disabled={!product.dodoProductId}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Products are sourced from your environment config and Dodo Payments. Run{" "}
          <code className="rounded bg-muted px-1 font-mono">npx tsx scripts/setup-dodo-products.ts</code>{" "}
          to provision missing products.
        </div>
      </CardContent>
    </Card>
  )
}
