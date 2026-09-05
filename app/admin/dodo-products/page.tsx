import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth/session"
import { SUBSCRIPTION_PLANS, PERMANENT_CREDIT_PACKS, formatUSD } from "@/lib/billing/config"
import { Check, X, Plus, Edit, Trash2, Loader2, ExternalLink } from "lucide-react"
import { AdminNav } from "@/components/admin-nav"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSWRImmutable } from "swr"
import { useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
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
    prices: Array<{
      id: string
      type: string
      currency: string
      price: number
      discount: number
    }>
  } | null
}

export const metadata = {
  title: "Dodo Products | Admin",
  description: "Manage Dodo Payments products for MirrorSite AI",
}

export default async function DodoProductsAdminPage() {
  let user
  try {
    user = await requireAdmin()
  } catch {
    redirect("/login?next=/admin/dodo-products")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader activePage="/admin/dodo-products" variant="bordered" />
      <AdminNav user={user} />

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dodo Products</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage payment products for subscriptions and credit packs
            </p>
          </div>
          <Link
            href="https://dashboard.dodopayments.com/products"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink className="mr-2 size-4" />
            Open Dodo Dashboard
          </Link>
        </div>

        <DodoProductsClient />
      </div>

      <SiteFooter activePage="/admin/dodo-products" links={[{ href: "/", label: "Home" }, { href: "/admin", label: "Admin" }]} />
    </main>
  )
}

function DodoProductsClient() {
  const { data, error, isLoading } = useSWRImmutable<{
    products: DodoProduct[]
    total: number
    dodoTotal: number
  }>("/api/admin/dodo-products")

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

  const handleCreate = async () => {
    setCreating(true)
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
        setCreateForm({
          type: "subscription",
          name: "",
          description: "",
          priceUSD: "",
          credits: "",
          interval: "monthly",
        })
        // Force refetch
        window.location.reload()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Delete this product in Dodo? This cannot be undone.")) return

    const res = await fetch(`/api/admin/dodo-products?productId=${productId}`, {
      method: "DELETE",
    })

    if (res.ok) {
      window.location.reload()
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-600">Failed to load products. Please try again.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList>
          <TabsTrigger value="subscriptions">
            Subscriptions ({data?.products.filter((p) => p.type === "subscription").length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="permanent">
            Permanent Credits ({data?.products.filter((p) => p.type === "permanent").length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({data?.total ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <ProductTable
            products={data?.products.filter((p) => p.type === "subscription") ?? []}
            onDelete={handleDelete}
            onCreateClick={() => setCreateDialogOpen(true)}
            creating={creating}
          />
        </TabsContent>

        <TabsContent value="permanent">
          <ProductTable
            products={data?.products.filter((p) => p.type === "permanent") ?? []}
            onDelete={handleDelete}
            onCreateClick={() => setCreateDialogOpen(true)}
            creating={creating}
          />
        </TabsContent>

        <TabsContent value="all">
          <ProductTable
            products={data?.products ?? []}
            onDelete={handleDelete}
            onCreateClick={() => setCreateDialogOpen(true)}
            creating={creating}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Dodo Product</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v as "subscription" | "permanent" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="permanent">One-time (Permanent Credits)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {createForm.type === "subscription" && (
                <div className="grid gap-2">
                  <Label htmlFor="interval">Billing Interval</Label>
                  <Select
                    value={createForm.interval}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, interval: v as "monthly" | "yearly" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="MirrorSite AI — Business"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="600,000 MirrorSite Credits per month. For teams and businesses."
                className="min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priceUSD">Price (USD)</Label>
              <Input
                id="priceUSD"
                type="number"
                step="0.01"
                min="0"
                value={createForm.priceUSD}
                onChange={(e) => setCreateForm((f) => ({ ...f, priceUSD: e.target.value }))}
                placeholder="139.00"
              />
            </div>

            {createForm.type === "permanent" && (
              <div className="grid gap-2">
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  value={createForm.credits}
                  onChange={(e) => setCreateForm((f) => ({ ...f, credits: e.target.value }))}
                  placeholder="600000"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
                className={buttonVariants({ variant: "outline" })}
              >
                Cancel
              </button>
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
    </>
  )
}

function ProductTable({
  products,
  onDelete,
  onCreateClick,
  creating,
}: {
  products: DodoProduct[]
  onDelete: (productId: string) => void
  onCreateClick: () => void
  creating: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Products</h2>
        <button onClick={onCreateClick} disabled={creating} className={buttonVariants()}>
          {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          Create Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted/50 p-3">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No products yet. Create your first product to start accepting payments.
          </p>
          <button onClick={onCreateClick} className={buttonVariants({ variant: "outline" })}>
            Create Product
          </button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Dodo Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ${product.type === "subscription" ? "bg-primary-foreground/10 text-primary" : "bg-yellow-foreground/10 text-yellow-500"}`}
                    >
                      {product.type === "subscription" ? "Sub" : "One-time"}
                    </div>
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {formatUSD(product.priceUSD)}
                  {product.type === "subscription" && <span className="ml-1 text-xs text-muted-foreground">/mo</span>}
                </TableCell>
                <TableCell>
                  <span className="font-mono">
                    {product.credits.toLocaleString()}
                    <span className="text-xs text-muted-foreground"> credits</span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      product.dodoStatus === "synced"
                        ? "default"
                        : product.dodoStatus === "not_found"
                        ? "secondary"
                        : "outline"
                    }
                    className={
                      product.dodoStatus === "synced"
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : product.dodoStatus === "not_found"
                        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                        : "bg-muted text-muted-foreground border-muted"
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
                      className="inline-flex items-center gap-1 ml-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      View in Dodo <ExternalLink className="size-3" />
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={() => onDelete(product.dodoProductId || product.id)}
                    disabled={!product.dodoProductId}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Local configuration reference */}
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="size-4" />
        <span>
          Products shown are configured in{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code>{" "}
          or created via the setup script. Gaps between local config and Dodo indicate products
          that need to be created or synced.
        </span>
      </div>
    </div>
  )
}

function Info({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
