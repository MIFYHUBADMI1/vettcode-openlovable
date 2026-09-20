/**
 * Atai SDK — Email capability.
 *
 * Provider-neutral transactional email (`email`/`send`). The application
 * never learns which email provider Atai operates behind the runtime.
 *
 * @module capabilities/email
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, EmailSendInput, EmailSendResult } from "../types.js";
/** The Atai email capability. Exposed as `atai.email` on the client. */
export declare class EmailCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Send a transactional email (`email`/`send`). */
    send(input: EmailSendInput, options?: AtaiRequestOptions): Promise<EmailSendResult>;
}
//# sourceMappingURL=email.d.ts.map