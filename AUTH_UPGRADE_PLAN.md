# Auth Upgrade Plan: Supabase Auth with Email Verification

## Overview

The current system issues JWTs from the FastAPI backend. The new system uses Supabase Auth to manage identities, email verification, and password reset. The backend stops issuing tokens and instead verifies Supabase-issued JWTs on every request.

**Decisions:**
- Club password entry point is kept — members still enter a shared club password to join
- Email verification is required before a member can log in
- Supabase Auth handles identity, email verification, and password reset

---

## Authorization Model

This migration touches authentication and authorization. Keep these boundaries explicit to prevent future drift.

**Supabase owns:**
- Identity (who you are)
- Login / logout
- Password reset
- Email verification
- Session lifecycle

**Backend owns:**
- Clubs, memberships, roles
- Permission rules
- All domain logic and authorization decisions

The backend is the source of truth. The frontend should never trust locally cached role or membership state — always fetch current permissions from backend APIs on each session. Even when the frontend hides admin UI, the backend must always verify admin role server-side on every protected operation (invites, membership removal, poll creation/deletion, meeting confirmation, etc.).

---

## Auth States

All possible states a user can be in:

| State | Meaning |
|---|---|
| Anonymous | Not logged in |
| Pending Verification | Supabase account created but email not yet confirmed |
| Authenticated | Valid Supabase session, email verified |
| Member | Authenticated + has at least one club membership |
| Admin | Member with elevated club-level permissions |
| Suspended | Membership explicitly disabled |

The frontend should explicitly handle every state — no assumptions.

**Suspended user semantics:** A suspended user can still authenticate with Supabase (identity is valid) but is denied club membership access by the backend. Suspension is per-club — a user can be suspended from one club while remaining active in another. The backend checks suspension status on every request, not just at login.

---

## Key Flows (Sequence Diagrams)

### New user signup

```
User                  Frontend              Backend               Supabase Auth
 |                       |                     |                       |
 |-- enter club pw ----->|                     |                       |
 |                       |-- POST /auth/enter ->|                      |
 |                       |<-- reg_token --------|                      |
 |                       |                     |                       |
 |-- email+pw+name ----->|                     |                       |
 |                       |-- signUp(email,pw) ------------------------>|
 |                       |                     |                  send verify email
 |                       |<-- pending session -------------------------|
 |<-- "check email" -----|                     |                       |
 |                       |                     |                       |
 |-- clicks verify link -+---------------------------------------------+
 |                       |                     |              confirm email
 |                       |<-- verified session ------------------------|
 |                       |-- POST /auth/provision (reg_token+JWT) ->|  |
 |                       |                     |-- create User+Membership
 |                       |<-- membership info --|                      |
 |<-- app loads ---------|                     |                       |
```

### Existing user login

```
User                  Frontend              Backend               Supabase Auth
 |                       |                     |                       |
 |-- email + password -->|                     |                       |
 |                       |-- signInWithPassword(email,pw) ------------>|
 |                       |<-- session (JWT) ---------------------------|
 |                       |-- GET /clubs (Bearer JWT) ->|               |
 |                       |                     |-- verify JWT          |
 |                       |                     |-- lookup supabase_uid |
 |                       |<-- membership info --|                      |
 |<-- app loads ---------|                     |                       |
```

### Admin invite flow

```
Admin                 Frontend              Backend               Supabase Auth
 |                       |                     |                       |
 |-- enter email+name -->|                     |                       |
 |                       |-- POST /clubs/{id}/members (admin JWT) ->|  |
 |                       |                     |-- create pending_membership
 |                       |                     |-- Admin SDK: invite user ----->|
 |                       |                     |                  send invite email
 |                       |<-- ok ---------------|                      |
 |                       |                     |                       |
 [later: invitee opens email]
 |                       |                     |                       |
 Invitee -- clicks link -+---------------------------------------------+
 |                       |                     |              set password, verify
 |                       |<-- verified session ------------------------|
 |                       |-- POST /auth/provision (JWT) ---------->|   |
 |                       |                     |-- find pending_membership
 |                       |                     |-- create User+Membership
 |                       |<-- membership info --|                      |
 |<-- app loads ---------|                     |                       |
```

