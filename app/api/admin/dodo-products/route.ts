import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { getDodoConfig } from "@/lib/env"
import { SUBSCRIPTION_PLANS, PERMANENT_CREDIT_PACKS } from "@/lib/billing/config"
import { logger } from "@/lib/logging/logger"
import { DodoPayments } from "dodopayments"

/**
 * Admin endpoint for managing Dodo Payments products.
 *
 * Methods:
 * - GET: List all configured products (local config + Dodo sync status)
 * - POST: Create a new product in Dodo
 * - PATCH: Update an existing product in Dodo
 * - DELETE: Delete a product in Dodo
 */

export const runtime = "nodejs"

interface ProductQuery {
  type?: "subscription" | "permanent"
  search?: string
}

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const type = (searchParams.get("type") || undefined) as "subscription" | "permanent" | undefined
    const search = searchParams.get("search") || undefined

    const { apiKey, environment } = getDodoConfig()
    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: environment as "test_mode" | "live_mode",
    })

    // Fetch products from Dodo
    const dodoProducts = await client.products.list({ limit: 100, offset: 0 })

    // Combine with local config
    const localProducts = [
      ...SUBSCRIPTION_PLANS.filter((p) => !p.custom).map((p) => ({
        id: p.id,
        name: `MirrorSite AI — ${p.name}`,
        priceUSD: p.priceUSD,
        credits: p.mirrorCredits,
        type: "subscription" as const,
        dodoProductId: p.dodoProductId ?? "",
        configured: Boolean(p.dodoProductId),
      })),
      ...PERMANENT_CREDIT_PACKS.map((p) => ({
        id: p.id,
        name: `MirrorSite AI — ${p.label}`,
        priceUSD: p.priceUSD,
        credits: p.credits,
        type: "permanent" as const,
        dodoProductId: p.dodoProductId ?? "",
        configured: Boolean(p.dodoProductId),
      })),
    ]

    // Filter by type if specified
    let filteredLocal = localProducts
    if (type) {
      filteredLocal = filteredLocal.filter((p) => p.type === type)
    }
    if (search) {
      const searchLower = search.toLowerCase()
      filteredLocal = filteredLocal.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.id.toLowerCase().includes(searchLower),
      )
    }

    // Match Dodo products with local config
    const matchedProducts = filteredLocal.map((local) => {
      const dodoMatch = dodoProducts.data?.find(
        (d) => d.product_id === local.dodoProductId || d.name === local.name,
      )
      return {
        ...local,
        dodoStatus: dodoMatch ? "synced" : local.dodoProductId ? "not_found" : "not_created",
        dodoData: dodoMatch ?? null,
      }
    })

    return NextResponse.json({
      ok: true,
      data: {
        products: matchedProducts,
        total: matchedProducts.length,
        dodoTotal: dodoProducts.data?.length ?? 0,
      },
    })
  } catch (error) {
    logger.error("admin.dodo-products", "Failed to list products", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to list products" } },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()

    const body = (await req.json()) as {
      type: "subscription" | "permanent"
      name: string
      description: string
      priceUSD: number
      credits?: number
      interval?: "monthly" | "yearly"
    }

    if (!body.type || !body.name || !body.description || !body.priceUSD) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_REQUEST", message: "type, name, description, and priceUSD are required" } },
        { status: 400 },
      )
    }

    const { apiKey, environment } = getDodoConfig()
    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: environment as "test_mode" | "live_mode",
    })

    const priceInCents = Math.round(body.priceUSD * 100)

    const product = await client.products.create({
      name: body.name,
      description: body.description,
      price:
        body.type === "subscription"
          ? {
              type: "recurring_price",
              currency: "USD",
              price: priceInCents,
              discount: 0,
              payment_frequency_interval: body.interval || "Month",
              payment_frequency_count: 1,
              subscription_period_interval: body.interval || "Month",
              subscription_period_count: 1,
            }
          : {
              type: "one_time_price",
              currency: "USD",
              price: priceInCents,
              discount: 0,
            },
      tax_category: "digital_products",
    })

    logger.info("admin.dodo-products", "Product created", {
      productId: product.product_id,
      name: body.name,
      type: body.type,
      priceUSD: body.priceUSD,
    })

    return NextResponse.json({
      ok: true,
      data: {
        productId: product.product_id,
        name: product.name,
        status: product.status,
      },
    })
  } catch (error) {
    logger.error("admin.dodo-products", "Failed to create product", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create product" } },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin()

    const body = (await req.json()) as {
      productId: string
      name?: string
      description?: string
      priceUSD?: number
    }

    if (!body.productId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_REQUEST", message: "productId is required" } },
        { status: 400 },
      )
    }

    const { apiKey, environment } = getDodoConfig()
    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: environment as "test_mode" | "live_mode",
    })

    const updateData: Record<string, unknown> = {}
    if (body.name) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.priceUSD !== undefined) {
      updateData.price = {
        type: "recurring_price",
        currency: "USD",
        price: Math.round(body.priceUSD * 100),
        discount: 0,
      }
    }

    const product = await client.products.update(body.productId, updateData)

    logger.info("admin.dodo-products", "Product updated", {
      productId: body.productId,
      updates: Object.keys(updateData),
    })

    return NextResponse.json({
      ok: true,
      data: {
        productId: product.product_id,
        name: product.name,
        status: product.status,
      },
    })
  } catch (error) {
    logger.error("admin.dodo-products", "Failed to update product", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to update product" } },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("productId")

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_REQUEST", message: "productId is required" } },
        { status: 400 },
      )
    }

    const { apiKey, environment } = getDodoConfig()
    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: environment as "test_mode" | "live_mode",
    })

    await client.products.delete(productId)

    logger.info("admin.dodo-products", "Product deleted", { productId })

    return NextResponse.json({
      ok: true,
      data: { deleted: true },
    })
  } catch (error) {
    logger.error("admin.dodo-products", "Failed to delete product", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete product" } },
      { status: 500 },
    )
  }
}
