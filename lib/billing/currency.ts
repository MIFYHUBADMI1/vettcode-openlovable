/**
 * Country → billing currency mapping for Dodo Payments Adaptive Currency.
 *
 * Only includes currencies explicitly supported by Dodo's Adaptive Currency
 * feature. Countries not listed here fall back to USD (the base currency).
 *
 * @see https://docs.dodopayments.com/features/adaptive-currency
 */

export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Africa
  CM: "XAF", CF: "XAF", TD: "XAF", CG: "XAF", GQ: "XAF", GA: "XAF",
  BJ: "XOF", BF: "XOF", CI: "XOF", GW: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF",
  ZA: "ZAR", ZM: "ZMW", TZ: "TZS", NG: "NGN", ET: "ETB", GH: "GHS",
  MA: "MAD", MU: "MUR", SC: "SCR", BW: "BWP", LS: "LSL", SZ: "SZL",
  MG: "MGA", MW: "MWK", GM: "GMD", LR: "LRD",
  // Asia
  IN: "INR", JP: "JPY", CN: "CNY", KR: "KRW", SG: "SGD", HK: "HKD",
  MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", BD: "BDT", LK: "LKR",
  NP: "NPR", PK: "PKR", VN: "VND", TW: "TWD", KZ: "KZT", GE: "GEL",
  AZ: "AZN", AM: "AMD", MV: "MVR",
  // Middle East
  AE: "AED", SA: "SAR", QA: "QAR",
  // Europe
  GB: "GBP", CH: "CHF", LI: "CHF", NO: "NOK", SE: "SEK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", RS: "RSD", MK: "MKD",
  BA: "BAM", AL: "ALL",
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR",
  LU: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR",
  ES: "EUR", AD: "EUR", MC: "EUR", HR: "EUR", SM: "EUR", ME: "EUR",
  // Americas
  CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP",
  PE: "PEN", UY: "UYU", PY: "PYG", BO: "BOB", GT: "GTQ", HN: "HNL",
  DO: "DOP", CR: "CRC", BZ: "BZD", JM: "JMD", BB: "BBD", GY: "GYD",
  BS: "BSD", BM: "BMD",
  // Oceania
  AU: "AUD", NZ: "NZD", FJ: "FJD", PG: "PGK", SB: "SBD", TO: "TOP",
  WS: "WST",
  // Other
  EG: "EGP", IL: "ILS", TR: "TRY", BN: "BND", MO: "MOP",
}

/**
 * Detect the user's country code from the incoming request.
 *
 * Priority order:
 * 1. Vercel/Cloudflare edge header (CF-IPCountry or x-vercel-ip-country)
 * 2. x-forwarded-for → IP geolocation via ip-api.com (free, no key needed)
 * 3. Falls back to null (checkout will use USD)
 */
export async function detectCountryFromRequest(req: Request): Promise<string | null> {
  // Vercel sets this header in production
  const vercelCountry = req.headers.get("x-vercel-ip-country")
  if (vercelCountry && vercelCountry !== "XX") return vercelCountry.toUpperCase()

  // Cloudflare sets this header
  const cfCountry = req.headers.get("cf-ipcountry")
  if (cfCountry && cfCountry !== "XX" && cfCountry !== "T1") return cfCountry.toUpperCase()

  // Development fallback: use the client IP via ip-api.com (free tier, no key)
  // This only runs locally since Vercel injects the header in production.
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : null

  if (ip && ip !== "::1" && ip !== "127.0.0.1") {
    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) {
        const data = await res.json() as { countryCode?: string }
        if (data.countryCode) return data.countryCode.toUpperCase()
      }
    } catch {
      // Non-fatal — fall back to USD
    }
  }

  return null
}

/**
 * Resolve the billing currency to use for a checkout session.
 * Returns the local currency code if Dodo supports it, otherwise null (USD).
 */
export function resolveBillingCurrency(countryCode: string | null): string | null {
  if (!countryCode) return null
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? null
}
