/**
 * Atai SDK — Payments capability.
 *
 * Provider-neutral payment operations (`payments`): checkout sessions,
 * recurring subscriptions, the read-only payment feed, and account-level
 * payout records. The application never learns which payment provider Atai
 * operates behind the runtime.
 *
 * @module capabilities/payments
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, PaymentsCreateCheckoutInput, PaymentsCreateCheckoutResult, PaymentsCreateSubscriptionInput, PaymentsCreateSubscriptionResult, PaymentsListPaymentsInput, PaymentsListPaymentsResult, PaymentsListPayoutsInput, PaymentsListPayoutsResult } from "../types.js";
/** The Atai payments capability. Exposed as `atai.payments` on the client. */
export declare class PaymentsCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Create a checkout session (`payments`/`createCheckout`). */
    createCheckout(input: PaymentsCreateCheckoutInput, options?: AtaiRequestOptions): Promise<PaymentsCreateCheckoutResult>;
    /** Create a recurring subscription (`payments`/`createSubscription`). Real charge — not retried. */
    createSubscription(input: PaymentsCreateSubscriptionInput, options?: AtaiRequestOptions): Promise<PaymentsCreateSubscriptionResult>;
    /** Read the payment feed (`payments`/`listPayments`). Read-only — safe to call freely. */
    listPayments(input?: PaymentsListPaymentsInput, options?: AtaiRequestOptions): Promise<PaymentsListPaymentsResult>;
    /** Read account-level payout records (`payments`/`listPayouts`). Read-only. */
    listPayouts(input?: PaymentsListPayoutsInput, options?: AtaiRequestOptions): Promise<PaymentsListPayoutsResult>;
}
//# sourceMappingURL=payments.d.ts.map