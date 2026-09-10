# 🔧 Troubleshooting Guide

**Every common error, what causes it, how to fix it**

---

## How to Use This Guide

1. Find your error message with Ctrl+F
2. Read the cause
3. Apply the fix
4. If not listed — check server logs, check MongoDB, check the specific API call

---

## Build & TypeScript Errors

### `error TS2353: Object literal may only specify known properties`
**Example**: `'content' does not exist in type 'FirecrawlPageEvidence'`

**Cause**: You're setting a property that doesn't exist in the TypeScript interface.

**Fix**: Open the interface definition (Ctrl+click on the type name) and either:
- Add the property to the interface with correct type
- Remove the property from the object literal
- Use a type assertion if you know it's safe: `(obj as any).content = ...`

---

### `error TS2307: Cannot find module '@/lib/...'`
**Cause**: The import path is wrong or the file doesn't exist.

**Fix**:
1. Verify the file exists at the path
2. Check `tsconfig.json` has `"@/*": ["./*"]` in paths
3. Restart the dev server (sometimes TypeScript cache is stale)

---

### `error TS2339: Property 'X' does not exist on type 'Y'`
**Cause**: Accessing a property that TypeScript doesn't know about.

**Fix**:
- If the property genuinely exists at runtime, add it to the interface
- If unsure, use optional chaining: `obj.prop?.subprop`
- Check if the object might be null/undefined

---

### Build passes locally but fails on Vercel
**Cause**: Local TypeScript config may be more lenient, or you have untracked files.

**Fix**:
1. Run `npm run build` locally — it must pass with zero errors
2. Check all imports use correct casing (Windows is case-insensitive, Linux is not)
3. Make sure `.env.local` values aren't needed at build time (only runtime)

---

## Database Errors

### `MongoServerError: E11000 duplicate key error`
**Cause**: Trying to insert a document that violates a unique index.

**Common scenarios**:
- Creating a user with an email that already exists
- Ledger entry with duplicate `idempotencyKey`
- Two sessions with same `tokenHash`

**Fix**: 
- For users: check if email exists before creating
- For ledger: the idempotency key prevents double-charging — this is correct behavior, handle the error gracefully
- For sessions: generate a new token

---

### `MongoNetworkError: connect ECONNREFUSED` or `MongoServerSelectionError`
**Cause**: Can't connect to MongoDB Atlas.

**Fix**:
1. Check `MONGODB_URI` in `.env.local` is correct
2. Go to MongoDB Atlas → Network Access → check your current IP is whitelisted
3. Add `0.0.0.0/0` for development (allows all IPs)
4. Check Atlas cluster is running (not paused — free tier pauses after 60 days of inactivity!)

> ⚠️ **Free tier pause**: MongoDB Atlas M0 (free) pauses after 60 days of no connections. If you come back after 4 months, go to Atlas, click your cluster, click "Resume" if it's paused.

---

### `MongoExpiredSessionError`
**Cause**: Long-running operation, MongoDB session timed out.

**Fix**: Not usually a real issue — it means the operation was long. Check if the operation actually completed by checking the collection in Compass.

---

### Indexes not created / query is slow
**Cause**: `ensureIndexes()` failed silently on startup.

**Fix**:
1. Check server logs for `[v0] ensureIndexes:` errors
2. You can manually trigger index creation by restarting the server
3. Or connect via Compass and create indexes manually

---

## Authentication Errors

### "Invalid credentials" — user can't log in
**Cause A**: Wrong password.  
**Fix**: Admin can reset password for user from admin panel.

**Cause B**: Email not verified.  
**Fix**: Check `users.emailVerified` in MongoDB. Admin can manually set to `true`.

**Cause C**: User was soft-deleted (`deletedAt` is set).  
**Fix**: Admin clears `deletedAt` field.

---

### "Session expired" — user gets logged out frequently
**Cause**: Sessions expire after 30 days, or the JWT secret changed.

**Fix**: 
- If `AUTH_SECRET` changed in env vars, all existing sessions are invalidated (this is correct behavior)
- If sessions expire too fast, check session creation code in `app/api/auth/login/`

---

### Google OAuth: "redirect_uri_mismatch"
**Cause**: The redirect URI in the OAuth request doesn't match what's registered in Google Console.

**Fix**:
1. Go to https://console.cloud.google.com → APIs & Services → Credentials → Your OAuth 2.0 Client
2. Add `http://localhost:3000/api/auth/google/callback` to authorized redirect URIs (for local dev)
3. Make sure `OAUTH_BASE_URL=http://localhost:3000` is in `.env.local`

