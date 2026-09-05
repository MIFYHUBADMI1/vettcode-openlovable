#!/usr/bin/env npx tsx
/**
 * MirrorSite AI — Dodo Payments Product Setup Script
 *
 * Creates all subscription plans and permanent credit pack products
 * in your Dodo Payments account via the API.
 *
 * Usage:
 *   DODO_PAYMENTS_API_KEY=sk_test_xxx DODO_PAYMENTS_ENVIRONMENT=test_mode npx tsx scripts/setup-dodo-products.ts
 *
 * After running, copy the output product IDs into your .env file:
 *   DODO_PRODUCT_EXPLORER=pdt_xxx
 *   DODO_PRODUCT_STARTER=pdt_xxx
 *   ...etc
 *
 * Then restart your dev server.
 *
 * @see https://docs.dodopayments.com/features/products
 * @see https://docs.dodopayments.com/api-reference/products/post-products
 */

import DodoPayments from "dodopayments"

const API_KEY = process.env.DODO_PAYMENTS_API_KEY
const ENVIRONMENT = (process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode") as "test_mode" | "live_mode"

if (!API_KEY) {
  console.error("❌ Missing DODO_PAYMENTS_API_KEY environment variable.")
  console.error("   Run: DODO_PAYMENTS_API_KEY=sk_test_xxx npx tsx scripts/setup-dodo-products.ts")
  process.exit(1)
}

const client = new DodoPayments({
  bearerToken: API_KEY,
  environment: ENVIRONMENT,
})

// ─── Subscription Plans ──────────────────────────────────────────────────────
// Price is in cents (lowest denomination). $12 = 1200, $79 = 7900, etc.

const SUBSCRIPTION_PRODUCTS = [
  {
    name: "MirrorSite AI — Explorer",
    description: "50,000 MirrorSite Credits per month. Perfect for getting started with AI-powered app generation.",
    price: 1200, // $12.00
    credits: 50_000,
    envKey: "DODO_PRODUCT_EXPLORER",
  },
  {
    name: "MirrorSite AI — Starter",
    description: "300,000 MirrorSite Credits per month. Ideal for regular app building and prototyping.",
    price: 7900, // $79.00
    credits: 300_000,
    envKey: "DODO_PRODUCT_STARTER",
  },
  {
    name: "MirrorSite AI — Business",
    description: "600,000 MirrorSite Credits per month. For teams and businesses building multiple applications.",
    price: 13900, // $139.00
    credits: 600_000,
    envKey: "DODO_PRODUCT_BUSINESS",
  },
  {
    name: "MirrorSite AI — Professional",
    description: "1,400,000 MirrorSite Credits per month. Maximum credits for power users and agencies.",
    price: 21900, // $219.00
    credits: 1_400_000,
    envKey: "DODO_PRODUCT_PROFESSIONAL",
  },
  {
    name: "MirrorSite AI — Enterprise",
    description: "5,000,000+ MirrorSite Credits per month. Custom pricing for large-scale operations.",
    price: 49900, // $499.00
    credits: 5_000_000,
    envKey: "DODO_PRODUCT_ENTERPRISE",
  },
]

// ─── Permanent Credit Packs ─────────────────────────────────────────────────

const PERMANENT_PRODUCTS = [
  {
    name: "MirrorSite AI — 200K Credits",
    description: "200,000 permanent MirrorSite Credits. Equivalent to 200 Totalum credits. Never expire.",
    price: 5900, // $59.00
    credits: 200_000,
    envKey: "DODO_PRODUCT_PERM_200K",
  },
  {
    name: "MirrorSite AI — 500K Credits",
    description: "500,000 permanent MirrorSite Credits. Equivalent to 500 Totalum credits. Best value.",
    price: 11900, // $119.00
    credits: 500_000,
    envKey: "DODO_PRODUCT_PERM_500K",
  },
  {
    name: "MirrorSite AI — 1M Credits",
    description: "1,000,000 permanent MirrorSite Credits. Equivalent to 1,000 Totalum credits.",
    price: 21900, // $219.00
    credits: 1_000_000,
    envKey: "DODO_PRODUCT_PERM_1M",
  },
  {
    name: "MirrorSite AI — 5M Credits",
    description: "5,000,000 permanent MirrorSite Credits. Equivalent to 5,000 Totalum credits.",
    price: 85900, // $859.00
    credits: 5_000_000,
    envKey: "DODO_PRODUCT_PERM_5M",
  },
  {
    name: "MirrorSite AI — 15M Credits",
    description: "15,000,000 permanent MirrorSite Credits. Equivalent to 15,000 Totalum credits. For teams and agencies.",
    price: 249900, // $2,499.00
    credits: 15_000_000,
    envKey: "DODO_PRODUCT_PERM_15M",
  },
]

async function createProduct(
  name: string,
  description: string,
  priceInCents: number,
  type: "subscription" | "one_time",
): Promise<string> {
  const product = await client.products.create({
    name,
    description,
    price: type === "subscription"
      ? {
        type: "recurring_price",
        currency: "USD",
        price: priceInCents,
        discount: 0,
        payment_frequency_interval: "Month",
        payment_frequency_count: 1,
        subscription_period_interval: "Month",
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

  return product.product_id
}

async function main() {
  console.log(`\n🚀 Setting up Dodo Payments products (${ENVIRONMENT})\n`)

  const envLines: string[] = []

  // ── Subscription Products ──
  console.log("━━━ Subscription Plans ━━━")
  for (const plan of SUBSCRIPTION_PRODUCTS) {
    try {
      const productId = await createProduct(plan.name, plan.description, plan.price, "subscription")
      console.log(`  ✅ ${plan.name}`)
      console.log(`     Product ID: ${productId}`)
      console.log(`     Price: $${(plan.price / 100).toFixed(2)}/month | ${plan.credits.toLocaleString()} credits`)
      envLines.push(`${plan.envKey}=${productId}`)
    } catch (err) {
      console.error(`  ❌ ${plan.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log("")

  // ── Permanent Credit Products ──
  console.log("━━━ Permanent Credit Packs ━━━")
  for (const pack of PERMANENT_PRODUCTS) {
    try {
      const productId = await createProduct(pack.name, pack.description, pack.price, "one_time")
      console.log(`  ✅ ${pack.name}`)
      console.log(`     Product ID: ${productId}`)
      console.log(`     Price: $${(pack.price / 100).toFixed(2)} | ${pack.credits.toLocaleString()} credits`)
      envLines.push(`${pack.envKey}=${productId}`)
    } catch (err) {
      console.error(`  ❌ ${pack.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Output ──
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("\n📋 Add these to your .env file:\n")
  for (const line of envLines) {
    console.log(line)
  }
  console.log("\nThen restart your dev server.\n")
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err)
  process.exit(1)
})
