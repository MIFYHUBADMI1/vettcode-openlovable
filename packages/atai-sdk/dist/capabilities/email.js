/**
 * Atai SDK — Email capability.
 *
 * Provider-neutral transactional email (`email`/`send`). The application
 * never learns which email provider Atai operates behind the runtime.
 *
 * @module capabilities/email
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateEmailInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Email input must be an object with `to` and `subject` fields.");
    }
    if (!Array.isArray(input.to) || input.to.length === 0) {
        throw new AtaiError("atai_invalid_request", "Email requires at least one recipient in `to`.");
    }
    for (const addr of input.to) {
        if (typeof addr !== "string" || !addr.includes("@")) {
            throw new AtaiError("atai_invalid_request", "Each recipient must be a valid email address.");
        }
    }
    if (typeof input.subject !== "string" || input.subject.length === 0) {
        throw new AtaiError("atai_invalid_request", "Email requires a non-empty `subject`.");
    }
    if (input.text === undefined && input.html === undefined) {
        throw new AtaiError("atai_invalid_request", "Email requires either `text` or `html` content.");
    }
}
/** The Atai email capability. Exposed as `atai.email` on the client. */
export class EmailCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Send a transactional email (`email`/`send`). */
    async send(input, options) {
        validateEmailInput(input);
        const body = {
            capability: "email",
            operation: "send",
            input: {
                to: input.to,
                subject: input.subject,
                ...(input.text !== undefined ? { text: input.text } : {}),
                ...(input.html !== undefined ? { html: input.html } : {}),
                ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertEmailResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertEmailResult(payload) {
    if (typeof payload !== "object" || payload === null || typeof payload.id !== "string") {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=email.js.map