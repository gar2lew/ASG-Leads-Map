# ASG Leads Map

A React + TypeScript + Vite application for mapping property leads with Firebase Authentication and Firestore.

## Quick Start

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview production build
- `npm test` - Run unit tests (Vitest)
- `npm run lint` - Run linter (oxlint)
- `npx playwright test` - Run E2E tests
- `npm run bootstrap:admin <email>` - Promote existing Firebase user to admin (requires Admin SDK credentials)

## Firebase Deployment

### Required Firebase Services

- **Firebase Authentication** - Email/password provider enabled
- **Cloud Firestore** - Database for user profiles and pin data

### Environment Variables

Create a `.env` file (or configure in your hosting platform) with the following:

```env
# Firebase Client SDK (required for production auth)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Development auth harness
VITE_USE_DEV_AUTH=true
```

**Variable meanings:**

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (e.g., `my-project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket (e.g., `my-project.appspot.com`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID (web) |
| `VITE_USE_DEV_AUTH` | Set to `true` to enable local deterministic dev harness; `false` or unset forces Firebase auth |

### Dev Harness vs Production

- **`VITE_USE_DEV_AUTH=true`** (default in development): Uses an in-memory auth harness with seeded accounts (`admin@asg.local`/`admin123`, `manager@asg.local`/`manager123`, `rep@asg.local`/`rep123`, `disabled@asg.local`/`disabled123`). No Firebase project required. Session persists in `localStorage` key `asg-dev-auth-user`. Legacy `asg-dev-role` seed still works for role-based E2E tests.
- **Production** (`VITE_USE_DEV_AUTH=false` or unset): Uses Firebase Authentication + Firestore. Requires all `VITE_FIREBASE_*` variables. Missing/invalid config throws at runtime.

### Firestore Rules

Deploy `firestore.rules` to your Firebase project:

```bash
firebase deploy --only firestore:rules
```

**Rules summary (`firestore.rules`):**
- Users collection: `users/{uid}`
- Read: Admin or self
- Write: Admin only
- Direct role escalation via client writes is blocked; privileged user management goes through backend Admin SDK endpoints.

### First Admin Bootstrap

1. Configure the Firebase Admin service-account variables in Vercel: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY`.
2. Generate a random `ADMIN_SETUP_CODE` and add it as a sensitive Vercel Production variable.
3. Open `/setup-admin`, enter the one-time code, your administrator email/password, and a six-digit PIN.
4. Sign out and verify the Administrator login with the new PIN. Setup replay is rejected after the first successful bootstrap.

The PIN is stored as a salted hash in the sole active `super_admin` profile. Subsequent user creation happens via the **Admin Users** UI or backend API.

### Admin API Architecture

Secure account-creation flow:

```
Admin browser UI
  → authenticated API request (ID token in Authorization header)
  → Vercel server functions: api/admin/users.ts (POST), api/admin/users/[uid].ts (PATCH)
  → Firebase Admin SDK (server-only, never in browser)
  → Firebase Auth user creation/update
  → Firestore user profile write
```

**Security notes:**
- Firebase Admin SDK **never runs in the browser**; privileged credentials must never be exposed client-side.
- Client-side role checks are UX only; backend verifies Admin caller via `verifyAdminCaller` (checks ID token → Firestore `users/{uid}` → `active: true` and `role === 'admin'`).
- Create returns a one-time temporary password (`asg-dev123` in dev; random in production). No email service is configured; password-reset-on-first-login is a documented follow-up.

## Development

### Dev Auth Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@asg.local | admin123 |
| Manager | manager@asg.local | manager123 |
| Rep | rep@asg.local | rep123 |
| Disabled | disabled@asg.local | disabled123 |

Dev-created users receive temporary password `asg-dev123`.

### Project Structure

```
src/
├── auth/                 # Auth context, provider, services (dev + Firebase)
├── components/           # Shared UI (RouteGuards, Layout, PinModal, etc.)
├── domain/               # Pure logic (roles, geocoding, csv, outcomes)
├── firebase/             # Lazy Firebase client init (config, app, firestore)
├── pages/                # Route pages (MapPage, LoginPage, AdminUsersPage, ...)
├── test/                 # Vitest setup
└── App.tsx               # Route definitions with guards
api/
├── _lib/admin.ts         # Firebase Admin SDK init + verifyAdminCaller
├── admin/users.ts        # POST create user (Admin only)
└── admin/users/[uid].ts  # PATCH update user (Admin only)
tests/
├── e2e/                  # Playwright tests
│   ├── helpers.ts        # Shared test utilities
│   ├── auth.spec.ts      # Login, session, role redirects
│   ├── admin-users.spec.ts # Admin user management
│   ├── roles.spec.ts     # Role-based access control
│   └── ...
```

## Testing

### Unit Tests (Vitest)
```bash
npm test
```
148 tests covering domain logic, auth provider, login page, admin users page, pin modal, map page workflows.

### E2E Tests (Playwright)
```bash
npx playwright test --project=chromium
```
64 tests covering:
- Property address resolution (6 scenarios)
- Role-based access control (admin/manager/rep)
- Authentication flows (login, disabled, invalid, sign-out, persistence, protected routes)
- Admin user management (create, deactivate, role change, self-protection)
- Pin workflows (outcomes, lead capture, filters, CSV export, persistence)
- Form validation

## Deployment Status

| Component | Status |
|-----------|--------|
| Dev Auth Harness | **WORKING** |
| Firebase Production Implementation | **READY** (code-complete, type-checked) |
| Connected Firebase Project | **NOT VERIFIED** (no project configured in this environment) |
| Firestore Rules | **NOT DEPLOYED** (file ready at `firestore.rules`) |
| Admin Backend (Vercel Functions) | **IMPLEMENTED** (`api/admin/users*`) |
| First Admin Bootstrap | **DOCUMENTED** (`scripts/bootstrap-admin.mjs`) |

## Remaining Work (Post-Review)

- Connect/deploy Firebase project
- Deploy Firestore rules (`firebase deploy --only firestore:rules`)
- Configure production environment variables
- Territory assignment
- Jotform lead submission integration
- Enhanced reporting / dashboard upgrades
