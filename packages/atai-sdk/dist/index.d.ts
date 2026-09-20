/**
 * @atai/sdk — official Atai Runtime SDK.
 *
 * The typed client generated applications use to communicate with the Atai
 * Runtime API. The SDK knows only Atai: its origin, its API key, and its
 * capability vocabulary. Provider implementation is an Atai infrastructure
 * concern and never appears here.
 *
 * @module @atai/sdk
 */
export { Atai } from "./client.js";
export { AiCapability } from "./capabilities/ai.js";
export { VoiceCapability } from "./capabilities/voice.js";
export { SearchCapability } from "./capabilities/search.js";
export { WebCapability } from "./capabilities/web.js";
export { EmailCapability } from "./capabilities/email.js";
export { SmsCapability, WhatsappCapability } from "./capabilities/messaging.js";
export { NotificationsCapability } from "./capabilities/notifications.js";
export { MapsCapability } from "./capabilities/maps.js";
export { CalendarCapability } from "./capabilities/calendar.js";
export { VectorsCapability } from "./capabilities/vectors.js";
export { DatabaseCapability } from "./capabilities/database.js";
export { PaymentsCapability } from "./capabilities/payments.js";
export { HealthCapability } from "./capabilities/health.js";
export { AtaiError, isAuthenticationError, isAuthorizationError, isRateLimitError } from "./errors.js";
export type { AtaiErrorCode, AtaiSdkErrorCode, AtaiErrorRetry } from "./errors.js";
export type { AtaiConfig, AtaiRequestOptions, AiMessage, AiRole, AiChatInput, AiChatResult, AiUsage, VoiceSynthesizeInput, VoiceSynthesizeResult, SearchWebInput, SearchWebResult, WebScrapeInput, WebScrapeResult, EmailSendInput, EmailSendResult, MessageSendInput, MessageSendResult, NotificationSendInput, NotificationSendResult, MapsGeocodeInput, MapsReverseGeocodeInput, MapsResult, PlaceResult, CalendarListBookingsInput, CalendarListBookingsResult, CalendarCreateBookingInput, CalendarCreateBookingResult, VectorUpsertInput, VectorUpsertResult, VectorSearchInput, VectorSearchResult, VectorDeleteInput, VectorDeleteResult, DbQueryInput, DbQueryResult, DbCreateInput, DbCreateResult, DbEditInput, DbEditResult, DbDeleteInput, DbDeleteResult, PaymentsCreateCheckoutInput, PaymentsCreateCheckoutResult, AtaiHealthResult, } from "./types.js";
export type { RuntimeEnvelope, RuntimeErrorEnvelope, RuntimeEnvelopeResult } from "./types.js";
//# sourceMappingURL=index.d.ts.map