---

## Phase 1 — Database changes

- Add `email` (unique, required, lowercased) column to the `users` table
- Add `supabase_uid` (UUID, unique, nullable) column to the `users` table
- Add `auth_migration_status` enum column with values: `legacy`, `pending_verification`, `supabase_active`, `disabled`
- Make `password_hash` nullable — existing users keep their hash during the migration period; removed in Phase 5
- Add `pending_memberships` table: `(email, club_id, invited_by, created_at, expires_at)` — unique on `(email, club_id)`
- Add unique constraint on `(club_id, user_id)` in `club_memberships` to enforce idempotency at the DB level

The `auth_migration_status` field makes migration state explicit and observable, rather than inferring it from `supabase_uid IS NULL`.

---

## Phase 2 — Backend auth layer

### Token validation rules

When verifying a Supabase JWT, explicitly validate all of the following:

- `iss` (issuer) — must match your Supabase project URL
- `aud` (audience) — must be `authenticated`
- `exp` (expiration) — must not be in the past; allow a small clock skew leeway of 30–60 seconds to tolerate minor server time drift
- Signature — verified against the JWT secret
- `email_confirmed_at` — must not be null; reject with 403 if missing

**Note on JWT secret vs JWKS:** Using `SUPABASE_JWT_SECRET` directly is acceptable to start. Long-term, prefer validating against Supabase's JWKS endpoint (`{SUPABASE_URL}/.well-known/jwks.json`) so that key rotation is handled automatically without env var changes.

### Replace custom JWT with Supabase JWT verification

- Add `SUPABASE_JWT_SECRET` to env vars (Supabase → Settings → API)
- Rewrite `get_current_membership` in `auth.py` to verify incoming tokens using Supabase's JWT secret
- Look up the user in our DB by `supabase_uid` (extracted from the verified token)
- Reject with 403 if `email_confirmed_at` is null

### Registration token security

The club password validation returns a short-lived registration token. This token is security-sensitive — it gates which club a new user joins.

Token requirements:
- Signed server-side (HMAC or similar)
- Contains `club_id` in the payload
- Expires after 15 minutes
- Single-use — mark as consumed after `/auth/provision` accepts it
- Never stored client-side beyond the active registration session

### /auth/provision endpoint — idempotency rules

This endpoint must be safely repeatable. Users can refresh the page, Supabase can retry callbacks, and multiple browser tabs can race. Without idempotency guarantees, repeated calls can create duplicate users or memberships.

Rules:
- If a `User` with this `supabase_uid` already exists, return the existing record — do not create a duplicate
- If a `ClubMembership` for this `(user_id, club_id)` already exists, return it — do not create a duplicate
- If the `pending_memberships` record has already been consumed, proceed without error
- All writes (create user, create membership, mark invite consumed, update migration status) must happen inside a single DB transaction — a partial failure must leave no state behind
- The DB-level unique constraints on `supabase_uid`, `email`, and `(club_id, user_id)` are the last line of defense; application logic should handle duplicates gracefully before hitting them

### Update admin "add member"

- Remove the password field from the add-member form
- Admin provides email + display name → backend calls Supabase Admin SDK to send an invite email → creates a `pending_memberships` record → user clicks link, sets their own password → `/auth/provision` activates the membership
- Sending an invite for an email that already has a pending invite for the same club is idempotent (resend, do not duplicate)

### Password policy

Configure explicitly in Supabase → Auth → Password Settings before launch — do not leave as defaults:

- **Minimum length:** 8 characters minimum; 12 is better for a private app
- **Complexity:** Consider requiring at least one number or symbol
- **Breach detection:** Supabase supports HaveIBeenPwned integration — enable it to block known compromised passwords

### Rate limiting and abuse protection

- Rate limit the club password validation endpoint (e.g. 10 attempts per IP per minute)
- Rate limit `/auth/provision` per IP and per `supabase_uid`
- Signup throttling to prevent mass account creation
- Verify Supabase's built-in auth rate limits are not disabled in project settings

