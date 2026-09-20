/**
 * Atai SDK — Notifications capability.
 *
 * Provider-neutral push notifications (`notifications`/`send`). The application
 * never learns which notification provider Atai operates behind the runtime.
 *
 * @module capabilities/notifications
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type { AtaiRequestOptions, NotificationSendInput, NotificationSendResult } from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateNotificationInput(input: NotificationSendInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Notification input must be an object with `token`, `title`, and `body` fields.")
  }
  if (typeof input.token !== "string" || input.token.length === 0) {
    throw new AtaiError("atai_invalid_request", "Notification requires a device `token`.")
  }
  if (typeof input.title !== "string" || input.title.length === 0) {
    throw new AtaiError("atai_invalid_request", "Notification requires a non-empty `title`.")
  }
  if (typeof input.body !== "string" || input.body.length === 0) {
    throw new AtaiError("atai_invalid_request", "Notification requires a non-empty `body`.")
  }
}

/** The Atai notifications capability. Exposed as `atai.notifications` on the client. */
export class NotificationsCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Send a push notification (`notifications`/`send`). */
  async send(input: NotificationSendInput, options?: AtaiRequestOptions): Promise<NotificationSendResult> {
    validateNotificationInput(input)

    const body = {
      capability: "notifications",
      operation: "send",
      input: {
        token: input.token,
        title: input.title,
        body: input.body,
      },
    }

    const { envelope } = await execute<typeof body, NotificationSendResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertNotificationResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertNotificationResult(payload: unknown): NotificationSendResult {
  if (typeof payload !== "object" || payload === null || typeof (payload as Record<string, unknown>).messageId !== "string") {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as NotificationSendResult
}
