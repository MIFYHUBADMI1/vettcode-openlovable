/**
 * Atai SDK — Notifications capability.
 *
 * Provider-neutral realtime notifications (`notifications`/`send`). The
 * application never learns which notification provider Atai operates behind
 * the runtime.
 *
 * @module capabilities/notifications
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateNotificationInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Notification input must be an object with `channel`, `title`, and `body` fields.");
    }
    if (typeof input.channel !== "string" || input.channel.length === 0) {
        throw new AtaiError("atai_invalid_request", "Notification requires a non-empty `channel`.");
    }
    if (input.event !== undefined && (typeof input.event !== "string" || input.event.length === 0)) {
        throw new AtaiError("atai_invalid_request", "Notification `event` must be a non-empty string when provided.");
    }
    if (typeof input.title !== "string" || input.title.length === 0) {
        throw new AtaiError("atai_invalid_request", "Notification requires a non-empty `title`.");
    }
    if (typeof input.body !== "string" || input.body.length === 0) {
        throw new AtaiError("atai_invalid_request", "Notification requires a non-empty `body`.");
    }
}
/** The Atai notifications capability. Exposed as `atai.notifications` on the client. */
export class NotificationsCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Send a realtime notification (`notifications`/`send`). */
    async send(input, options) {
        validateNotificationInput(input);
        const body = {
            capability: "notifications",
            operation: "send",
            input: {
                channel: input.channel,
                ...(input.event !== undefined ? { event: input.event } : {}),
                title: input.title,
                body: input.body,
                ...(input.data !== undefined ? { data: input.data } : {}),
                ...(input.private !== undefined ? { private: input.private } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertNotificationResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertNotificationResult(payload) {
    const p = payload;
    const valid = typeof p === "object" &&
        p !== null &&
        typeof p.channel === "string" &&
        typeof p.event === "string" &&
        typeof p.accepted === "boolean";
    if (!valid) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=notifications.js.map