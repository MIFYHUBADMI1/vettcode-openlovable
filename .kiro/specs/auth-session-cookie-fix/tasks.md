# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - HTTP Origin Cookie Secure Flag
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: `NEXT_PUBLIC_APP_URL` is unset or an HTTP URL while `setSessionCookie` is called
  - Create `lib/auth/__tests__/session.test.ts` (or add to an existing test file for `session.ts`)
  - Mock `next/headers` so `cookies()` returns a spy that captures the options passed to `jar.set`
  - Test case 1: set `NEXT_PUBLIC_APP_URL=http://localhost:3000`, call `setSessionCookie("tok")`, assert captured options have `secure: false` — will FAIL on unfixed code because value is hardcoded `true`
  - Test case 2: unset `NEXT_PUBLIC_APP_URL` entirely, call `setSessionCookie("tok")`, assert `secure: false` — will FAIL on unfixed code
  - Test case 3: set `NEXT_PUBLIC_APP_URL=""`, call `setSessionCookie("tok")`, assert `secure: false` — will FAIL on unfixed code
  - Run the test suite on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bug exists)
  - Document counterexamples found, e.g. "`secure` is `true` even when `NEXT_PUBLIC_APP_URL` is `http://localhost:3000`; root cause: literal `true` on line ~73 of `lib/auth/session.ts`"
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - HTTPS Origin Retains Secure Flag
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: on UNFIXED code with `NEXT_PUBLIC_APP_URL=https://mirrorsite.atai.ink`, `setSessionCookie` sets `secure: true` — this is the baseline to preserve
  - Observe: on UNFIXED code with `NEXT_PUBLIC_APP_URL=https://developers.atai.ink`, same result
  - Write property-based test: for all `appUrl` values that start with `https://`, captured cookie options SHALL have `secure: true`, `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `maxAge: SESSION_TTL_MS / 1000` unchanged
  - Use a PBT library (e.g. fast-check) to generate random `https://` URLs and assert `secure: true` for each
  - Also assert that `domain` is `".atai.ink"` for any `atai.ink` or `*.atai.ink` HTTPS URL (preserves cross-subdomain behavior from `sessionCookieDomain`)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline production behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.4, 3.1, 3.2_

- [ ] 3. Fix — make session cookie `Secure` flag conditional on origin

  - [ ] 3.1 Add `isSecureOrigin` helper and update `setSessionCookie`
    - Open `lib/auth/session.ts`
    - Add the following helper directly below the existing `sessionCookieDomain` function:
      ```ts
      function isSecureOrigin(): boolean {
        return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://")
      }
      ```
    - In `setSessionCookie`, replace `secure: true` with `secure: isSecureOrigin()`
    - No other changes to the file — all other functions remain untouched
    - _Bug_Condition: isBugCondition(request) where `NEXT_PUBLIC_APP_URL` does NOT start with `https://` and `setSessionCookie` is called with hardcoded `secure: true`_
    - _Expected_Behavior: `setSessionCookie` sets `secure: false` (or omits the flag) when origin is HTTP, so the browser stores the cookie and a subsequent `/api/me` returns the authenticated user_
    - _Preservation: `Secure: true` MUST continue on HTTPS origins; `sessionCookieDomain` domain scoping, `httpOnly`, `sameSite`, `path`, `maxAge`, session lookup/TTL/revocation all unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - HTTP Origin Cookie Secure Flag
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior (HTTP origin → `secure: false`)
    - Re-run the test file created in task 1 against the fixed code
    - **EXPECTED OUTCOME**: Tests PASS (confirms the bug is fixed — browser will now store the session cookie on HTTP origins)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - HTTPS Origin Retains Secure Flag
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from task 2 against the fixed code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — production HTTPS behavior is unchanged)
    - Confirm `secure: true` for all HTTPS origins, domain scoping intact, all other cookie options identical

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite for `lib/auth/session.ts`
  - Ensure Property 1 (bug condition) and Property 2 (preservation) both pass
  - Verify no TypeScript errors are introduced (`tsc --noEmit`)
  - Ask the user if any questions arise before closing the spec
