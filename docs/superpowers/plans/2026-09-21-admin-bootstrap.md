# One-Time Administrator Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Establish the first administrator with a one-time Vercel setup code and use their own six-digit PIN thereafter.

**Architecture:** A server-only bootstrap function creates exactly one Firebase Auth and Firestore `super_admin` record with salted PIN credentials. Existing custom-token session handling remains; admin login verifies the stored credentials instead of `ADMIN_LOGIN_PIN`.

**Tech Stack:** React, TypeScript, Vercel Functions, Firebase Auth, Firestore, Firebase Admin, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-admin-bootstrap-design.md`

## Global Constraints

- Never log, return, commit, or persist a setup code, PIN, Firebase token, or service-account value.
- `ADMIN_SETUP_CODE` is a sensitive Production Vercel variable and is compared with `timingSafeEqual`.
- PINs are exactly six digits and persisted only as salted scrypt hash plus salt.
- Existing bootstrap completion or an existing `super_admin` rejects bootstrap replay.
- Use existing lazy Firebase Admin getters from `api/_lib/admin.ts`.

## Review Focus

- Bad setup input creates no Firebase or Firestore records.
- Duplicate email or admin cannot create a second administrator.
- Firestore transaction failure deletes the newly-created Firebase user.
- Missing admin and wrong PIN receive the same generic credential response.
- Bootstrap code reuse after completion is rejected.

---

## File Structure

- Create `api/_lib/pinCredentials.ts` plus unit tests for six-digit validation, salted scrypt generation, and constant-time verification.
- Create `api/auth/bootstrap-admin.ts` plus mocked Firebase Admin endpoint tests.
- Modify `api/auth/admin-login.ts`; add endpoint tests for stored PIN login.
- Modify auth service types and Firebase/dev implementations; add `SetupAdminPage`, page tests, public app route, and setup link.
- Update README, `.env.example`, and PIN-login E2E helpers/specs.

### Task 1: Secure PIN credentials

**Files:** Create `api/_lib/pinCredentials.ts`; create `api/_lib/pinCredentials.test.ts`.

**Produces:** `isSixDigitPin`, `createPinCredentials`, and `matchesPin`.

- [ ] Write a failing test where `123456` verifies and `123457` does not, plus boundary tests for `12345`, `1234567`, and `12a456`.
- [ ] Run `npx vitest run api/_lib/pinCredentials.test.ts`; expect missing-module failure.
- [ ] Implement `randomBytes(16)`, `scryptSync(pin, salt, 32)`, base64 credentials, and equal-length `timingSafeEqual`.
- [ ] Run the same command; expect pass.
- [ ] Commit `api/_lib/pinCredentials.ts` and test as `feat: add secure admin PIN credentials`.

### Task 2: One-time bootstrap endpoint

**Files:** Create `api/auth/bootstrap-admin.ts`; create `api/auth/bootstrap-admin.test.ts`.

**Consumes:** pin credential helper and `getAdminAuth`/`getAdminDb`.

**Produces:** `POST /api/auth/bootstrap-admin` accepting setup code, email, password, and PIN; success is HTTP 201 with custom token only.

- [ ] Write failing tests for valid bootstrap, invalid setup code, a pre-existing `_system/adminBootstrap` marker, existing `super_admin`, and deletion of a newly-created Auth user after transaction failure.
- [ ] Run `npx vitest run api/auth/bootstrap-admin.test.ts`; expect endpoint-missing failure.
- [ ] Validate all input before Firebase operations; create Auth user; atomically write `users/{uid}` with active `super_admin`, credentials, and `_system/adminBootstrap`; delete Auth user after transaction failure; return custom token.
- [ ] Run endpoint tests; expect pass.
- [ ] Commit endpoint and tests as `feat: bootstrap first administrator securely`.

### Task 3: Stored-PIN administrator login

**Files:** Modify `api/auth/admin-login.ts`; create `api/auth/admin-login.test.ts`.

**Produces:** unchanged `{ token, requiresPinSetup: false }` response for valid stored PIN.

- [ ] Write failing tests for valid stored PIN, invalid PIN, missing admin, inactive admin, and malformed credentials; assert every invalid state returns `{ error: 'Invalid administrator PIN.' }` with HTTP 401.
- [ ] Run `npx vitest run api/auth/admin-login.test.ts`; expect failure because environment `ADMIN_LOGIN_PIN` is used.
- [ ] Load at most two `super_admin` documents; require exactly one active profile with valid credentials; use `matchesPin`; create token using its UID; remove `ADMIN_LOGIN_PIN` from this code path.
- [ ] Run endpoint tests; expect pass.
- [ ] Commit as `feat: authenticate admin using stored PIN`.

### Task 4: Setup page and session

**Files:** Modify `src/auth/types.ts`, Firebase/dev auth services, `src/App.tsx`, LoginPage and tests; create `src/pages/SetupAdminPage.tsx` and test.

**Produces:** public `/setup-admin` that posts setup code, email, password, matching PINs, exchanges custom token, and navigates to map.

- [ ] Write failing form tests for invalid email, mismatched PINs, invalid six-digit PIN, generic endpoint error, successful service call, and map navigation.
- [ ] Run `npx vitest run src/pages/SetupAdminPage.test.tsx`; expect page-missing failure.
- [ ] Add `bootstrapAdmin` to `AuthService`; Firebase implementation posts bootstrap input, exchanges token through `signInWithCustomToken`, loads and emits profile; form retains secrets only in component state.
- [ ] Run `npx vitest run src/pages/SetupAdminPage.test.tsx src/pages/LoginPage.test.tsx src/auth/AuthProvider.test.tsx`; expect pass.
- [ ] Commit as `feat: add first administrator setup flow`.

### Task 5: Documentation, E2E, and rollout

**Files:** Modify `.env.example`, `README.md`, `tests/e2e/auth.spec.ts`, `tests/e2e/admin-users.spec.ts`, and helpers.

- [ ] Write a failing E2E test that opens LoginPage, enters a mocked six-digit admin PIN, and reaches `/map`; do not include a production credential.
- [ ] Run `npx playwright test tests/e2e/auth.spec.ts --project=chromium`; expect old email-login helper failure.
- [ ] Update test mocks/helpers to current PIN UI and document `ADMIN_SETUP_CODE`, Firebase Admin variables, and one-time setup procedure.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `set CI=1&& set VITE_USE_DEV_AUTH=true&& npx playwright test --project=chromium`; expect all gates pass.
- [ ] Commit documentation and tests as `test: cover administrator bootstrap flow`.
- [ ] After deployment, verify Firebase Admin credentials target `leadsmapasg`, add a generated sensitive `ADMIN_SETUP_CODE`, complete setup once, sign out/in with chosen PIN, and confirm replay fails. Request action-time confirmation before entering secrets in Vercel.