---

### Google OAuth: "access_denied"
**Cause**: The app is in "Testing" mode in Google Console and the email isn't in the test users list.

**Fix**: 
- Either add the email to test users in Google Console → OAuth consent screen → Test users
- Or publish the app (removes the test restriction)

---

## Crawling Errors

### "Not enough credits for website analysis"
**Cause**: User balance is below the operation cost.

**Debug**:
1. Check user's `credits` field in MongoDB
2. Check `credit_ledger` for recent transactions

**Fix**: Admin can grant credits at `/admin/users` → select user → grant credits.

---

### "Website crawl request failed (401)"
**Cause**: `FIRECRAWL_API_KEY` is invalid or expired.

**Fix**:
1. Go to https://firecrawl.dev → Dashboard
2. Copy a fresh API key
3. Update `FIRECRAWL_API_KEY` in `.env.local`
4. Restart dev server

---

### "Website crawl request failed (429)"
**Cause**: Firecrawl rate limit exceeded (too many requests).

**Fix**:
- Wait a few minutes and retry
- Check Firecrawl dashboard for usage/limits
- On free tier: upgrade or wait for rate limit reset

---

### Deep crawl stuck in "analyzing" — never completes
**Cause A**: Firecrawl job is still running (15-minute timeout not reached).  
**Action**: Wait. Deep crawl can take up to 15 minutes for complex sites.

**Cause B**: Firecrawl job completed but our poll logic failed.  
**Debug**:
1. Get the crawl ID from logs: `stage:"firecrawl.crawlSiteUrl" message:"crawl job started"`
2. Go to Firecrawl dashboard and check the job status
3. Check server logs for errors after the crawl completed

**Cause C**: Unhandled exception after crawl.  
**Debug**: Search logs for `stage:"pipeline.deepCrawl" level:"error"`  
**Fix**: Check what stage failed, fix the code, restart.

---

### Deep crawl returns 0 pages (site blocks crawlers)
**Expected behavior**: The system now automatically runs web search supplement.

**If supplement also returns 0 pages**:
- The site is extremely protected (rare)
- User should be shown: "This website blocks automated analysis. Try a different website."
- Credits should be refunded

**Check if supplement ran**: Look in logs for `stage:"firecrawl.searchWeb"`

---

### Smart crawl finds wrong pages (irrelevant content)
**Cause**: Page scoring algorithm selected low-value pages.

**Debug**: Check `selectRelevantPages()` in `lib/integrations/firecrawl/service.ts`

**Fix**: Adjust scores in `scorePageUrl()` — increase points for content types you want, decrease for ones you don't.

---

## AI Pipeline Errors

### Pipeline produces empty/garbage specification
**Cause A**: AI model returned invalid JSON.  
**Status**: Should be handled by sanitizer — check if `specSanitized: true` on the project.

**Cause B**: AI model was too short in its response (truncated).  
**Fix**: Try a different model with larger context window. Edit `PLANNER_MODEL` in `.env.local`.

**Cause C**: Prompt is poorly structured for this website type.  
**Debug**: Check `planning_runs` in MongoDB for the project. Look at the `stageResults.planning` entry — what did the model actually return?

---

### "Research stage failed, continuing with empty findings" (in logs)
**Status**: This is NORMAL and EXPECTED. Not an error.  
**Action**: None needed. Pipeline continues successfully without research data.

---

