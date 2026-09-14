import { AppError } from "@/lib/errors"

const AUTH_ENDPOINT = "https://github.com/login/oauth/authorize"
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token"
const API_BASE = "https://api.github.com"

export interface GitHubOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function getGitHubOAuthConfig(): GitHubOAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new AppError("GITHUB_AUTH_FAILED" as never, "GitHub sign-in is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.", 503)
  }
  const base = process.env.GITHUB_REDIRECT_URI
    ?? process.env.OAUTH_BASE_URL
    ?? process.env.NEXTAUTH_URL
    ?? "http://localhost:3000"
  const redirectUri = base.endsWith("/api/auth/github/callback")
    ? base
    : `${base.replace(/\/$/, "")}/api/auth/github/callback`
  return { clientId, clientSecret, redirectUri }
}

export function buildGitHubAuthUrl(state: string): string {
  const config = getGitHubOAuthConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "repo read:user user:email",
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface GitHubProfile {
  githubId: string
  login: string
  name: string
  email: string | null
  imageUrl?: string
}

export async function exchangeGitHubCode(code: string): Promise<{ accessToken: string }> {
  const config = getGitHubOAuthConfig()
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  })
  if (!res.ok) throw new AppError("GITHUB_AUTH_FAILED" as never, "GitHub token exchange failed.", 502)
  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new AppError("GITHUB_AUTH_FAILED" as never, data.error ?? "No access token returned.", 502)
  return { accessToken: data.access_token }
}

export async function getGitHubProfile(accessToken: string): Promise<GitHubProfile> {
  const res = await fetch(`${API_BASE}/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  })
  if (!res.ok) throw new AppError("GITHUB_AUTH_FAILED" as never, "Failed to fetch GitHub profile.", 502)
  const data = await res.json() as {
    id: number; login: string; name?: string; email?: string; avatar_url?: string
  }
  return {
    githubId: String(data.id),
    login: data.login,
    name: data.name || data.login,
    email: data.email ?? null,
    imageUrl: data.avatar_url,
  }
}

export async function getGitHubPrimaryEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/user/emails`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  })
  if (!res.ok) return null
  const emails = await res.json() as Array<{ email: string; primary: boolean; verified: boolean }>
  const primary = emails.find(e => e.primary && e.verified)
  return primary?.email ?? emails[0]?.email ?? null
}
