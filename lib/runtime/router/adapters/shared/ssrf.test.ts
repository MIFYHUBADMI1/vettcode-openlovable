import { describe, it, expect, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { assertPublicHttpUrl } from "./ssrf"

function expectBlocked(raw: string) {
  expect(() => assertPublicHttpUrl(raw)).toThrow()
}

describe("assertPublicHttpUrl", () => {
  it("allows ordinary public https URLs", () => {
    expect(assertPublicHttpUrl("https://example.com/path").host).toBe("example.com")
  })

  it("blocks loopback, link-local, private, and metadata hosts", () => {
    for (const raw of [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://metadata.google.internal/",
      "http://foo.internal/bar",
    ]) {
      expectBlocked(raw)
    }
  })

  it("blocks encoded and mapped IP forms", () => {
    for (const raw of [
      "http://2130706433/",
      "http://0177.0.0.1/",
      "http://127.1/",
      "http://[::ffff:127.0.0.1]/",
    ]) {
      expectBlocked(raw)
    }
  })

  it("blocks non-http schemes and credentialed URLs", () => {
    expectBlocked("file:///etc/passwd")
    expectBlocked("ftp://example.com/")
    expectBlocked("https://user:pass@example.com/")
  })
})
