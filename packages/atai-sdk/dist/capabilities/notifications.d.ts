/**
 * Atai SDK — Notifications capability.
 *
 * Provider-neutral push notifications (`notifications`/`send`). The application
 * never learns which notification provider Atai operates behind the runtime.
 *
 * @module capabilities/notifications
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, NotificationSendInput, NotificationSendResult } from "../types.js";
/** The Atai notifications capability. Exposed as `atai.notifications` on the client. */
export declare class NotificationsCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Send a push notification (`notifications`/`send`). */
    send(input: NotificationSendInput, options?: AtaiRequestOptions): Promise<NotificationSendResult>;
}
//# sourceMappingURL=notifications.d.ts.map