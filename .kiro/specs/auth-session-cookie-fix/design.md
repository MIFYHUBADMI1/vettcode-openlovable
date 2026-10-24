# Auth Session Cookie Secure Flag Bugfix Design

## Overview

After any auth flow (email/password login, registration, Google OAuth, GitHub OAuth) on an HTTP
origin (localhost), the browser silently drops the session cookie because `setSessionCookie` in
`lib/auth/session.ts` sets `secure: true` unconditionally. The subsequent `/api/me` call receives
no cookie, returns 401, and the UI shows "We signed you in, but couldn't load your session. Please
try again." The fix is minimal: make the `Secure` flag conditional on the request origin being
HTTPS, using `NEXT_PUBLIC_APP_URL` as the production/development discriminator.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — `setSessionCookie` is called on an
  HTTP origin while `secure: true` is set unconditionally.
- **Property (P)**: The desired behavior when the bug condition holds — the session cookie is set
  without the `Secure` flag so the browser stores it.
- **Preservation**: The production behavior that must remain unchanged — `Secure: true` on HTTPS
  origins, domain scoping to `.atai.ink`, session lookup/TTL/revocation all unaffected.
- **`setSessionCookie`**: The function in `lib/auth/session.ts` that writes the `Atai_session`
  cookie; the only change target.
- **`sessionCookieDomain`**: The helper in the same file that resolves the cookie's `Domain`
  attribute based on `NEXT_PUBLIC_APP_URL`.
- **`NEXT_PUBLIC_APP_URL`**: The env var set to the canonical origin (`https://mirrorsite.atai.ink`
  in production, `http://localhost:3000` in development via `.env.local`). Used to detect HTTPS.
- **`isSecureOrigin`**: The new helper function to be introduced that returns `true` when
  `NEXT_PUBLIC_APP_URL` starts with `https://`.

## Bug Details

### Bug Condition

The bug manifests when `setSessionCookie` is called during any auth completion handler while the
current origin is HTTP (i.e. localhost development). The hardcoded `secure: true` option causes
the browser to silently reject the `Set-Cookie` response header, leaving no session cookie.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request — the HTTP request context at the time setSessionCookie is called
  OUTPUT: boolean

  appUrl := process.env.NEXT_PUBLIC_APP_URL ?? ""
  originIsHttp := NOT appUrl.startsWith("https://")

  RETURN originIsHttp
         AND setSessionCookie is called with hardcoded secure: true
END FUNCTION
```

### Examples

- **Login on localhost**: User submits email + password at `http://localhost:3000/sign-in`. Server
  creates session in MongoDB and calls `setSessionCookie`. Browser receives `Set-Cookie:
  Atai_session=…; Secure` but the connection is HTTP — cookie is dropped. `/api/me` returns 401.
  **Expected**: cookie is set without `Secure`; `/api/me` returns the authenticated user.

- **Registration on localhost**: User completes sign-up form. Same `setSessionCookie` path. Cookie
  dropped. User sees error immediately after account creation. **Expected**: cookie stored, user
  lands on dashboard.

- **Google OAuth callback on localhost**: After consent, `/api/auth/google/callback` fires,
  creates session, calls `setSessionCookie`. Cookie dropped. Post-redirect page shows error.
  **Expected**: cookie stored, authenticated redirect succeeds.

- **GitHub OAuth callback on localhost**: Same pattern as Google. **Expected**: same fix applies.

- **Login on production HTTPS**: `NEXT_PUBLIC_APP_URL=https://mirrorsite.atai.ink`. Bug condition
  does NOT hold. `secure: true` is correct and must stay.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `Secure: true` MUST continue to be set on any HTTPS origin (production).
- The `.atai.ink` domain cookie attribute MUST continue to be set exactly as `sessionCookieDomain`
  computes it.
- Session lookup, token hashing, TTL (30 days), and per-session/bulk revocation are untouched.
- Rate limiting, account suspension, and ban checks applied before session creation are untouched.
- `clearSessionCookie` / `destroyCurrentSession` / `destroyAllSessionsForUser` are untouched.

