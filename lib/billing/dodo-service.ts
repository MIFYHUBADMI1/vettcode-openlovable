/**
 * Dodo Payments Service — Auto-Provisioning
 *
 * Automatically creates Dodo products if they don't exist in the environment.
 * Includes rate limiting and caching to prevent duplicate product creation.
 *
 * @module lib/billing/dodo-service
 */

import { DodoPayments } from "dodopayments"
import { getDodoConfig } from "@/lib/env"
import { logger } from "@/lib/logging/logger"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { productCreationLocks, checkoutSessionLocks } from "@/lib/cache/locks"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DodoProductInfo {
  productId: string
  name: string
  priceUSD: number
  credits: number
  type: "subscription" | "permanent"
}

// In-memory cache of created products (per process, survives HMR)
const createdProducts = new Map<string, DodoProductInfo>()

// How long to cache a successfully created product before allowing re-check
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ─── Product Creation ─────────────────────────────────────────────────────────

async function getDodoClient(): Promise<DodoPayments> {
  const { apiKey, environment } = getDodoConfig()
  return new DodoPayments({
    bearerToken: apiKey,
    environment: environment as "test_mode" | "live_mode",
  })
}

/**
 * Check if a product exists in Dodo by searching for it.
 * Returns the product ID if found, null otherwise.
 */
async function findProductByName(
  client: DodoPayments,
  name: string,
): Promise<string | null> {
  try {
    // Dodo API: search products by name
    const products = await client.products.list({
      limit: 50,
      offset: 0,
    })

    const match = products.data?.find(
      (p) => p.name === name && p.status === "active",
    )
    return match?.product_id ?? null
  } catch {
    return null
  }
}

/**
 * Create a subscription product in Dodo.
 */
async function createSubscriptionProduct(
  client: DodoPayments,
  name: string,
  description: string,
  priceInCents: number,
): Promise<string> {
  const product = await client.products.create({
    name,
    description,
    price: {
      type: "recurring_price",
      currency: "USD",
      price: priceInCents,
      discount: 0,
      payment_frequency_interval: "Month",
      payment_frequency_count: 1,
      subscription_period_interval: "Month",
      subscription_period_count: 1,
    },
    tax_category: "digital_products",
  })
  return product.product_id
}

/**
 * Create a one-time (permanent credits) product in Dodo.
 */
async function createOneTimeProduct(
  client: DodoPayments,
  name: string,
  description: string,
  priceInCents: number,
): Promise<string> {
  const product = await client.products.create({
    name,
    description,
    price: {
      type: "one_time_price",
      currency: "USD",
      price: priceInCents,
      discount: 0,
    },
    tax_category: "digital_products",
  })
  return product.product_id
}

/**
 * Get or create a Dodo product for a subscription plan.
 * Uses rate limiting and caching to prevent duplicate creation.
 */
export async function getOrCreateSubscriptionProduct(
  planId: string,
  name: string,
  description: string,
  priceUSD: number,
  credits: number,
): Promise<DodoProductInfo> {
  // Check cache first
  const cacheKey = `sub:${planId}`
  const cached = createdProducts.get(cacheKey)
  if (
    cached &&
    cached.name === name &&
    cached.priceUSD === priceUSD &&
    Date.now() - cached.createdAt < PRODUCT_CACHE_TTL_MS
  ) {
    return cached
  }

  // Use a lock to prevent concurrent duplicate creation
  const lockKey = `product_create:sub:${planId}`
  const releaseLock = productCreationLocks.acquire(lockKey)
  if (!releaseLock) {
    throw new Error("Product creation is already in progress for this plan")
  }

  try {
    // Re-check cache after acquiring lock
    const rechecked = createdProducts.get(cacheKey)
    if (
      rechecked &&
      rechecked.name === name &&
      rechecked.priceUSD === priceUSD &&
      Date.now() - rechecked.createdAt < PRODUCT_CACHE_TTL_MS
    ) {
      return rechecked
    }

    // Rate limit: max 1 product creation per plan per hour
    try {
      await checkRateLimit({
        action: "dodo_product_create",
        identifier: `sub:${planId}`,
        limit: 1,
        windowMs: 60 * 60 * 1000,
      })
    } catch {
      throw new Error(
        `Rate limit exceeded for product creation. Please try again later.`,
      )
    }

    const client = await getDodoClient()

    // Try to find existing product
    let productId = await findProductByName(client, name)

    // Create if not found
    if (!productId) {
      const priceInCents = Math.round(priceUSD * 100)
      productId = await createSubscriptionProduct(
        client,
        name,
        description,
        priceInCents,
      )
      logger.info("dodo", "Created subscription product", {
        planId,
        productId,
        name,
        priceUSD,
      })
    }

    const productInfo: DodoProductInfo = {
      productId,
      name,
      priceUSD,
      credits,
      type: "subscription",
    }

    // Cache the result
    createdProducts.set(cacheKey, { ...productInfo, createdAt: Date.now() })

    return productInfo
  } finally {
    releaseLock()
  }
}

