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
// Public client + capability surface.
// NOTE: relative imports carry explicit .js extensions. They resolve fine in
// bundlers and are REQUIRED for the emitted dist/ to be importable by a
// plain Node ESM consumer (extensionless specifiers crash with
// ERR_MODULE_NOT_FOUND outside a bundler).
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
// Normalized error surface.
export { AtaiError, isAuthenticationError, isAuthorizationError, isRateLimitError } from "./errors.js";
//# sourceMappingURL=index.js.map