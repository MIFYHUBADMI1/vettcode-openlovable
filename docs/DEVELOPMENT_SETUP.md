# 🛠️ Development Setup

**Get from zero to running app in one day**

---

## Prerequisites

Make sure you have these installed before starting:

```bash
# Check versions
node --version    # Need 18.x or higher (20.x recommended)
npm --version     # Comes with Node
git --version     # For version control
```

If you don't have Node.js: Download from https://nodejs.org (pick LTS version)

---

## Step 1: Clone / Open the Project

The project already exists at:
```
C:\Users\USER\Desktop\Ataiai\
```

Open it in your IDE (VS Code or Kiro).

---

## Step 2: Install Dependencies

```powershell
npm install
```

This installs ~50 packages. Takes 1-2 minutes.

**If you get errors**:
```powershell
# Clear npm cache and retry
npm cache clean --force
Remove-Item -Recurse -Force node_modules
npm install
```

---

## Step 3: Verify Environment Variables

The `.env.local` file has all secrets. It should already exist. Open it and verify these are present:

```bash
# Critical — app won't start without these:
MONGODB_URI          # MongoDB Atlas connection
AUTH_SECRET          # JWT signing (any random string)
NEXT_PUBLIC_APP_URL  # http://localhost:3000 for local dev
OAUTH_BASE_URL       # http://localhost:3000 for local dev

# Needed for crawling features:
FIRECRAWL_API_KEY    # fc-xxxx...

# Needed for AI features:
OPENROUTER_API_KEY   # sk-or-v1-xxxx...

# Needed for payments:
DODO_PAYMENTS_API_KEY       # eZYEv36W...
DODO_PAYMENTS_WEBHOOK_KEY   # whsec_...
DODO_PAYMENTS_ENVIRONMENT   # test_mode
```

> ⚠️ **If `.env.local` is missing**: You need to recreate it. Use `.env.example` as a template and fill in the values. The actual values are in the Vercel dashboard under Environment Variables (or ask your past self where you stored them).

---

## Step 4: Start the Dev Server

```powershell
npm run dev
```

You should see:
```
▲ Next.js 16.3.3
- Local:        http://localhost:3000
- Environments: .env.local, .env
✓ Ready in 2.1s
```

Open http://localhost:3000 in your browser.

**If port 3000 is busy**:
```powershell
# Kill whatever is using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

---

## Step 5: Verify the App Works

### Check 1: Landing Page
- Go to http://localhost:3000
- Should see the Atai landing page
- No errors in browser console

### Check 2: Registration
- Click "Sign Up" or go to http://localhost:3000/register
- Register with a test email (use a real email you own — verification email will be sent)
- Check inbox for verification email

### Check 3: Login
- Log in with the account you created
- Should reach the dashboard
- Should see credit balance

### Check 4: Create a Project
- On dashboard, create a new project
- Enter a simple URL (try https://example.com — it's fast)
- Choose "Smart Crawl"
- Watch the activity timeline update
- Should complete in 30-60 seconds

### Check 5: Admin Panel
- In MongoDB, find your user document and set `role: "admin"`
- Go to http://localhost:3000/admin
- Should see the admin dashboard with all sections

---

## Step 6: Connect to MongoDB (Optional)

To browse the database directly:

1. Download **MongoDB Compass** from https://www.mongodb.com/products/tools/compass
2. Open Compass
3. Paste your `MONGODB_URI` from `.env.local`
4. Connect
5. Browse collections: users, projects, credit_ledger, etc.

This is very useful for debugging — you can see exactly what's in the database.

---

## Step 7: Run Tests

```powershell
npm test
```

Current tests cover: credit system, research schema, critic report structure, circuit breaker.

**If tests fail**: Check if there are TypeScript errors first (`npm run build`), fix those, then re-run tests.

---

## Common Setup Problems

### "Module not found" errors
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next
npm install
npm run dev
```

### MongoDB connection fails
- Check `MONGODB_URI` in `.env.local` is correct
- Go to https://cloud.mongodb.com → Network Access → Add your IP address
- MongoDB Atlas blocks connections from IPs not on the whitelist
- For development, you can add `0.0.0.0/0` (allow all IPs) — NOT for production

