import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { executeCreateBooking, executeListBookings } from "./client"
import {
  toCalComCreateBooking,
  toCalComListBookings,
  toCreateBookingResult,
  toListBookingsResult,
  type CreateBookingResultData,
  type ListBookingsResultData,
} from "./mapper"

/**
 * Atai Runtime — Cal.com provider adapter (server-only).
 *
 * Serves the provider-neutral `calendar` capability (listBookings /
 * createBooking, Phase 10 §17) through the EXISTING RuntimeProviderAdapter
 * interface — no duplicate router, no second registry. The platform API key
 * (server-side) binds bookings to the platform-owned Cal.com account;
 * callers provide only scheduling parameters (§9/§53).
 *
 * @module lib/runtime/router/adapters/calcom/adapter
 */

export const CALCOM_PROVIDER_ID = "calcom"

class CalComAdapter implements RuntimeProviderAdapter {
  readonly provider = CALCOM_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "calendar" && (operation === "listBookings" || operation === "createBooking")
  }

  async execute(
    request: ProviderExecutionRequest,
  ): Promise<ProviderExecutionResponse<ListBookingsResultData | CreateBookingResultData>> {
    const { capability, operation } = request.request

    if (capability === "calendar" && operation === "listBookings") {
      const translated = toCalComListBookings(request.request.input)
      const response = await executeListBookings({ query: translated.query, requestId: request.requestId })
      const result = toListBookingsResult(response)
      logger.info("runtime.calcom", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        bookingCount: result.data.bookings.length,
      })
      return result
    }

    if (capability === "calendar" && operation === "createBooking") {
      const translated = toCalComCreateBooking(request.request.input)
      const response = await executeCreateBooking({ body: translated.body, requestId: request.requestId })
      const result = toCreateBookingResult(response)
      logger.info("runtime.calcom", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        bookingUid: result.data.uid,
      })
      return result
    }

    // Unreachable: supports() gates routing. Defensive normalized failure.
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The requested operation is not supported.",
    )
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const calComAdapter = new CalComAdapter()
