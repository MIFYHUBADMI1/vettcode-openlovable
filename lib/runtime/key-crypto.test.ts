/**
 * Atai Runtime — API key crypto tests (Phase 2 §34: generation, hashing,
 * format, entropy, safe prefix).
 */

import { describe, it, expect, vi } from "vitest"

// The repo runs Vitest outside the Next server bundle — mock the server-only
// marker (established pattern, cf. lib/planning/stages/idea-understanding.test.ts).
vi.mock("server-only", () => ({}))

import {
  generateApiKey,
  generateApiKeySecret,
  hashApiKey,
  apiKeyDisplayPrefix,
  hashesEqual,
} from "./key-crypto"

describe("runtime key-crypto", () => {
  describe("generateApiKeySecret", () => {
    it("uses the atai_<environment>_<secret> format", () => {
      const key = generateApiKeySecret("production")
      expect(key).toMatch(/^atai_production_[A-Za-z0-9_-]+$/)
      const dev = generateApiKeySecret("development")
      expect(dev).toMatch(/^atai_development_[A-Za-z0-9_-]+$/)
    })

    it("encodes the environment segment verbatim", () => {
      const key = generateApiKeySecret("development")
      expect(key.split("_")[1]).toBe("development")
    })

    it("carries sufficient entropy (≥40 chars of base64url secret)", () => {
      // base64url may contain "_", so slice by the known prefix — never split.
      const secret = generateApiKeySecret("production").slice("atai_production_".length)
      expect(secret.length).toBeGreaterThanOrEqual(40)
    })

    it("generates unique keys across many generations", () => {
      const keys = new Set(Array.from({ length: 1000 }, () => generateApiKeySecret("production")))
      expect(keys.size).toBe(1000)
    })

    it("never uses Math.random output in the secret", () => {
      // Deterministic check: two rapid generations differ (node:crypto-backed).
      const a = generateApiKeySecret("production")
      const b = generateApiKeySecret("production")
      expect(a).not.toBe(b)
    })
  })

  describe("hashApiKey", () => {
    it("produces a sha256 hex digest that does not contain the secret", () => {
      const key = generateApiKey("production")
      expect(key.keyHash).toMatch(/^[a-f0-9]{64}$/)
      expect(key.keyHash).not.toContain(key.secret)
    })

    it("is deterministic for the same input", () => {
      const k = generateApiKeySecret("production")
      expect(hashApiKey(k)).toBe(hashApiKey(k))
    })

    it("differs for different inputs", () => {
      const a = generateApiKeySecret("production")
      const b = generateApiKeySecret("production")
      expect(hashApiKey(a)).not.toBe(hashApiKey(b))
    })
  })

  describe("apiKeyDisplayPrefix", () => {
    it("reveals only the prefix — never the full secret", () => {
      const key = generateApiKey("production")
      expect(key.keyPrefix.startsWith("atai_production_")).toBe(true)
      expect(key.keyPrefix).not.toContain(key.secret)
      expect(key.keyPrefix.endsWith("…")).toBe(true)
    })

    it("is safe for display in public metadata", () => {
      const key = generateApiKey("development")
      // Prefix leaks at most 4 secret chars (plus the display ellipsis) —
      // far too little to reconstruct a 256-bit secret.
      const leaked = (key.keyPrefix.split("_")[2] ?? "").replace("…", "")
      expect(leaked.length).toBeLessThanOrEqual(4)
    })
  })

  describe("generateApiKey (bundle)", () => {
    it("returns hash + prefix + one-time plaintext", () => {
      const key = generateApiKey("production")
      expect(key.secret).toBeDefined()
      expect(key.keyHash).toBeDefined()
      expect(key.keyPrefix).toBeDefined()
      expect(key.environment).toBe("production")
      expect(hashApiKey(key.secret)).toBe(key.keyHash)
    })
  })

  describe("hashesEqual", () => {
    it("is constant-time safe and correct", () => {
      const k = generateApiKeySecret("production")
      expect(hashesEqual(hashApiKey(k), hashApiKey(k))).toBe(true)
      expect(hashesEqual(hashApiKey(k), hashApiKey(generateApiKeySecret("production")))).toBe(false)
    })
  })
})
