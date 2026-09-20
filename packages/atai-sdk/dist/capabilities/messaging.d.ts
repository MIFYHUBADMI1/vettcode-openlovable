/**
 * Atai SDK — Messaging capability (SMS + WhatsApp).
 *
 * Provider-neutral messaging (`sms`/`send`, `whatsapp`/`send`). The application
 * never learns which messaging provider Atai operates behind the runtime.
 *
 * @module capabilities/messaging
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, MessageSendInput, MessageSendResult } from "../types.js";
/** The Atai messaging capability. Exposed as `atai.sms` and `atai.whatsapp` on the client. */
export declare class SmsCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Send an SMS message (`sms`/`send`). */
    send(input: MessageSendInput, options?: AtaiRequestOptions): Promise<MessageSendResult>;
}
export declare class WhatsappCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Send a WhatsApp message (`whatsapp`/`send`). */
    send(input: MessageSendInput, options?: AtaiRequestOptions): Promise<MessageSendResult>;
}
//# sourceMappingURL=messaging.d.ts.map