/**
 * Per-feature environment access. Each getter throws a typed ConfigError only
 * when the feature that actually needs it is invoked — so pages/routes that
 * don't touch Mongo/Google/SMTP/ImageKit never crash from an unrelated
 * missing secret (spec section 2).
 */
import { AppError } from "@/lib/errors"

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new AppError("DATABASE_UNAVAILABLE", `Missing required environment variable: ${name}`, 503)
  }
  return value
}

export function getMongoUri(): string {
  const value = process.env.MONGODB_URI
  if (!value) {
    throw new AppError("DATABASE_UNAVAILABLE", "MONGODB_URI is not configured.", 503)
  }
  return value
}

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new AppError("GOOGLE_AUTH_FAILED", "Google sign-in is not configured yet.", 503)
  }
  const redirectUri = getOAuthRedirectUri("google", process.env.GOOGLE_REDIRECT_URI ?? process.env.OAUTH_BASE_URL)
  return {
    clientId,
    clientSecret,
    redirectUri,
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export interface SmtpConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
}

export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  if (!host || !port || !user || !password) {
    throw new AppError("EMAIL_UNAVAILABLE", "Email sending is not configured yet.", 503)
  }
  return {
    host,
    port: Number(port),
    user,
    password,
    from: process.env.SMTP_FROM || user,
  }
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

export interface ImageKitConfig {
  publicKey: string
  privateKey: string
  urlEndpoint: string
}

export function getImageKitConfig(): ImageKitConfig {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new AppError("IMAGE_UPLOAD_FAILED", "Image uploads are not configured yet.", 503)
  }
  return { publicKey, privateKey, urlEndpoint }
}

export function isImageKitConfigured(): boolean {
  return Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT)
}

export function getAuthSecret(): string {
  return required("AUTH_SECRET")
}

export function getAppUrl(): string {
  const production = process.env.NODE_ENV === "production"
  const configured = process.env.NEXT_PUBLIC_APP_URL
  const raw = configured || (!production && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : !production ? "http://localhost:3000" : "")
  try {
    const url = new URL(raw)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error()
    if (production && (url.protocol !== "https:" || /^(localhost|127\.|0\.|\[::1\])/.test(url.hostname))) throw new Error()
    return url.origin
  } catch {
    throw new AppError("UNKNOWN", "The application URL is not configured correctly.", 503)
  }
}

export function getOAuthRedirectUri(provider: "google" | "github", configuredBase?: string): string {
  const canonical = getAppUrl()
  const callbackPath = `/api/auth/${provider}/callback`
  try {
    const url = new URL(configuredBase ?? canonical)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !["/", callbackPath].includes(url.pathname)) throw new Error()
    if (process.env.NODE_ENV === "production" && url.origin !== canonical) throw new Error()
    url.pathname = callbackPath
    return url.toString()
  } catch {
    throw new AppError("UNKNOWN", "The sign-in callback URL is not configured correctly.", 503)
  }
}

export const SITE_URL = getAppUrl()

/**
 * Developer portal URL (developers.atai.ink in production — served by the same
 * app via the proxy.ts host rewrite; /developers on localhost/previews). Safe to
 * call from client components: only NEXT_PUBLIC_* vars and NODE_ENV are read.
 */
export function getDeveloperPortalUrl(): string {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL) {
    return `https://${process.env.NEXT_PUBLIC_DEV_PORTAL_HOST ?? "developers.atai.ink"}`
  }
  return "/developers"
}

/** The developer portal's canonical origin (for SEO metadata / sitemap entries). */
export function getDeveloperPortalOrigin(): string {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL) {
    return `https://${process.env.NEXT_PUBLIC_DEV_PORTAL_HOST ?? "developers.atai.ink"}`
  }
  return `${getAppUrl()}/developers`
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI)
}

// ─── Dodo Payments ──────────────────────────────────────────────────────────

export interface DodoConfig {
  apiKey: string
  webhookKey: string
  environment: string
}

/**
 * Get Dodo Payments configuration.
 * @throws if API key is missing.
 */
export function getDodoConfig(): DodoConfig {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY
  if (!apiKey) {
    throw new AppError("PAYMENT_UNAVAILABLE", "Dodo Payments API key is not configured.", 503)
  }
  return {
    apiKey,
    webhookKey: webhookKey ?? "",
    environment: getPaymentEnvironment(),
  }
}

export function getPaymentEnvironment(): "test_mode" | "live_mode" {
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT
  if (environment === "test_mode" || environment === "live_mode") return environment
  if (!environment && process.env.NODE_ENV !== "production") return "test_mode"
  throw new AppError("PAYMENT_UNAVAILABLE", "Payment environment is not configured correctly.", 503)
}

export function isDodoConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY)
}
