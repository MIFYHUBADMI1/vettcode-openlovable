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
  // OAuth redirect must point to where the app is ACTUALLY running,
  // not the public canonical URL. Allow an explicit override via
  // GOOGLE_REDIRECT_URI or OAUTH_BASE_URL for local dev.
  const base = process.env.GOOGLE_REDIRECT_URI
    ?? process.env.OAUTH_BASE_URL
    ?? getAppUrl()
  const redirectUri = base.endsWith("/api/auth/google/callback")
    ? base
    : `${base}/api/auth/google/callback`
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
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

/**
 * Canonical site URL used across SEO metadata, structured data, sitemaps, and robots.
 * Resolves from NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost at runtime.
 */
export const SITE_URL = getAppUrl()

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI)
}