/**
 * Get or create a Dodo product for a permanent credit pack.
 * Uses rate limiting and caching to prevent duplicate creation.
 */
export async function getOrCreatePermanentProduct(
  packId: string,
  name: string,
  description: string,
  priceUSD: number,
  credits: number,
): Promise<DodoProductInfo> {
  // Check cache first
  const cacheKey = `perm:${packId}`
  const cached = createdProducts.get(cacheKey)
  if (
    cached &&
    cached.name === name &&
    cached.priceUSD === priceUSD &&
    Date.now() - cached.createdAt < PRODUCT_CACHE_TTL_MS
  ) {
    return cached
  }

  // Use a lock to prevent concurrent duplicate creation
  const lockKey = `product_create:perm:${packId}`
  const releaseLock = productCreationLocks.acquire(lockKey)
  if (!releaseLock) {
    throw new Error("Product creation is already in progress for this pack")
  }

  try {
    // Re-check cache after acquiring lock
    const rechecked = createdProducts.get(cacheKey)
    if (
      rechecked &&
      rechecked.name === name &&
      rechecked.priceUSD === priceUSD &&
      Date.now() - rechecked.createdAt < PRODUCT_CACHE_TTL_MS
    ) {
      return rechecked
    }

    // Rate limit: max 1 product creation per pack per hour
    try {
      await checkRateLimit({
        action: "dodo_product_create",
        identifier: `perm:${packId}`,
        limit: 1,
        windowMs: 60 * 60 * 1000,
      })
    } catch {
      throw new Error(
        `Rate limit exceeded for product creation. Please try again later.`,
      )
    }

    const client = await getDodoClient()

    // Try to find existing product
    let productId = await findProductByName(client, name)

    // Create if not found
    if (!productId) {
      const priceInCents = Math.round(priceUSD * 100)
      productId = await createOneTimeProduct(
        client,
        name,
        description,
        priceInCents,
      )
      logger.info("dodo", "Created permanent product", {
        packId,
        productId,
        name,
        priceUSD,
      })
    }

    const productInfo: DodoProductInfo = {
      productId,
      name,
      priceUSD,
      credits,
      type: "permanent",
    }

    // Cache the result
    createdProducts.set(cacheKey, { ...productInfo, createdAt: Date.now() })

    return productInfo
  } finally {
    releaseLock()
  }
}

/**
 * Clear the product cache (useful for testing or if products were created externally).
 */
export function clearProductCache(): void {
  createdProducts.clear()
}

/**
 * Get cached product info without creating.
 */
export function getCachedProduct(cacheKey: string): DodoProductInfo | null {
  const cached = createdProducts.get(cacheKey)
  if (!cached) return null
  if (Date.now() - cached.createdAt > PRODUCT_CACHE_TTL_MS) {
    createdProducts.delete(cacheKey)
    return null
  }
  return cached
}
