/**
 * Atai SDK — Payments capability.
 *
 * Provider-neutral payment operations (`payments`/`createCheckout`). The application
 * never learns which payment provider Atai operates behind the runtime.
 *
 * @module capabilities/payments
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateCheckoutInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Checkout input must be an object with `items`.");
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new AtaiError("atai_invalid_request", "Checkout requires at least one item.");
    }
    for (const item of input.items) {
        if (typeof item.name !== "string" || item.name.length === 0) {
            throw new AtaiError("atai_invalid_request", "Each item must have a non-empty `name`.");
        }
        if (typeof item.quantity !== "number" || item.quantity < 1) {
            throw new AtaiError("atai_invalid_request", "Each item must have a positive integer `quantity`.");
        }
        if (typeof item.price !== "number" || item.price <= 0) {
            throw new AtaiError("atai_invalid_request", "Each item must have a positive `price`.");
        }
    }
}
/** The Atai payments capability. Exposed as `atai.payments` on the client. */
export class PaymentsCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Create a checkout session (`payments`/`createCheckout`). */
    async createCheckout(input, options) {
        validateCheckoutInput(input);
        const body = {
            capability: "payments",
            operation: "createCheckout",
            input: {
                items: input.items,
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                ...(input.successUrl !== undefined ? { successUrl: input.successUrl } : {}),
                ...(input.cancelUrl !== undefined ? { cancelUrl: input.cancelUrl } : {}),
                ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
                ...(input.currency !== undefined ? { currency: input.currency } : {}),
                ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertCheckoutResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertCheckoutResult(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    const p = payload;
    if (typeof p.checkoutId !== "string" || typeof p.checkoutUrl !== "string" || typeof p.status !== "string") {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=payments.js.map