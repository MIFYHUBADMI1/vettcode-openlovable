# Vercel Environment Variables Setup

## Required Environment Variables for Production

After updating your code, you need to set these environment variables in Vercel Dashboard:

### 1. Authentication Variables

```bash
NEXTAUTH_SECRET=your_nextauth_secret_here
```

> **NEXTAUTH_URL note:** The app now resolves this automatically — in production
> it falls back to `VERCEL_URL`, and in development it defaults to
> `http://localhost:3000`. You no longer need to hardcode a production
> `NEXTAUTH_URL` in `.env.local`, and doing so is discouraged because it
> breaks local cookie persistence. Only set `NEXTAUTH_URL` if you need a
> non-default production origin.

### 2. Google OAuth

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Note:** Get your Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)

### 3. Required Redirect URIs in Google Cloud Console

Add these to your OAuth 2.0 Client in Google Cloud Console:

**Authorized redirect URIs:**

```
http://localhost:3000/api/auth/callback/google
https://mirrorsiteai.vercel.app/api/auth/callback/google
```

**Authorized JavaScript origins:**

```
http://localhost:3000
https://mirrorsiteai.vercel.app
```

## How to Add Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add each variable above
5. Select: Production, Preview, Development
6. Save and redeploy

### Method 2: Using Vercel CLI

```bash
vercel env add NEXTAUTH_URL
# Enter: https://mirrorsiteai.vercel.app
# Select: Production, Preview, Development

vercel env add NEXTAUTH_SECRET
# Enter: your_secret
# Select: Production, Preview, Development
```

## After Adding Variables

1. Go to Deployments tab
2. Click "..." menu on latest deployment
3. Click "Redeploy"
4. Wait for deployment to complete
5. Test login again

## Troubleshooting

If login still fails:

1. Clear browser cache and cookies
2. Try incognito/private window
3. Verify URLs in Google Console match exactly
4. Check Vercel logs for errors
5. Ensure NEXTAUTH_URL has NO trailing slash

## Security Best Practices

- Never commit `.env.local` to GitHub
- Use different secrets for development and production
- Rotate secrets regularly
- Keep your Google Client Secret private
