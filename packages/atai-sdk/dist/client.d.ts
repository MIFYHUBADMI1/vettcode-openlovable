/**
 * Atai SDK — public client.
 *
 * One class, one constructor, no global state:
 *
 * ```ts
 * const atai = new Atai({ apiKey: process.env.ATAI_API_KEY! })
 * const result = await atai.ai.chat({ messages: [{ role: "user", content: "Hello" }] })
 * ```
 *
 * The client is an instance model: create one per runtime environment or
 * project credential. Concurrent calls are safe and fully isolated (no
 * shared mutable request state, no credential cross-talk).
 *
 * @module client
 */
import { AiCapability } from "./capabilities/ai.js";
import { VoiceCapability } from "./capabilities/voice.js";
import { SearchCapability } from "./capabilities/search.js";
import { WebCapability } from "./capabilities/web.js";
import { EmailCapability } from "./capabilities/email.js";
import { SmsCapability, WhatsappCapability } from "./capabilities/messaging.js";
import { NotificationsCapability } from "./capabilities/notifications.js";
import { MapsCapability } from "./capabilities/maps.js";
import { CalendarCapability } from "./capabilities/calendar.js";
import { VectorsCapability } from "./capabilities/vectors.js";
import { DatabaseCapability } from "./capabilities/database.js";
import { PaymentsCapability } from "./capabilities/payments.js";
import { HealthCapability } from "./capabilities/health.js";
import type { AtaiConfig } from "./types.js";
export declare class Atai {
    /** Atai AI capability (`ai.text` operations). */
    readonly ai: AiCapability;
    /** Atai voice capability (`ai.speak` operations). */
    readonly voice: VoiceCapability;
    /** Atai search capability (`search.web` operations). */
    readonly search: SearchCapability;
    /** Atai web capability (`web.scrape` operations). */
    readonly web: WebCapability;
    /** Atai email capability (`email` operations). */
    readonly email: EmailCapability;
    /** Atai SMS capability (`sms` operations). */
    readonly sms: SmsCapability;
    /** Atai WhatsApp capability (`whatsapp` operations). */
    readonly whatsapp: WhatsappCapability;
    /** Atai notifications capability (`notifications` operations). */
    readonly notifications: NotificationsCapability;
    /** Atai maps capability (`maps` operations). */
    readonly maps: MapsCapability;
    /** Atai calendar capability (`calendar` operations). */
    readonly calendar: CalendarCapability;
    /** Atai vectors capability (`vectors` operations). */
    readonly vectors: VectorsCapability;
    /** Atai database capability (`db` operations). */
    readonly db: DatabaseCapability;
    /** Atai payments capability (`payments` operations). */
    readonly payments: PaymentsCapability;
    /** Atai health capability (connectivity/credential status check). */
    readonly health: HealthCapability;
    constructor(config: AtaiConfig);
}
//# sourceMappingURL=client.d.ts.map