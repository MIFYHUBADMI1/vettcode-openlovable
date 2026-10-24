# Bugfix Requirements Document

## Introduction

After completing authentication (email/password login, registration, Google OAuth, or GitHub OAuth), users always see the error "We signed you in, but couldn't load your session. Please try again." and cannot access the application. The server-side auth succeeds and a session record is written to the database, but the session cookie is silently discarded by the browser because it is flagged `Secure` while being delivered over plain HTTP (localhost in development). The subsequent `/api/me` call finds no cookie, returns 401, and `refreshSessionAfterAuth` throws the error. No server-side errors appear in the terminal because the failure is a silent browser cookie rejection.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user completes email/password login on an HTTP origin (e.g. `http://localhost:3000`) THEN the system creates a session in the database and calls `setSessionCookie`, but the browser silently drops the cookie because `Secure: true` is set unconditionally, resulting in no session cookie being stored.

1.2 WHEN a user completes account registration on an HTTP origin THEN the system writes the user record and session to the database and calls `setSessionCookie`, but the cookie is discarded by the browser for the same reason, leaving the user with no active session.

1.3 WHEN a user completes Google or GitHub OAuth on an HTTP origin THEN the OAuth callback creates a session and calls `setSessionCookie`, but the `Secure` flag causes the browser to discard the cookie over HTTP, preventing the session from persisting.

1.4 WHEN `fetchSession` is called immediately after any of the above auth flows THEN `GET /api/me` receives no session cookie, `requireUser` throws `UNAUTHORIZED`, `session?.user` is `null`, and `refreshSessionAfterAuth` throws "We signed you in, but couldn't load your session. Please try again."

### Expected Behavior (Correct)

2.1 WHEN a user completes email/password login on an HTTP origin (e.g. `http://localhost:3000`) THEN the system SHALL set the session cookie without the `Secure` flag so the browser stores it, and `fetchSession` SHALL subsequently resolve a valid session.

2.2 WHEN a user completes account registration on an HTTP origin THEN the system SHALL set the session cookie without the `Secure` flag so the browser stores it, and the user SHALL be granted access to the application.

2.3 WHEN a user completes Google or GitHub OAuth on an HTTP origin THEN the OAuth callback SHALL set the session cookie without the `Secure` flag so the browser stores it, and the post-redirect page SHALL load with an authenticated session.

2.4 WHEN a user completes any authentication flow on an HTTPS origin (production) THEN the system SHALL CONTINUE TO set `Secure: true` on the session cookie to maintain security in production environments.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user authenticates on the production HTTPS origin (`https://mirrorsite.atai.ink` or any `*.atai.ink` host) THEN the system SHALL CONTINUE TO set the session cookie with `Secure: true` and the `.atai.ink` domain attribute so cross-subdomain session sharing is preserved.

3.2 WHEN a valid session cookie is present on any origin THEN the system SHALL CONTINUE TO authenticate API requests via `requireUser` without any change to session lookup, token hashing, or TTL behavior.

3.3 WHEN a user logs out THEN the system SHALL CONTINUE TO delete the session record from the database and clear the session cookie, regardless of whether the `Secure` flag was used when the cookie was originally set.

3.4 WHEN rate limiting, account banning, or suspension checks apply during login or registration THEN the system SHALL CONTINUE TO enforce those checks before any session or cookie is created.