### "Specification failed semantic validation"
**Cause**: AI produced inconsistent data (referenced a component that doesn't exist, etc.)

**Status**: Should be non-blocking now (logs warning only, pipeline continues).

**If it's blocking**: Check `lib/planning/orchestrator.ts` around the validator section — ensure the `throw` is inside a try/catch.

---

### AI model returns "RESOURCE_EXHAUSTED" or "quota exceeded"
**Cause**: Free model tier limit hit on OpenRouter.

**Fix**:
1. Switch to a different free model: go to https://openrouter.ai/models, filter "free"
2. Update `PLANNER_MODEL` in `.env.local`
3. Restart dev server

---

### Pipeline stuck at "analyzing" with no log output
**Cause**: The async pipeline function was called but something swallowed the promise/error.

**Debug**:
1. Check `planning_runs` collection — is there a run record for this project?
2. Check `projects` collection — when was `updatedAt` last changed?
3. Search logs for the projectId

**Fix**: May need to add more try/catch blocks or console.log statements to isolate.

---

## Payment / Billing Errors

### Webhook not received (payments not processing)
**Cause A**: Webhook URL not configured in Dodo dashboard.  
**Fix**: Go to Dodo dashboard → Webhooks → set URL to `https://mirrorsite.atai.ink/api/billing/webhook`

**Cause B**: Wrong `DODO_PAYMENTS_WEBHOOK_KEY`.  
**Fix**: Copy the webhook signing key from Dodo dashboard → paste into `.env.local`

**Cause C**: Local dev can't receive webhooks (localhost not publicly accessible).  
**Fix**: Use ngrok or Vercel dev for webhook testing:
```powershell
# Install ngrok, then:
ngrok http 3000
# Copy the https URL, set it as your webhook URL in Dodo dashboard
```

---

### "Payment succeeded but credits not granted"
**Cause**: Webhook was received but processing failed.

**Debug**:
1. Go to admin panel → `/admin/billing/webhooks`
2. Find the webhook event
3. Check `status` — is it "failed" or "processed"?
4. If "failed", check the error message

**Fix**: Admin can manually grant credits from `/admin/users`.

---

### Credits deducted but operation failed (user wants refund)
**Cause**: The refund transaction didn't execute (rare).

**Fix**:
1. Admin goes to `/admin/users` → select user → grant credits manually
2. Check `credit_ledger` to see what was charged
3. Grant equivalent credits as compensation

---

### "Insufficient credits" but user shows credits in UI
**Cause A**: `users.credits` in MongoDB is out of sync with actual ledger.  
**Debug**: Sum all `credit_ledger` entries for user and compare to `users.credits`.

**Cause B**: Credits are subscription type and they expired.  
**Debug**: Check `users.creditBuckets` — look for buckets with `expiresAt` in the past.

**Fix**: Admin grants permanent credits to compensate.

---

## UI / Frontend Errors

### Dashboard shows blank page / crashes
**Cause**: JavaScript error, usually a data shape mismatch.

**Debug**: Open browser DevTools → Console — look for red errors.

**Fix**: The error message usually says exactly what's null or undefined.

---

### Project stays on "analyzing" in UI forever (doesn't update)
**Cause**: The polling loop for `GET /api/projects/{id}/status` stopped.

**Debug**: Open DevTools → Network tab → look for status requests. Are they happening every 2 seconds?

**Fix**: 
- Hard refresh the page
- If still broken: check the status API endpoint

---

### Credits not updating after purchase
**Cause**: UI is cached with old credit value.

**Fix**: Hard refresh (Ctrl+Shift+R). If still wrong, check MongoDB `users.credits` for the user.

---

### "Something went wrong" error with no details
**Cause**: The API returned a 500 error that was caught generically.

**Debug**:
1. Open DevTools → Network tab
2. Find the failed request
3. Look at the response body — there's usually more detail
4. Check server logs for the same timestamp

---

## Vercel Deployment Errors

### Build fails: "Type error"
**Fix**: Run `npm run build` locally, fix all TypeScript errors, then push again.

### Build fails: "Module not found"
**Cause**: A file was deleted or renamed but imports weren't updated.  
**Fix**: Fix the import, commit, push.

### Build succeeds but app crashes in production
**Cause**: Missing environment variable in Vercel.

**Fix**:
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add the missing variable
3. Redeploy (trigger from Vercel dashboard or push a new commit)

### Deployment takes too long
**Cause**: Normal — Vercel builds typically take 1-3 minutes.  
**Action**: Wait. If >10 minutes, check Vercel status at https://vercel.com/status

---

## Quick Diagnostic Checklist

When something breaks and you don't know where to start:

1. **Check browser DevTools console** — any red errors?
2. **Check Network tab** — which API call is failing? What's the response?
3. **Check Vercel logs** — filter by error level, look at timestamps
4. **Check MongoDB** — is the data what you expect?
5. **Run `npm run build`** — any TypeScript errors?
6. **Restart dev server** — sometimes fixes weird state issues
7. **Check env vars** — is the relevant API key present and valid?
8. **Check external service status** — Firecrawl/OpenRouter/MongoDB Atlas may be down

---

## Getting Help

If none of the above fixes your issue:

1. **Search the codebase** for the error message (may have a comment explaining it)
2. **Check git log** — maybe a recent commit broke something (`git log --oneline`)
3. **Check the relevant external service docs** (Firecrawl, OpenRouter, Dodo, MongoDB)
4. **Ask Kiro (AI assistant)** — paste the error and the relevant code, ask for help

---

**Related**: `DEVELOPMENT_SETUP.md` for environment setup, `AI_PIPELINE.md` for pipeline debugging