**Scope:**
All inputs that do NOT involve `setSessionCookie` being called over an HTTP origin are completely
unaffected by this fix. This includes:
- Any production HTTPS request.
- All cookie-reading paths (`getSessionToken`, `getCurrentUser`, `requireUser`).
- All session-deletion paths (`clearSessionCookie`, `destroyCurrentSession`).
- Non-cookie auth checks (admin guard, rate limiting).

## Hypothesized Root Cause

Based on the bug description and code inspection, the cause is confirmed and singular:

1. **Hardcoded `secure: true` in `setSessionCookie`**: Line ~73 of `lib/auth/session.ts` passes
   `secure: true` unconditionally. The `Secure` attribute tells the browser to only send (and
   store) the cookie over HTTPS. On `http://localhost`, every browser (Chrome, Firefox, Safari)
   silently ignores the `Set-Cookie` header when `Secure` is present. No error is surfaced — the
   cookie is simply not stored.

2. **`NEXT_PUBLIC_APP_URL` is already set correctly in `.env.local`** to
   `https://mirrorsite.atai.ink` (production value), but localhost traffic itself arrives over
   `http://`. The env var reflects the canonical app URL, not the current request origin — this
   makes it the right discriminator: if the canonical URL is HTTPS, production security applies;
   if it is HTTP (or absent), the development path applies.

3. **`sessionCookieDomain` already uses the same pattern**: it reads `NEXT_PUBLIC_APP_URL` to
   decide whether to set `domain: ".atai.ink"`. The `secure` flag should follow the same
   conditional logic.

4. **No other code path is involved**: The error message "couldn't load your session" originates
   entirely from the missing cookie. The DB session record is created successfully; the only
   failure is cookie delivery.

## Correctness Properties

Property 1: Bug Condition — HTTP Origin Receives Cookie Without Secure Flag

_For any_ call to `setSessionCookie` where `NEXT_PUBLIC_APP_URL` does NOT start with `https://`
(i.e. the development / HTTP origin case), the fixed `setSessionCookie` SHALL set the session
cookie with `secure: false` (or the `secure` option omitted), ensuring the browser stores the
cookie and a subsequent `GET /api/me` call returns a valid authenticated session.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — HTTPS Origin Retains Secure Flag

_For any_ call to `setSessionCookie` where `NEXT_PUBLIC_APP_URL` starts with `https://`, the
fixed `setSessionCookie` SHALL produce a cookie identical to the original implementation
(i.e. `secure: true`, same domain, same path, same TTL), preserving production security and
cross-subdomain session behavior.

**Validates: Requirements 2.4, 3.1**

## Fix Implementation

### Changes Required

**File**: `lib/auth/session.ts`

**Function**: `setSessionCookie`

**Specific Changes**:

1. **Add `isSecureOrigin` helper** (alongside the existing `sessionCookieDomain` helper):
   ```ts
   function isSecureOrigin(): boolean {
     return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://")
   }
   ```

2. **Update `setSessionCookie` to use the helper**:
   ```ts
   export async function setSessionCookie(token: string): Promise<void> {
     const jar = await cookies()
     jar.set(COOKIE, token, {
       httpOnly: true,
       sameSite: "lax",
       secure: isSecureOrigin(),   // <-- was: secure: true
       path: "/",
       domain: sessionCookieDomain(),
       maxAge: SESSION_TTL_MS / 1000,
     })
   }
   ```

3. **No other changes**: All other functions in `session.ts` and all callers of `setSessionCookie`
   are untouched. The change is fully self-contained.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples demonstrating
the bug on unfixed code, then verify the fix works correctly and preserves production behavior.
Because the bug is a pure environment-variable conditional on a single line, unit tests covering
both branches are sufficient; property-based testing is used for preservation to enumerate the
full range of `NEXT_PUBLIC_APP_URL` values.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm
the root cause analysis (hardcoded `secure: true`).

**Test Plan**: Write a unit test that calls `setSessionCookie` with `NEXT_PUBLIC_APP_URL` unset or
set to `http://localhost:3000`, then asserts that the cookie was set with `secure: false`. Run on
UNFIXED code — the test will fail because `secure: true` is hardcoded, proving the bug.

