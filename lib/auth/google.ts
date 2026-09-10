import { jwtVerify, createRemoteJWKSet } from "jose"
import { getGoogleOAuthConfig } from "@/lib/env"
import { AppError } from "@/lib/errors"

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URI))
  return jwks
}

/** Builds the Google consent-screen redirect URL, including a random
 * `state` value the caller must persist (in a short-lived cookie) and
 * compare on callback to prevent CSRF (spec section 3). */
export function buildGoogleAuthUrl(state: string): string {
  const config = getGoogleOAuthConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface GoogleProfile {
  googleId: string
  email: string
  emailVerified: boolean
  name: string
  imageUrl?: string
}

/** Exchanges an authorization code for tokens and verifies the ID token's
 * signature/claims against Google's published JWKS before trusting any of
 * its content (spec section 3 — no unverified profile data is ever used). */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const config = getGoogleOAuthConfig()

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenResponse.ok) {
    throw new AppError("GOOGLE_AUTH_FAILED")
  }

  const tokenData = (await tokenResponse.json()) as { id_token?: string }
  if (!tokenData.id_token) {
    throw new AppError("GOOGLE_AUTH_FAILED")
  }

  const { payload } = await jwtVerify(tokenData.id_token, getJwks(), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.clientId,
  })

  const sub = payload.sub as string | undefined
  const email = payload.email as string | undefined
  if (!sub || !email) {
    throw new AppError("GOOGLE_AUTH_FAILED")
  }

  return {
    googleId: sub,
    email,
    emailVerified: Boolean(payload.email_verified),
    name: (payload.name as string) || email.split("@")[0],
    imageUrl: payload.picture as string | undefined,
  }
}