### Email normalization

Before storing or comparing any email:
- Lowercase the entire address
- Trim leading/trailing whitespace

Apply this on both frontend and backend. `supabase_uid` is the real identity key — email is mutable and must never be used as a primary identity linkage after provisioning.

### Email change reconciliation

If a user changes their email in Supabase, the `email` column in your `users` table can become stale. Sync strategy:
- On every verified request to the backend, compare the email in the JWT to the stored email
- If they differ, update the stored email automatically
- Never use email for identity lookups after provisioning — always use `supabase_uid`

### First admin creation

Define the bootstrap procedure for:
- A new production environment (avoid "manual DB edit required")
- A new club (who is the first admin and how are they designated)

Recommended: a one-time setup endpoint or CLI script that creates the initial admin account, gated by a `SETUP_TOKEN` env var, disabled after first use.

---

## Phase 3 — Frontend auth layer

- Install `@supabase/supabase-js` and initialize the Supabase client with the public anon key
- **Never expose the Supabase service role key on the frontend** — it belongs only in backend env vars
- **`AuthContext`** — replace custom JWT storage with `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()`
- **`api/client.ts`** — replace `localStorage.getItem("token")` with the live Supabase session token on each request
- **`EntryPage`** — update the login form: email replaces username; call `supabase.auth.signInWithPassword()` instead of the backend `/auth/enter` endpoint
- **Registration step** — after the club password is validated, show email + display name + password form; call `supabase.auth.signUp()` then show "check your email" screen
- Add a "Resend verification email" button on the pending verification screen
- Add a "Forgot password" link that calls `supabase.auth.resetPasswordForEmail()`

### Session and loading states

Explicit frontend states to avoid flashing screens and race conditions:

- **Auth loading** — session check in progress; show a spinner, render nothing else
- **Unauthenticated** — show login screen
- **Pending verification** — show "check your email" screen with resend option
- **Authenticated, no membership** — show club password entry or error
- **Authenticated + member** — show the app
- **Suspended** — show a clear "your access has been suspended" message

### Session duration

Supabase defaults to 1-hour access tokens and 60-day refresh tokens. Decide these consciously:

- **Access token lifetime (1 hour default):** Fine for this app — short enough to limit exposure if a token is leaked, long enough that users aren't re-prompted constantly
- **Refresh token lifetime (60 days default):** This is the real "stay logged in" duration; 60 days is reasonable for a private club app but should be a deliberate choice, not a default
- Configure in Supabase → Auth → Settings → JWT expiry

### Session lifecycle

- Supabase client auto-refreshes tokens — no manual handling needed
- On refresh failure (expired refresh token), redirect to login and clear all cached app state
- On logout (`supabase.auth.signOut()`), clear all local state and redirect to login
- Sync auth state across browser tabs via `onAuthStateChange` — if the user logs out in one tab, all tabs should redirect
- Do not store any sensitive membership or role data outside of auth state; re-fetch from the backend on session restore

### CSRF and XSS

Using bearer tokens (no cookies) significantly reduces CSRF risk. Key frontend rules:
- Do not inject unsanitized HTML anywhere in the app
- Do not store sensitive metadata outside of the Supabase auth session object
- Do not expose the service role key anywhere client-side — not in env vars bundled into the frontend, not in API responses

---

## Phase 4 — Migrate existing members

### Rollout strategy

Rather than switching all users at once, use a staged rollout:
1. Enable the new auth path for admins only first
2. Opt-in beta for willing members
3. Full rollout with a migration deadline

A backend env flag (`AUTH_MODE=dual|supabase_only`) controls whether the legacy fallback is active.

### Migration steps

- Set `auth_migration_status = 'legacy'` for all existing users on deploy
- Admin triggers "send password reset email" for each existing user via the Supabase dashboard or a migration script
- When a user completes a password reset through Supabase, their next request to the backend carries a valid Supabase JWT; the backend writes their `supabase_uid` and sets `auth_migration_status = 'supabase_active'`
- Until a user migrates, the backend falls back to `password_hash` check when `auth_migration_status = 'legacy'`

