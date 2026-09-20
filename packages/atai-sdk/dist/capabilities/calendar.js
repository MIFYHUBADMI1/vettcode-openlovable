/**
 * Atai SDK — Calendar capability.
 *
 * Provider-neutral calendar/scheduling (`calendar`/`listBookings`, `calendar`/`createBooking`). The application
 * never learns which calendar provider Atai operates behind the runtime.
 *
 * @module capabilities/calendar
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateListBookingsInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "List bookings input must be an object.");
    }
    if (input.startDate !== undefined && typeof input.startDate !== "string") {
        throw new AtaiError("atai_invalid_request", "`startDate` must be an ISO 8601 string when provided.");
    }
    if (input.endDate !== undefined && typeof input.endDate !== "string") {
        throw new AtaiError("atai_invalid_request", "`endDate` must be an ISO 8601 string when provided.");
    }
    if (input.limit !== undefined && (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1)) {
        throw new AtaiError("atai_invalid_request", "`limit` must be a positive integer when provided.");
    }
}
function validateCreateBookingInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Create booking input must be an object with required fields.");
    }
    if (typeof input.title !== "string" || input.title.length === 0) {
        throw new AtaiError("atai_invalid_request", "Create booking requires a non-empty `title`.");
    }
    if (typeof input.startTime !== "string") {
        throw new AtaiError("atai_invalid_request", "Create booking requires a `startTime` (ISO 8601).");
    }
    if (typeof input.endTime !== "string") {
        throw new AtaiError("atai_invalid_request", "Create booking requires an `endTime` (ISO 8601).");
    }
}
/** The Atai calendar capability. Exposed as `atai.calendar` on the client. */
export class CalendarCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** List bookings (`calendar`/`listBookings`). */
    async listBookings(input, options) {
        validateListBookingsInput(input);
        const body = {
            capability: "calendar",
            operation: "listBookings",
            input: {
                ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
                ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
                ...(input.limit !== undefined ? { limit: input.limit } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertListBookingsResult(envelope.data.data);
    }
    /** Create a booking (`calendar`/`createBooking`). */
    async createBooking(input, options) {
        validateCreateBookingInput(input);
        const body = {
            capability: "calendar",
            operation: "createBooking",
            input: {
                title: input.title,
                startTime: input.startTime,
                endTime: input.endTime,
                ...(input.attendees !== undefined ? { attendees: input.attendees } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertCreateBookingResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertListBookingsResult(payload) {
    if (typeof payload !== "object" || payload === null || !Array.isArray(payload.bookings)) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
function assertCreateBookingResult(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    const p = payload;
    if (typeof p.uid !== "string" || typeof p.startTime !== "string" || typeof p.endTime !== "string" || typeof p.status !== "string") {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=calendar.js.map