### "AUTH_SECRET is not set"
- Make sure `.env.local` exists and has `AUTH_SECRET=...`
- Restart the dev server after changing env vars

### Google OAuth doesn't work locally
- Make sure `OAUTH_BASE_URL=http://localhost:3000` is in `.env.local`
- Make sure `http://localhost:3000/api/auth/google/callback` is in your Google Console authorized redirect URIs
- In Google Console: https://console.cloud.google.com → APIs & Services → Credentials

### TypeScript build errors
```powershell
npm run build
```
Fix all TypeScript errors before doing anything else. Errors cascade — one broken type breaks many files.

### Firecrawl not working
- Check `FIRECRAWL_API_KEY` is valid
- Go to https://firecrawl.dev → Dashboard → check API key
- Check usage limits (free tier has limits)

### OpenRouter not working
- Check `OPENROUTER_API_KEY` is valid
- Go to https://openrouter.ai → Keys → verify key exists
- Free models may be rate limited — try again later or switch to a different free model

---

## Useful Dev Commands

```powershell
# Start development server
npm run dev

# Build for production (catches TypeScript errors)
npm run build

# Run tests once (no watch mode)
npm test

# Run tests in watch mode
npm run test:watch

# Clean up old credit transactions (utility script)
npm run cleanup:credit-transactions
```

---

## Project File Structure for Navigating

```
app/                    ← Next.js pages and API routes
  api/                  ← API endpoints (all /api/* routes)
    auth/               ← Login, register, OAuth, logout
    projects/           ← Create, list, get, update projects
    billing/            ← Payments, webhooks, subscriptions
    credits/            ← Credit balance, transactions
    admin/              ← Admin-only endpoints
  admin/                ← Admin dashboard pages
  dashboard/            ← User dashboard pages
  (auth)/               ← Login/register pages
  
components/             ← Reusable React components
  ui/                   ← Base UI components (buttons, inputs, etc.)
  
lib/                    ← Core business logic (NO React here)
  analysis/             ← Crawl + analysis pipeline
  planning/             ← 7-stage AI pipeline
  credits/              ← Credit system
  billing/              ← Billing types and logic
  db/                   ← Database collections + indexes
  integrations/         ← External API clients
    firecrawl/          ← Website crawling
    openrouter/         ← AI models
  auth/                 ← Authentication helpers
  email/                ← Email sending
  logging/              ← Logger
  store/                ← Data access layer
  
docs/                   ← 📚 This folder (you are here)
```

---

## Making Your First Code Change

1. Pick something small from `NEXT_STEPS.md`
2. Find the relevant file (use the structure above)
3. Make the change
4. `npm run build` — fix any TypeScript errors
5. Test it manually in the browser
6. `npm test` — make sure existing tests pass
7. Commit: `git add <file> && git commit -m "description of change"`

---

## Deploying to Production

The app is already deployed at https://Atai.atai.ink via Vercel.

**Automatic deployment**: Every push to the `main` branch auto-deploys to Vercel.

**Manual deployment**: Push to `main` via git.

```powershell
git add .
git commit -m "your change description"
git push origin main
```

Then go to https://vercel.com/dashboard to watch the deployment.

> ⚠️ **Before pushing**: Always run `npm run build` locally first. Vercel will fail the deployment if there are TypeScript errors.

---

## Checking Production Logs

Go to https://vercel.com/dashboard → Your project → Logs tab.

Filter logs by:
- Error level (find failures)
- Project ID (trace a specific user's request)
- Stage name (e.g., `firecrawl.crawlSiteUrl`)

Log format:
```json
{"ts":"2026-09-09T11:47:11Z","level":"info","stage":"firecrawl.crawlSiteUrl","message":"poll response","crawlId":"..."}
```

---

## Re-Setting Up From Scratch (If Something is Badly Broken)

If things are completely broken and you need to start fresh:

```powershell
# 1. Remove all generated files
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next

# 2. Reinstall
npm install

# 3. Verify env vars exist
Get-Content .env.local

# 4. Build to check for errors
npm run build

# 5. Start dev server
npm run dev
```

If build still fails, read the errors carefully — they always tell you the exact file and line.

---

**Related**: `TROUBLESHOOTING.md` for specific errors and fixes