**Existing users without emails:** The admin must supply an email for any user record missing one before triggering their migration.

**Preventing duplicate emails:** Before creating a Supabase account for an existing user, verify the email is not already registered in Supabase Auth.

### Transition UX for legacy users

During Phase 4, some users are on the old system and some are on Supabase. The login screen needs to handle both without confusing either group:

- The login form should accept email (not username) — legacy users who don't know their email should contact the admin
- Show a banner or tooltip on the login screen: "Haven't migrated yet? Check your email for a password reset link"
- If a legacy user enters their email and it doesn't exist in Supabase yet, show a specific message: "Your account hasn't been migrated — check your email or contact the admin"
- Do not silently fall back to legacy auth from the same login form — make the migration path explicit so users know what's happening

---

## Phase 5 — Cleanup

Once all users have `auth_migration_status = 'supabase_active'` and the rollback window has passed:

- Remove `password_hash` column from the DB
- Remove `auth_migration_status` column (or retain as an audit field)
- Remove `hash_password`, `verify_password`, and `create_user_token` from `auth.py`
- Remove the password field from all admin member-creation forms
- Disable the legacy auth fallback path entirely

---

## Multi-club identity

One Supabase identity maps to many club memberships. Key rules:

- The same email joining a second club reuses the existing `User` record — `/auth/provision` finds the existing user by `supabase_uid` and only creates the new `ClubMembership`
- Accepting an invite to a second club follows the same `/auth/provision` flow; if already provisioned, it is idempotent
- Leaving one club does not affect membership in other clubs
- Deleting a user removes them from all clubs; their historical contributions (votes, book suggestions) should be anonymized rather than deleted to preserve referential integrity

---

## Soft delete and data retention

Define these decisions before launch:

| Record | Recommendation |
|---|---|
| Club membership | Soft delete — preserve history, mark as inactive |
| User account | Soft delete in DB; hard delete from Supabase Auth on explicit account deletion request |
| Votes | Retain but anonymize if user is deleted |
| Book suggestions | Retain but reassign to "Deleted User" display name |
| Meeting availability | Retain for historical scheduling records |

Preserving relational integrity while anonymizing personal data is the standard approach for community apps.

---

## Account recovery edge cases

| Scenario | Handling |
|---|---|
| Email already registered in Supabase | Return a clear error; do not create a duplicate |
| Invite already accepted | Show "account already exists, please log in" |
| Expired invite link | Show resend option; admin can re-invite; pending record is reused (idempotent) |
| Verification email not received | Show resend button after 60 seconds |
| User wants to change email | Must go through Supabase email change flow (sends confirmation to both addresses); backend syncs on next request |
| User wants to delete account | Remove from Supabase Auth + soft delete/anonymize DB records |
| Duplicate pending membership | Idempotent — resend invite, do not create a second pending record |
| Registration token expired | User must re-enter the club password to get a new token |

---

## Redirect URL planning

Supabase auth flows require explicit redirect URL configuration. Define before wiring up any environment:

| Flow | Local | Production |
|---|---|---|
| Email verification | `http://localhost:5173/auth/callback` | `https://yourapp.com/auth/callback` |
| Password reset | `http://localhost:5173/auth/reset-password` | `https://yourapp.com/auth/reset-password` |
| Invite | `http://localhost:5173/auth/accept-invite` | `https://yourapp.com/auth/accept-invite` |

All allowed redirect URLs must be added to the Supabase project's allowed list (Supabase → Auth → URL Configuration).

---

## Environment separation

Use a separate Supabase project for each environment — never share projects between local and production.

Each environment needs its own:
- Supabase project URL and anon key
- `SUPABASE_JWT_SECRET`
- Allowed redirect URLs
- Email provider configuration (Supabase built-in is fine for local; use a custom SMTP provider in production)

### Local development with Supabase CLI

Rather than pointing local development at a remote Supabase project, use the Supabase CLI to run a full local instance:

```bash
npx supabase start   # spins up local Postgres, Auth, and Studio
npx supabase stop    # tears it down
```

