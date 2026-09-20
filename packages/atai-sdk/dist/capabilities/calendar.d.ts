/**
 * Atai SDK — Calendar capability.
 *
 * Provider-neutral calendar/scheduling (`calendar`/`listBookings`, `calendar`/`createBooking`). The application
 * never learns which calendar provider Atai operates behind the runtime.
 *
 * @module capabilities/calendar
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, CalendarListBookingsInput, CalendarListBookingsResult, CalendarCreateBookingInput, CalendarCreateBookingResult } from "../types.js";
/** The Atai calendar capability. Exposed as `atai.calendar` on the client. */
export declare class CalendarCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** List bookings (`calendar`/`listBookings`). */
    listBookings(input: CalendarListBookingsInput, options?: AtaiRequestOptions): Promise<CalendarListBookingsResult>;
    /** Create a booking (`calendar`/`createBooking`). */
    createBooking(input: CalendarCreateBookingInput, options?: AtaiRequestOptions): Promise<CalendarCreateBookingResult>;
}
//# sourceMappingURL=calendar.d.ts.map