**Test Cases**:
1. **HTTP origin test**: Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`, call
   `setSessionCookie("test-token")`, assert cookie options contain `secure: false` (will fail on
   unfixed code).
2. **Undefined URL test**: Unset `NEXT_PUBLIC_APP_URL`, call `setSessionCookie("test-token")`,
   assert `secure: false` (will fail on unfixed code — hardcoded `true`).
3. **Cookie actually stored test**: Simulate a full login on an HTTP mock request, then call
   `getSessionToken`, assert it returns the token (will fail on unfixed code).
4. **Edge case — empty string URL**: Set `NEXT_PUBLIC_APP_URL=""`, assert `secure: false` (may
   fail on unfixed code).

**Expected Counterexamples**:
- `secure` option is `true` even when `NEXT_PUBLIC_APP_URL` is an HTTP URL.
- Root cause confirmed: the value is a literal `true`, not computed from any env var.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function sets
`secure: false`.

**Pseudocode:**
```
FOR ALL appUrl WHERE NOT appUrl.startsWith("https://") DO
  process.env.NEXT_PUBLIC_APP_URL := appUrl
  result := capturedCookieOptions(setSessionCookie("token"))
  ASSERT result.secure === false
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function
produces a cookie identical to the original — in particular `secure: true`.

**Pseudocode:**
```
FOR ALL appUrl WHERE appUrl.startsWith("https://") DO
  process.env.NEXT_PUBLIC_APP_URL := appUrl
  result := capturedCookieOptions(setSessionCookie("token"))
  ASSERT result.secure === true
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It automatically generates many HTTPS URL variants (`https://mirrorsite.atai.ink`,
  `https://sub.atai.ink`, `https://example.com`, etc.).
- It catches edge cases such as `https://` with unusual ports or paths.
- It provides strong guarantees that `secure: true` is set for every possible HTTPS origin,
  not just the one hardcoded in `.env.local`.

**Test Plan**: Observe that the current code always sets `secure: true` (baseline), then after the
fix confirm the same result holds for all HTTPS URLs.

**Test Cases**:
1. **Production URL preservation**: `NEXT_PUBLIC_APP_URL=https://mirrorsite.atai.ink` → assert
   `secure: true` and `domain: ".atai.ink"` unchanged.
2. **Subdomain URL preservation**: `NEXT_PUBLIC_APP_URL=https://developers.atai.ink` → assert
   `secure: true`.
3. **Arbitrary HTTPS URL preservation**: Property test generates random `https://` URLs → all
   assert `secure: true`.
4. **Other cookie options unchanged**: For any URL, assert `httpOnly`, `sameSite`, `path`, and
   `maxAge` values are identical before and after the fix.

### Unit Tests

- Test `isSecureOrigin()` returns `false` when `NEXT_PUBLIC_APP_URL` is unset.
- Test `isSecureOrigin()` returns `false` when `NEXT_PUBLIC_APP_URL` is `http://localhost:3000`.
- Test `isSecureOrigin()` returns `true` when `NEXT_PUBLIC_APP_URL` is
  `https://mirrorsite.atai.ink`.
- Test `setSessionCookie` calls `cookies().set` with `secure: false` on HTTP origin.
- Test `setSessionCookie` calls `cookies().set` with `secure: true` on HTTPS origin.
- Test that all other cookie options (`httpOnly: true`, `sameSite: "lax"`, `path: "/"`,
  `maxAge: SESSION_TTL_MS / 1000`) are unchanged in both branches.

### Property-Based Tests

- Generate random HTTP URL strings (`http://...`) and assert `isSecureOrigin()` is always `false`.
- Generate random HTTPS URL strings (`https://...`) and assert `isSecureOrigin()` is always
  `true`.
- Generate random `NEXT_PUBLIC_APP_URL` values and assert `setSessionCookie` options match the
  expected `secure` value for each case (no mixed/undefined states).

### Integration Tests

- Full login flow on mocked HTTP origin: complete auth → assert session cookie present with
  correct options → assert `/api/me` returns user.
- Full login flow on mocked HTTPS origin: assert `Secure` flag is present in the cookie.
- Logout flow: assert cookie cleared regardless of which `secure` branch was used at login time.
- Google/GitHub OAuth callback with HTTP origin: assert session cookie is stored and readable.
