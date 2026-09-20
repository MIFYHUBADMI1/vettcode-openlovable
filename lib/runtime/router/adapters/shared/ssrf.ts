import "server-only"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Shared SSRF guard for URL-capable runtime adapters.
 *
 * Defense-in-depth: the provider fetches from its own network, but Atai must
 * never forward loopback, RFC1918, link-local, metadata, or encoded-IP
 * targets. DNS rebinding after this check is out of scope (no async resolve).
 */

const PRIVATE_V4_PATTERNS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
]

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
  "kubernetes.default.svc.cluster.local",
])

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    if (part.length > 1 && part.startsWith("0")) return null
    const n = Number(part)
    if (n > 255) return null
    value = value * 256 + n
  }
  return value
}

export function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToLong(ip)
  if (value === null) return false
  return PRIVATE_V4_PATTERNS.some(([base, bits]) => {
    const baseValue = ipv4ToLong(base)
    if (baseValue === null) return false
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) === (baseValue & mask)
  })
}

export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === "::1" ||
    h === "::" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe8") ||
    h.startsWith("fe9") ||
    h.startsWith("fea") ||
    h.startsWith("feb")
  )
}

function reject(detail: string): never {
  throw new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    detail,
  )
}

function dottedFromUint32(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".")
}

function hostLooksEncodedIp(host: string): boolean {
  if (/^\d+$/.test(host)) return true
  if (/^0x[0-9a-f]+$/i.test(host)) return true
  if (/^\d+\.\d+(\.\d+)?$/.test(host)) return true
  if (host.split(".").some((p) => /^\d+$/.test(p) && p.length > 1 && p.startsWith("0"))) return true
  return false
}

/**
 * Is this URL safe to forward to a scrape/search provider?
 * http(s) only, no credentials, no loopback/private/link-local literals,
 * no internal hostnames, no encoded IP forms.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    reject("url is not a valid absolute URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    reject("only http and https URLs are supported")
  }
  if (url.username || url.password) {
    reject("URLs with embedded credentials are not allowed")
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (
    !host ||
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    reject("internal hosts are not allowed")
  }

  const v4mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (v4mapped) {
    if (isPrivateIpv4(v4mapped[1]) || ipv4ToLong(v4mapped[1]) === null) {
      reject("private network addresses are not allowed")
    }
  }

  if (host.includes(":")) {
    if (isPrivateIpv6(host) || host.startsWith("::ffff:") || v4mapped) {
      reject("private network addresses are not allowed")
    }
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (ipv4ToLong(host) === null || isPrivateIpv4(host)) {
      reject("private network addresses are not allowed")
    }
  } else if (hostLooksEncodedIp(host)) {
    if (/^\d+$/.test(host)) {
      const n = Number(host)
      if (Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff && isPrivateIpv4(dottedFromUint32(n))) {
        reject("private network addresses are not allowed")
      }
    }
    reject("encoded IP addresses are not allowed")
  }

  return url
}
