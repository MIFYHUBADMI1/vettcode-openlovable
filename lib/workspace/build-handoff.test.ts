import { describe, expect, it } from "vitest"
import { parseTeamHandoff } from "./build-handoff"

const SAMPLE = `🔔 coping is built and ready. The final build passes with zero type errors across 37 routes.

Delivered
Branded SaaS experience: modern landing page, dark/light mode, responsive dashboard.
Totalum-backed authentication: email/password sign-up and login.

Included demo data
A real end-to-end generation was completed for Lumen Booking.

| Email | Password | Role |
|---|---|---|
| demo@coping.app | coping123 | Admin |
| marc.dubois@studioform.co | coping123 | User |

The seeded projects include Northwind Analytics.

Payments setup
Live payments need a Stripe secret key.`

describe("parseTeamHandoff", () => {
  it("turns a finished-build note into a readable handoff", () => {
    const handoff = parseTeamHandoff(SAMPLE)
    expect(handoff.headline).toBe("coping is built and ready.")
    expect(handoff.support).toMatch(/zero type errors/)
    expect(handoff.sections.map((s) => s.id)).toEqual(["delivered", "included-demo-data", "payments-setup"])
    expect(handoff.sections[0].items[0]?.title).toBe("Branded SaaS experience")
    expect(handoff.sections[1].table?.headers).toEqual(["Email", "Password", "Role"])
    expect(handoff.sections[1].table?.rows[0]).toEqual(["demo@coping.app", "coping123", "Admin"])
    expect(handoff.sections[2].paragraphs[0]).toMatch(/Stripe/)
  })
})
