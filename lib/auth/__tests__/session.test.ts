/**
 * Bug condition exploration tests for setSessionCookie.
 *
 * Property 1: Bug Condition — HTTP Origin Cookie Secure Flag
 *
 * These tests encode the EXPECTED behavior (HTTP origin → secure: false).
 * On UNFIXED code they will FAIL because secure is hardcoded to `true`.
 * That failure is intentional — it confirms the bug exists.
 * After the fix is applied (task 3), these same tests will PASS.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"

// ---------------------------------------------------------------------------
// Hoist the mock factories so vi.mock can close over them
// ---------------------------------------------------------------------------
const { mockCookiesSet } = vi.hoisted(() => ({
  mockCookiesSet: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
    get: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => ({
    get: vi.fn(() => null),
  })),
}))

// ---------------------------------------------------------------------------
// Import the module AFTER mocking so the mock is in place
// ---------------------------------------------------------------------------
import { setSessionCookie } from "../session"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function capturedSecureOption(): boolean | undefined {
  // cookies().set(name, value, options) — we want options.secure
  const call = mockCookiesSet.mock.calls[0]
  if (!call) return undefined
  const options = call[2] as Record<string, unknown>
  return options?.secure as boolean | undefined
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("setSessionCookie — Bug Condition: HTTP origin secure flag", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    mockCookiesSet.mockClear()
    // Restore env after each test
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv
    }
  })

  // -------------------------------------------------------------------------
  // Test case 1: explicit HTTP localhost URL
  // -------------------------------------------------------------------------
  it("TC-1: sets secure: false when NEXT_PUBLIC_APP_URL is http://localhost:3000", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"

    await setSessionCookie("test-token")

    const secure = capturedSecureOption()
    // EXPECTED on fixed code: false
    // ACTUAL on unfixed code: true  ← BUG COUNTEREXAMPLE
    expect(secure).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Test case 2: NEXT_PUBLIC_APP_URL is not set at all
  // -------------------------------------------------------------------------
  it("TC-2: sets secure: false when NEXT_PUBLIC_APP_URL is undefined", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    await setSessionCookie("test-token")

    const secure = capturedSecureOption()
    // EXPECTED on fixed code: false
    // ACTUAL on unfixed code: true  ← BUG COUNTEREXAMPLE
    expect(secure).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Test case 3: NEXT_PUBLIC_APP_URL is an empty string
  // -------------------------------------------------------------------------
  it("TC-3: sets secure: false when NEXT_PUBLIC_APP_URL is empty string", async () => {
    process.env.NEXT_PUBLIC_APP_URL = ""

    await setSessionCookie("test-token")

    const secure = capturedSecureOption()
    // EXPECTED on fixed code: false
    // ACTUAL on unfixed code: true  ← BUG COUNTEREXAMPLE
    expect(secure).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Property test: for ANY non-https URL, secure must be false
  // Uses fast-check to generate many HTTP-scheme and non-https URL variants.
  // Validates: Requirements 1.1, 1.2, 1.3, 1.4
  // -------------------------------------------------------------------------
  it("PBT: secure is false for any NEXT_PUBLIC_APP_URL that does not start with https://", async () => {
    // Arbitraries that produce non-https URLs (the full set of HTTP-origin cases)
    const httpUrlArb = fc.oneof(
      // Plain http:// URLs
      fc
        .domain()
        .map((d) => `http://${d}`),
      // localhost variants
      fc.integer({ min: 1024, max: 65535 }).map((p) => `http://localhost:${p}`),
      // Empty / missing env
      fc.constant(""),
      fc.constant("http://localhost:3000"),
      fc.constant("http://127.0.0.1:3000"),
    )

    await fc.assert(
      fc.asyncProperty(httpUrlArb, async (appUrl) => {
        mockCookiesSet.mockClear()
        process.env.NEXT_PUBLIC_APP_URL = appUrl

        await setSessionCookie("tok")

        const secure = capturedSecureOption()
        // All non-https origins must produce secure: false on fixed code.
        // On UNFIXED code this property fails with the first counterexample
        // where secure === true (i.e. every case).
        return secure === false
      }),
      { numRuns: 50 },
    )
  })
})
