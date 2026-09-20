/**
 * Atai SDK — Messaging capability (SMS + WhatsApp).
 *
 * Provider-neutral messaging (`sms`/`send`, `whatsapp`/`send`). The application
 * never learns which messaging provider Atai operates behind the runtime.
 *
 * @module capabilities/messaging
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateMessageInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Message input must be an object with `to` and `body` fields.");
    }
    if (typeof input.to !== "string" || !input.to.startsWith("+")) {
        throw new AtaiError("atai_invalid_request", "`to` must be an E.164 phone number (e.g. \"+15551234567\").");
    }
    if (typeof input.body !== "string" || input.body.length === 0) {
        throw new AtaiError("atai_invalid_request", "Message requires a non-empty `body`.");
    }
}
/** The Atai messaging capability. Exposed as `atai.sms` and `atai.whatsapp` on the client. */
export class SmsCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Send an SMS message (`sms`/`send`). */
    async send(input, options) {
        validateMessageInput(input);
        const body = {
            capability: "sms",
            operation: "send",
            input: { to: input.to, body: input.body },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertMessageResult(envelope.data.data);
    }
}
export class WhatsappCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Send a WhatsApp message (`whatsapp`/`send`). */
    async send(input, options) {
        validateMessageInput(input);
        const body = {
            capability: "whatsapp",
            operation: "send",
            input: { to: input.to, body: input.body },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertMessageResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertMessageResult(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    const p = payload;
    if (typeof p.messageId !== "string" || typeof p.status !== "string") {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=messaging.js.map