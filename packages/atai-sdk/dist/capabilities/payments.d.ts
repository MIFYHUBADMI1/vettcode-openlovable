/**
 * Atai SDK — Payments capability.
 *
 * Provider-neutral payment operations (`payments`/`createCheckout`). The application
 * never learns which payment provider Atai operates behind the runtime.
 *
 * @module capabilities/payments
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, PaymentsCreateCheckoutInput, PaymentsCreateCheckoutResult } from "../types.js";
/** The Atai payments capability. Exposed as `atai.payments` on the client. */
export declare class PaymentsCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Create a checkout session (`payments`/`createCheckout`). */
    createCheckout(input: PaymentsCreateCheckoutInput, options?: AtaiRequestOptions): Promise<PaymentsCreateCheckoutResult>;
}
//# sourceMappingURL=payments.d.ts.map