This gives each developer an isolated environment with no risk of polluting a shared dev project with test accounts. The local Studio UI runs at `http://localhost:54323` and provides the same dashboard as the hosted version. Local credentials are always `http://localhost:54321` for the API URL and a fixed anon key — document these in a `.env.local.example` file so setup is one command.

---

## Email deliverability

Supabase's default email service is sufficient for development. For production:

- Configure a custom SMTP provider (e.g. Resend, Postmark, SendGrid)
- Set up SPF, DKIM, and DMARC records for your sending domain
- Use a branded from-address rather than Supabase's default
- Test verification and invite emails going to Gmail, Outlook, and Apple Mail before launch — spam delivery kills onboarding

**Free tier email rate limit:** The Supabase free tier caps outbound auth emails at 3 per hour. This will immediately block the Phase 4 migration if you attempt to send password reset emails to all existing members at once. Configure a custom SMTP provider before starting Phase 4, or batch the migration to stay under the cap. Do not discover this limit during rollout.

---

## Row-level security

Even if all database access goes through FastAPI:

- Enable RLS on all tables
- Add a blanket `service_role` policy so only the backend service role can read/write
- If you ever plan to query Supabase Postgres directly from the frontend, define per-table policies before data exists — retrofitting RLS is painful

---

## Testing strategy

### Backend integration tests

- JWT verification: valid token, expired token, unverified email, wrong issuer, tampered signature
- `/auth/provision`: first-time provisioning, repeated provisioning (idempotency), expired registration token, reused registration token
- Legacy fallback: `auth_migration_status = 'legacy'` path authenticates correctly
- Admin-only endpoints: reject member tokens, accept admin tokens

### Frontend unit/integration tests

- All auth loading states render correctly with no flash
- Session refresh triggers correctly; redirect on refresh failure
- Logout clears state and syncs across tabs
- Redirect flows (verify, reset, invite) land on correct screens

### End-to-end tests

- Full signup → verify email → provision → join club → see app
- Admin invite → accept invite → provision → see app
- Forgot password → reset → log in
- Existing user migration: legacy login → trigger migration → Supabase login

Auth systems break at boundaries — E2E coverage of the full flows is more valuable than unit tests here.

---

## Observability and audit logging

Log the following events at minimum:

- Login success / failure (with reason)
- Invite sent
- Email verification completed
- Password reset requested / completed
- User provisioned in DB (migration status updated)
- Membership added / removed
- Club password validation failure
- Registration token issued / consumed / expired

**Alerting thresholds to define:**
- Spike in failed logins (possible credential stuffing)
- Spike in club password validation failures (brute force attempt)
- Failed provisioning events (broken signup flow)
- JWT verification failures above baseline (possible token tampering or clock drift)
- Supabase error rate increase (upstream outage indicator)

---

## Rollback strategy

Define a rollback window before starting the migration.

- The `legacy` path stays active until Phase 5 — re-enabling it requires only setting `AUTH_MODE=dual`
- `auth_migration_status` lets you filter exactly which users are on each path at any moment
- Do not run Phase 5 (column removal) until the rollback window has passed and migration is confirmed stable for all users
- Keep a DB backup immediately before each phase

---

## Future considerations

- **SSO (Google, Discord, Apple):** The Supabase Auth architecture directly supports OAuth providers with no backend changes — just a new redirect URL and enabling the provider in Supabase. Discord is worth noting given the book club / Discord community overlap.
- **PKCE:** If a mobile app or OAuth flow is ever added, PKCE becomes important. Supabase supports it already.
- **Supabase Auth webhooks:** Can replace the lazy-provisioning `/auth/provision` endpoint with event-driven DB sync on `user.verified`, `user.deleted`, and `password.changed` events.
- **Magic links:** Supabase supports passwordless login via magic link. Could be offered as an alternative login method later with no backend changes.

---

## Key dependencies to add

| Location | Package | Purpose |
|---|---|---|
| Backend | `python-jose[cryptography]` or `PyJWT` | Verify Supabase-issued JWTs |
| Frontend | `@supabase/supabase-js` | Auth client, session management |
