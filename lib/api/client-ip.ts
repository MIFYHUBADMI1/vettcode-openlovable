import { isIP } from "node:net"
import { AppError } from "@/lib/errors"

function canonicalIp(raw: string | undefined): string | null {
  const ip = raw?.trim().toLowerCase()
  if (!ip || !isIP(ip)) return null
  if (isIP(ip) === 4) return ip
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1)
  if (canonical.startsWith("::ffff:")) {
    const parts = canonical.slice(7).split(":")
    if (parts.length === 2) {
      const number = parseInt(parts[0], 16) * 65536 + parseInt(parts[1], 16)
      return [24, 16, 8, 0].map((shift) => (number >>> shift) & 255).join(".")
    }
  }
  return canonical
}

export function getVerifiedClientIp(req: Request): string | null {
  if (process.env.VERCEL === "1") {
    return canonicalIp(req.headers.get("x-vercel-forwarded-for") ?? undefined)
  }
  const rawHops = process.env.TRUSTED_PROXY_HOPS ?? ""
  if (!/^(?:[1-9]|10)$/.test(rawHops)) return null
  const header = req.headers.get("x-forwarded-for")
  if (!header || header.length > 2048) return null
  const chain = header.split(",")
  // Only safe when the origin accepts traffic exclusively from the configured proxy chain.
  return canonicalIp(chain[chain.length - Number(rawHops)])
}

export function clientIpBucket(req: Request): string {
  const ip = getVerifiedClientIp(req)
  if (ip) return `ip:${ip}`
  if (process.env.NODE_ENV === "production") {
    throw new AppError("UNKNOWN", "Authentication is temporarily unavailable. Please try again later.", 503)
  }
  return "unverified-development"
}
