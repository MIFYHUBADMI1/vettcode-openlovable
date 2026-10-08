# Developer Portal — Going Live on developers.atai.ink

Everything is already built and wired in the app. This guide covers the **infrastructure steps only you can do** (DNS, hosting dashboard) to make `developers.atai.ink` live.

## How it works (no second deployment)

- The portal is the **same Next.js app**, served from the `/developers` route subtree.
- `proxy.ts` rewrites any request whose host is `developers.atai.ink` into `/developers/...` — the browser address bar keeps showing `developers.atai.ink` because rewrites never change the URL.
- `/api/*` and `/_next/*` are excluded from the rewrite, so portal pages' fetches hit the real session-gated APIs and static assets load normally.
- The session cookie (`Atai_session`) is issued with `Domain=.atai.ink` in production (`lib/auth/session.ts`), so a user logged in on `atai.ink` is **automatically authenticated** on `developers.atai.ink`. No second login.
- On `localhost` (and any non-production host), the portal is simply at `http://localhost:3000/developers` — no DNS or hosts-file edits needed for development.

## Step 1 — DNS record

At your DNS provider (where `atai.ink` is managed):

| Type  | Name        | Value                                   | TTL   |
|-------|-------------|-----------------------------------------|-------|
| CNAME | developers  | your deployment host (e.g. `cname.vercel-dns.com`) | auto |

If the apex uses a Cloudflare proxy, either proxy the CNAME (orange cloud) or leave DNS-only — both work; HTTPS is terminated at the hosting platform either way.

## Step 2 — Register the domain with your host

- **Vercel:** Project → Settings → Domains → add `developers.atai.ink`. SSL certificates are issued automatically. Point the CNAME from step 1 at the value Vercel shows.
- **Other hosts:** add the subdomain to the same deployment/app so it routes to the same instance, with automatic HTTPS.

## Step 3 — Environment variables (production)

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://atai.ink` | Already required — also gates the cookie-domain widening and portal-URL helpers (`lib/env.ts`). |
| `NEXT_PUBLIC_DEV_PORTAL_HOST` | `developers.atai.ink` (optional) | Only needed to override the default, e.g. `developers.staging.atai.ink` on a staging deploy. In production the default is already `developers.atai.ink`. |

## Step 4 — Verify

1. Visit `https://developers.atai.ink` → logged-out users land on `/login?next=/developers`; after login the portal loads **on the subdomain**.
2. Address bar shows `developers.atai.ink/...` on every portal page (Overview, Keys, Usage, Playground).
3. Click "Developer portal ↗" from any project's **Runtime** nav, or "Open developer portal ↗" from **Runtime → API keys**.
4. From `/sdk`, "Try it in the playground" and the API-keys callout both open the portal.
5. Playground: pick an endpoint, paste (or select) a real key, send — latency and success/failure are recorded per run.

## Search & browser appearance

- **Address bar:** shows `developers.atai.ink` automatically — the host rewrite serves different routes per hostname without redirecting.
- **Search results:** `app/developers/layout.tsx` sets title/description/OpenGraph metadata with `metadataBase` on the portal origin; `app/sitemap.ts` lists the portal URL, and `app/robots.ts` explicitly allows it. After DNS + HTTPS are live, submit `https://atai.ink/sitemap.xml` in Google Search Console (it contains the `developers.atai.ink` entry) and request indexing of `https://developers.atai.ink/`.
- **Canonical:** portal pages canonicalize to the portal origin, so the main site and the subdomain never compete for the same URL.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Portal asks for login on the subdomain even though logged in | Cookie still host-only (issued before this change) | Log out and back in — new cookie gets `Domain=.atai.ink`. |
| `developers.atai.ink` shows the main site's homepage | DNS not pointing at the deployment, or domain not registered on the host | Steps 1–2. |
| Rewrite not happening on a preview deploy | `NEXT_PUBLIC_DEV_PORTAL_HOST` unset and NODE_ENV is not production | Set `NEXT_PUBLIC_DEV_PORTAL_HOST=developers.<preview-domain>` for that deploy. |
| SSL warning | Certificate not yet issued | Wait a few minutes after adding the domain on the host. |
