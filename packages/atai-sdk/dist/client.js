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
import { resolveConfig } from "./config.js";
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
export class Atai {
    /** Atai AI capability (`ai.text` operations). */
    ai;
    /** Atai voice capability (`ai.speak` operations). */
    voice;
    /** Atai search capability (`search.web` operations). */
    search;
    /** Atai web capability (`web.scrape` operations). */
    web;
    /** Atai email capability (`email` operations). */
    email;
    /** Atai SMS capability (`sms` operations). */
    sms;
    /** Atai WhatsApp capability (`whatsapp` operations). */
    whatsapp;
    /** Atai notifications capability (`notifications` operations). */
    notifications;
    /** Atai maps capability (`maps` operations). */
    maps;
    /** Atai calendar capability (`calendar` operations). */
    calendar;
    /** Atai vectors capability (`vectors` operations). */
    vectors;
    /** Atai database capability (`db` operations). */
    db;
    /** Atai payments capability (`payments` operations). */
    payments;
    /** Atai health capability (connectivity/credential status check). */
    health;
    constructor(config) {
        // Validate once, at construction; requests can never change the
        // credential or the runtime origin afterwards.
        const resolved = resolveConfig(config);
        this.ai = new AiCapability(resolved);
        this.voice = new VoiceCapability(resolved);
        this.search = new SearchCapability(resolved);
        this.web = new WebCapability(resolved);
        this.email = new EmailCapability(resolved);
        this.sms = new SmsCapability(resolved);
        this.whatsapp = new WhatsappCapability(resolved);
        this.notifications = new NotificationsCapability(resolved);
        this.maps = new MapsCapability(resolved);
        this.calendar = new CalendarCapability(resolved);
        this.vectors = new VectorsCapability(resolved);
        this.db = new DatabaseCapability(resolved);
        this.payments = new PaymentsCapability(resolved);
        this.health = new HealthCapability(resolved);
    }
}
//# sourceMappingURL=client.js.map