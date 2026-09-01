import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { createTopUp, listUserTopUps } from "@/lib/billing/topup-service"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import type { PaymentNetwork } from "@/lib/billing/types"

const VALID_NETWORKS: PaymentNetwork[] = ["mtn", "airtel"]

/** List the authenticated user's top-ups. */
export async function GET() {
  try {
    const user = await requireUser()
    const topUps = await listUserTopUps(user.id)
    return ok({ topUps })
  } catch (e) {
    return handleRouteError("api.billing.topup.list", e)
  }
}

/** Create a new top-up for a credit package. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as {
      packageId?: string
      paymentNetwork?: string
      payerPhone?: string
    }

    if (!body.packageId || typeof body.packageId !== "string") {
      return fail("VALIDATION", "Please select a credit package.", 422)
    }
    if (!body.paymentNetwork || !VALID_NETWORKS.includes(body.paymentNetwork as PaymentNetwork)) {
      return fail("VALIDATION", "Please select a payment network (MTN or Airtel).", 422)
    }
    if (!body.payerPhone || typeof body.payerPhone !== "string" || body.payerPhone.replace(/\D/g, "").length < 9) {
      return fail("VALIDATION", "Please enter a valid phone number.", 422)
    }

    // Rate limit: max 5 top-up creations per hour per user
    await checkRateLimit({
      action: "topup_create",
      identifier: user.id,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    const result = await createTopUp({
      userId: user.id,
      packageId: body.packageId,
      paymentNetwork: body.paymentNetwork as PaymentNetwork,
      payerPhone: body.payerPhone,
    })

    return ok(result, { status: 201 })
  } catch (e) {
    return handleRouteError("api.billing.topup.create", e)
  }
}
