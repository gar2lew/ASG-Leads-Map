# ASG Field Sales Map Version 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an installable ASG field-sales PWA that lets office teams share door-knocking pins, capture leads offline, submit completed leads to Jotform, and review operational activity.

**Architecture:** A React/Vite/TypeScript client uses MapLibre and Firebase Authentication/Firestore with persistent web caching. Privileged account, reverse-geocoding, and Jotform operations run in authenticated Vercel functions using Firebase Admin; browser code never receives privileged credentials.

**Tech Stack:** React, Vite, TypeScript, React Router, MapLibre GL, Firebase Web/Admin SDKs, Vercel Functions, Vitest, React Testing Library, Firebase Emulator Suite, Playwright, vite-plugin-pwa

**Spec:** `docs/superpowers/specs/2026-08-19-field-sales-map-design.md`

## Global Constraints

- Outcomes are exactly `Knocked`, `Not Knocked`, `Not Interested`, `Did Not Qualify`, and `Lead`.
- Initial offices are Perth (`Australia/Perth`) and Brisbane (`Australia/Brisbane`).
- Roles are exactly `admin`, `manager`, and `rep`.
- Same-office users can read all same-office pins and lead contact details.
- Cross-office data is denied unless an administrator has explicit organisation-wide access.
- There is no public registration route or control.
- Pins and leads must save while offline; Jotform delivery is a separate state.
- Reps cannot permanently delete operational history.
- Dates display in Australian day-first format.
- Use MapLibre; do not bulk-download from the public OpenStreetMap tile service.
- Downloadable PMTiles territory packages are outside Version 1.
- Never expose Firebase Admin credentials or the Jotform API key to browser code.

## File Structure

```text
api/
  _lib/auth.ts                 Firebase token verification and authorisation
  _lib/firebaseAdmin.ts        Singleton Firebase Admin initialisation
  _lib/http.ts                 JSON responses and safe error handling
  accounts/create.ts           Privileged staff creation
  accounts/disable.ts          Privileged account disabling
  geocode/reverse.ts           Cached, throttled reverse geocoding
  integrations/jotform.ts      One-lead Jotform delivery
  integrations/retry.ts        Scheduled bounded retry worker
src/
  app/App.tsx                  Routes and application shell
  app/navigation.ts            Role-aware navigation declarations
  components/                  Shared presentational controls
  features/auth/               Auth provider, login, protected routes
  features/dashboard/          Filters, totals, activity, CSV export
  features/leads/              Lead form, model, repository, integration state
  features/map/                MapLibre adapter, layers, current location
  features/pins/               Outcomes, pin form, repository, activity events
  features/staff/              Staff list/create/disable UI
  features/sync/               Connectivity, pending work, sync centre
  features/territories/        Polygon drawing and assignment
  firebase/client.ts           Firebase client initialisation and persistence
  shared/                      Dates, mobile validation, CSV, errors, IDs
  styles/                      Theme tokens and responsive layout
tests/
  rules/                       Firebase Emulator security tests
  e2e/                         Playwright user-flow smoke tests
firebase.json
firestore.indexes.json
firestore.rules
vercel.json
vite.config.ts
```

---

### Task 1: Scaffold the Application and Domain Primitives

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/features/pins/model.ts`
- Create: `src/shared/date.ts`
- Create: `src/shared/mobile.ts`
- Create: `src/shared/csv.ts`
- Test: `src/features/pins/model.test.ts`
- Test: `src/shared/mobile.test.ts`
- Test: `src/shared/csv.test.ts`

**Interfaces:**
- Produces: `PinOutcome`, `PIN_OUTCOMES`, `formatAustralianDate`, `normaliseAustralianMobile`, and `toCsv`.
- Consumes: none.

- [ ] **Step 1: Scaffold React/Vite/TypeScript and install runtime and test dependencies**

Run:

```bash
npm create vite@latest . -- --template react-ts
npm install react-router-dom maplibre-gl firebase papaparse
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @types/papaparse
```

Keep the generated TypeScript strict mode enabled. Add scripts: `test`, `test:run`, `typecheck`, and `build`.

- [ ] **Step 2: Write failing domain tests**

```ts
expect(PIN_OUTCOMES.map((item) => item.value)).toEqual([
  'knocked', 'not_knocked', 'not_interested', 'did_not_qualify', 'lead'
]);
expect(normaliseAustralianMobile('61435 202 675')).toBe('0435202675');
expect(toCsv([{ notes: 'Called, then said "yes"' }])).toContain('"Called, then said ""yes"""');
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm run test:run`

Expected: imports are unresolved because domain helpers do not exist.

- [ ] **Step 4: Implement typed primitives and accessible outcome metadata**

```ts
export type PinOutcome =
  | 'knocked'
  | 'not_knocked'
  | 'not_interested'
  | 'did_not_qualify'
  | 'lead';

export const PIN_OUTCOMES = [
  { value: 'knocked', label: 'Knocked', colour: '#2563EB', symbol: 'K' },
  { value: 'not_knocked', label: 'Not Knocked', colour: '#64748B', symbol: 'N' },
  { value: 'not_interested', label: 'Not Interested', colour: '#DC2626', symbol: '×' },
  { value: 'did_not_qualify', label: 'Did Not Qualify', colour: '#D97706', symbol: 'DQ' },
  { value: 'lead', label: 'Lead', colour: '#16A34A', symbol: 'L' },
] as const satisfies ReadonlyArray<{ value: PinOutcome; label: string; colour: string; symbol: string }>;
```

Implement date formatting with `Intl.DateTimeFormat('en-AU')`, strict AU mobile normalisation, and RFC 4180-style CSV escaping.

- [ ] **Step 5: Run unit tests, typecheck, and build**

Run: `npm run test:run && npm run typecheck && npm run build`

Expected: all commands exit successfully.

- [ ] **Step 6: Commit the domain foundation**

```bash
git add package.json package-lock.json vite.config.ts src
git commit -m "feat: scaffold field sales app domain"
```

### Task 2: Initialise Firebase and Implement Authentication

**Files:**
- Create: `src/firebase/client.ts`
- Create: `src/features/auth/types.ts`
- Create: `src/features/auth/AuthProvider.tsx`
- Create: `src/features/auth/LoginPage.tsx`
- Create: `src/features/auth/ProtectedRoute.tsx`
- Create: `src/app/navigation.ts`
- Create: `src/features/auth/AuthProvider.test.tsx`
- Modify: `src/app/App.tsx`
- Create: `.env.example`

**Interfaces:**
- Produces: `AuthUser`, `useAuth(): AuthContextValue`, `ProtectedRoute`, `db`, and `auth`.
- Consumes: domain roles `admin | manager | rep` declared in `src/features/auth/types.ts`.

- [ ] **Step 1: Write failing auth-provider tests**

Test that an unauthenticated user sees Login, an inactive profile is signed out, a rep cannot render an admin route, and an administrator can render it.

```tsx
render(<TestAuthProvider user={rep}><ProtectedRoute roles={['admin']}><div>Admin</div></ProtectedRoute></TestAuthProvider>);
expect(screen.queryByText('Admin')).not.toBeInTheDocument();
expect(screen.getByText(/not authorised/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the auth test and confirm it fails**

Run: `npm run test:run -- src/features/auth/AuthProvider.test.tsx`

Expected: missing provider and route modules.

- [ ] **Step 3: Initialise Firebase with persistent multi-tab cache**

Use `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Catch unsupported persistence and expose `persistenceAvailable: false` without preventing online use.

`.env.example` contains names only:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_MAP_STYLE_URL=
```

- [ ] **Step 4: Implement authentication and route protection**

Subscribe with `onAuthStateChanged`, read `users/{uid}`, require `active === true`, and expose profile loading separately from auth loading. Implement login and password reset; do not create a registration screen.

- [ ] **Step 5: Run auth tests and full verification**

Run: `npm run test:run && npm run typecheck && npm run build`

Expected: all commands pass.

- [ ] **Step 6: Commit authentication**

```bash
git add .env.example src/firebase src/features/auth src/app
git commit -m "feat: add role-aware firebase authentication"
```

### Task 3: Enforce Office and Role Security in Firestore

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json`
- Create: `tests/rules/firestore.rules.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: deployed Firestore rules and required compound indexes.
- Consumes: `users/{uid}` documents with `officeId`, `organisationId`, `role`, and `active`.

- [ ] **Step 1: Install emulator rule-test tooling and write denial-first tests**

Run: `npm install -D @firebase/rules-unit-testing firebase-tools`

Create users for Perth rep, Perth manager, Brisbane rep, and administrator. Assert that a Perth rep reads a Perth lead and cannot read a Brisbane lead while cross-office visibility is disabled; the same read succeeds when an administrator enables organisation-wide visibility; a rep cannot write `users`; a manager cannot create a Brisbane territory; clients cannot update `auditLogs`.

```ts
await assertSucceeds(getDoc(doc(perthRepDb, 'leads/perthLead')));
await assertFails(getDoc(doc(perthRepDb, 'leads/brisbaneLead')));
await assertFails(setDoc(doc(perthRepDb, 'users/other'), { active: true }));
```

- [ ] **Step 2: Run emulator tests and verify the rules do not yet satisfy them**

Run: `firebase emulators:exec --only firestore "npm run test:rules"`

Expected: rule tests fail before the final rules are implemented.

- [ ] **Step 3: Implement shared rule helpers and per-collection permissions**

Use helpers equivalent to:

```rules
function profile() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
function active() { return request.auth != null && profile().active == true; }
function sameOffice(data) { return active() && data.officeId == profile().officeId; }
function crossOfficeEnabled() {
  return get(/databases/$(database)/documents/organisations/$(profile().organisationId)).data.crossOfficeVisibilityEnabled == true;
}
function canReadOffice(data) { return sameOffice(data) || admin() || (active() && crossOfficeEnabled()); }
function admin() { return active() && profile().role == 'admin'; }
function manager() { return active() && profile().role in ['admin', 'manager']; }
```

Allow `canReadOffice` reads for pins/leads/activity, controlled same-office creates/updates, append-only activity-event creates, integration-job creates only in `pending` state with a stable `leadId`, and no client writes to users/audit logs. Permit only administrators to update the limited organisation settings allowlist containing `crossOfficeVisibilityEnabled`.

- [ ] **Step 4: Add indexes for office/date, office/outcome/date, office/rep/date, and integration state**

Create compound indexes used by the map, dashboard, activity list, and retry worker. Do not query the entire organisation when an office filter is sufficient.

- [ ] **Step 5: Run emulator and application verification**

Run: `firebase emulators:exec --only firestore "npm run test:rules" && npm run test:run && npm run build`

Expected: all rule and app tests pass.

- [ ] **Step 6: Commit database security**

```bash
git add firestore.rules firestore.indexes.json firebase.json tests/rules package.json package-lock.json
git commit -m "feat: enforce office-scoped firestore access"
```

### Task 4: Build the Shared Map and Pin Capture Workflow

**Files:**
- Create: `src/features/map/MapView.tsx`
- Create: `src/features/map/useCurrentLocation.ts`
- Create: `src/features/map/OfflineMapProvider.ts`
- Create: `src/features/pins/repository.ts`
- Create: `src/features/pins/AddPinSheet.tsx`
- Create: `src/features/pins/PinDetailsSheet.tsx`
- Create: `src/features/pins/AddPinSheet.test.tsx`
- Create: `src/features/pins/activity.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Produces: `createPin(input): Promise<string>`, `updatePinOutcome(pinId, outcome): Promise<void>`, and `MapView`.
- Consumes: `PinOutcome`, authenticated user profile, Firestore `db`.

- [ ] **Step 1: Write failing pin-flow tests**

Assert that Add Pin requires coordinates and an outcome, geocoding failure leaves address editable, selecting Lead calls `createPin` before opening Lead details, and every create emits an activity event.

```tsx
await user.click(screen.getByRole('button', { name: 'Lead' }));
expect(createPin).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'lead' }));
expect(onOpenLead).toHaveBeenCalledAfter(createPin as never);
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm run test:run -- src/features/pins/AddPinSheet.test.tsx`

Expected: pin components and repository are missing.

- [ ] **Step 3: Implement MapLibre map lifecycle and office layers**

Create the map once, clean it up on unmount, cluster wider-zoom pins, render symbol plus colour for every status, filter by the signed-in user's authorised office, and request current location only after a clear user action. Fall back to the office centre.

Define:

```ts
export interface OfflineMapProvider {
  isAvailable(): Promise<boolean>;
  listPackages(): Promise<Array<{ id: string; name: string; bytes: number }>>;
}
```

Version 1 returns no packages and labels offline basemaps as a future capability.

- [ ] **Step 4: Implement atomic pin and activity-event writes**

Generate document IDs before the write. Use a Firestore batch to write `pins/{pinId}` and `activityEvents/{eventId}` together. Include organisation, office, actor, coordinates, editable address, address source, client time, and server timestamp.

Implement manager/admin archive in the same repository as an update plus append-only `pin_archived` event. Reps never receive archive controls, and no client role receives a hard-delete path.

- [ ] **Step 5: Run pin tests and application verification**

Run: `npm run test:run && npm run typecheck && npm run build`

Expected: tests pass and production build succeeds.

- [ ] **Step 6: Commit the field map**

```bash
git add src/features/map src/features/pins src/app
git commit -m "feat: add shared field map and pin capture"
```

### Task 5: Add Offline Lead Capture and Sync States

**Files:**
- Create: `src/features/leads/model.ts`
- Create: `src/features/leads/repository.ts`
- Create: `src/features/leads/LeadFormSheet.tsx`
- Create: `src/features/leads/LeadDetailsPage.tsx`
- Create: `src/features/sync/useConnectivity.ts`
- Create: `src/features/sync/SyncBadge.tsx`
- Create: `src/features/sync/SyncCentrePage.tsx`
- Test: `src/features/leads/LeadFormSheet.test.tsx`
- Test: `src/features/sync/SyncBadge.test.tsx`

**Interfaces:**
- Produces: `saveLead`, `queueLeadIntegration`, `LeadIntegrationState`, `useConnectivity`.
- Consumes: linked Lead pin ID, authenticated profile, Firestore persistent cache.

- [ ] **Step 1: Write failing lead and sync-state tests**

Test Complete Later, AU mobile validation, same-office detail rendering, and these independent states: `saved_locally`, `syncing`, `synced`, `waiting_for_jotform`, `submitted`, `action_required`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test:run -- src/features/leads src/features/sync`

Expected: lead and sync modules are unresolved.

- [ ] **Step 3: Implement stable offline lead and job writes**

Use the pin's pre-generated `leadId`. Save `leads/{leadId}` and create `integrationJobs/{leadId}` only when the lead is complete enough for the configured Jotform mapping. The job begins in `pending`; clients cannot mark it submitted.

- [ ] **Step 4: Implement the lead UI and explicit two-stage delivery display**

Render Firestore synchronisation separately from Jotform delivery. Never display Submitted until the backend stores a Jotform submission identifier. Retain the form draft after network errors.

- [ ] **Step 5: Run lead tests, typecheck, and build**

Run: `npm run test:run && npm run typecheck && npm run build`

Expected: all checks pass.

- [ ] **Step 6: Commit offline lead capture**

```bash
git add src/features/leads src/features/sync
git commit -m "feat: capture leads offline with delivery states"
```

### Task 6: Add Authenticated Vercel Functions and Staff Management

**Files:**
- Create: `api/_lib/firebaseAdmin.ts`
- Create: `api/_lib/auth.ts`
- Create: `api/_lib/http.ts`
- Create: `api/accounts/create.ts`
- Create: `api/accounts/disable.ts`
- Create: `api/accounts/accounts.test.ts`
- Create: `src/features/staff/StaffPage.tsx`
- Create: `src/features/staff/CreateStaffDialog.tsx`
- Create: `src/features/staff/api.ts`
- Create: `src/features/staff/CreateStaffDialog.test.tsx`
- Create: `src/features/admin/AdminSettingsPage.tsx`
- Create: `src/features/admin/AuditLogList.tsx`
- Create: `src/features/admin/AdminSettingsPage.test.tsx`

**Interfaces:**
- Produces: `requireCaller(req)`, `assertCanManageUser(caller, target)`, POST `/api/accounts/create`, POST `/api/accounts/disable`.
- Consumes: Firebase ID token, server-only Admin credentials, caller's Firestore profile.

- [ ] **Step 1: Install server dependencies and write failing authorisation tests**

Run: `npm install firebase-admin`

Test missing token → 401, rep → 403, Perth manager creating Brisbane user → 403, Perth manager creating Perth rep → 201, administrator creating manager → 201.

- [ ] **Step 2: Run endpoint tests and confirm failure**

Run: `npm run test:run -- api/accounts/accounts.test.ts`

Expected: endpoint helpers are missing.

- [ ] **Step 3: Implement server-only token verification and caller profile checks**

Parse `Authorization: Bearer <token>`, call `verifyIdToken`, fetch `users/{uid}`, require `active`, and authorise from the current server-side profile rather than trusting request body role/office values.

- [ ] **Step 4: Implement account creation and disabling**

Create Firebase Auth user, set custom claims, and write `users/{uid}`. If profile creation fails, disable the new Auth user and return a safe failure. Disabling updates the profile, disables Auth, and revokes refresh tokens. Write an audit log for both operations.

- [ ] **Step 5: Build staff and administrator settings UI**

The staff UI shows no controls the caller cannot use, but endpoint and Firestore security remain authoritative. The administrator settings page toggles `crossOfficeVisibilityEnabled`, displays its office-visibility consequence before saving, and provides a read-only audit-log list with actor, action, target, and Australian timestamp.

- [ ] **Step 6: Run complete verification**

Run: `npm run test:run && npm run typecheck && npm run build`

- [ ] **Step 7: Commit staff management**

```bash
git add api/_lib api/accounts src/features/staff src/features/admin package.json package-lock.json
git commit -m "feat: add secure manager-created staff accounts"
```

### Task 7: Add Reverse Geocoding with Cache and Throttle

**Files:**
- Create: `api/geocode/reverse.ts`
- Create: `api/geocode/reverse.test.ts`
- Create: `src/features/map/geocoding.ts`
- Modify: `src/features/pins/AddPinSheet.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces: GET `/api/geocode/reverse?lat=&lng=` and `reverseGeocode(location, signal)`.
- Consumes: authenticated Firebase token and coordinates.

- [ ] **Step 1: Write failing geocoding tests**

Test coordinate validation, unauthenticated denial, rounded-coordinate cache hits, a one-request-per-second throttle document, safe 429 response, and editable-address fallback.

- [ ] **Step 2: Run the geocoding tests and verify failure**

Run: `npm run test:run -- api/geocode/reverse.test.ts`

Expected: reverse-geocoding endpoint is absent.

- [ ] **Step 3: Implement cached, identified geocoding**

Round coordinates to five decimal places for the cache key. Use a Firestore transaction on a singleton throttle document before calling the configured geocoder. Send an identifying server-side user agent/contact value, cache successful results, and return only the normalised address fields needed by the client.

Add server-only names:

```dotenv
GEOCODER_BASE_URL=
GEOCODER_CONTACT=
```

- [ ] **Step 4: Integrate non-blocking address lookup**

Abort stale requests when the marker moves. Set `addressSource` to `geocoder` or `manual`. A failed lookup leaves a blank editable field and does not disable Save.

- [ ] **Step 5: Verify geocoding and build**

Run: `npm run test:run && npm run typecheck && npm run build`

- [ ] **Step 6: Commit geocoding**

```bash
git add api/geocode src/features/map src/features/pins .env.example
git commit -m "feat: add cached reverse geocoding"
```

### Task 8: Implement Reliable Jotform Delivery

**Files:**
- Create: `api/integrations/jotform.ts`
- Create: `api/integrations/retry.ts`
- Create: `api/integrations/jotformClient.ts`
- Create: `api/integrations/jotform.test.ts`
- Create: `src/features/leads/integration.ts`
- Modify: `src/features/sync/SyncCentrePage.tsx`
- Modify: `.env.example`
- Modify: `vercel.json`

**Interfaces:**
- Produces: POST `/api/integrations/jotform`, GET `/api/integrations/retry`, `submitPendingLead(leadId)`.
- Consumes: `integrationJobs/{leadId}`, `leads/{leadId}`, Firebase ID token or Vercel cron secret.

- [ ] **Step 1: Write failing delivery tests**

Test unauthorised denial, same-office authorisation, stable job ID, already-submitted no-op, processing lease, successful submission-ID storage, transient backoff, terminal mapping error, and sanitised error text.

```ts
expect(await deliverLead('lead-1')).toEqual({ state: 'submitted', submissionId: 'jf-123' });
expect(jotformClient.submit).toHaveBeenCalledTimes(1);
await deliverLead('lead-1');
expect(jotformClient.submit).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run delivery tests and verify failure**

Run: `npm run test:run -- api/integrations/jotform.test.ts`

Expected: integration modules are missing.

- [ ] **Step 3: Implement transaction-based job claiming and field mapping**

Claim only `pending`/eligible `failed` jobs or expired `processing` leases. Map fields from server-side configuration, include the stable internal lead ID in a dedicated Jotform field, submit, then store the external submission ID. Return an existing submitted result without calling Jotform.

Server-only configuration:

```dotenv
JOTFORM_API_KEY=
JOTFORM_FORM_ID=
JOTFORM_FIELD_MAP_JSON=
CRON_SECRET=
```

- [ ] **Step 4: Implement bounded retry**

Use attempt delays of 1, 5, 15, and 60 minutes, capped at five attempts. The scheduled endpoint selects only due jobs and processes a bounded batch. Configure Vercel Cron every ten minutes and require the platform cron secret.

- [ ] **Step 5: Integrate reconnect and manual retry triggers**

When the browser becomes online, request delivery for authorised pending jobs. The Sync Centre exposes manual retry. The server remains the only component able to mark jobs processing/submitted/failed.

- [ ] **Step 6: Run all tests and build**

Run: `npm run test:run && npm run typecheck && npm run build`

- [ ] **Step 7: Commit Jotform integration**

```bash
git add api/integrations src/features/leads src/features/sync .env.example vercel.json
git commit -m "feat: deliver leads reliably to jotform"
```

### Task 9: Add Optional Territory Drawing

**Files:**
- Create: `src/features/territories/model.ts`
- Create: `src/features/territories/repository.ts`
- Create: `src/features/territories/TerritoriesPage.tsx`
- Create: `src/features/territories/TerritoryEditor.tsx`
- Create: `src/features/territories/TerritoryEditor.test.tsx`
- Modify: `src/features/map/MapView.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `Territory`, `saveTerritory`, `archiveTerritory`, and territory GeoJSON layers.
- Consumes: MapLibre map instance and manager/admin authorisation.

- [ ] **Step 1: Install a MapLibre-compatible drawing control and write failing tests**

Test polygon-only saves, minimum valid ring, office assignment from the caller rather than free input, rep read-only rendering, and Open Canvassing remaining selectable.

- [ ] **Step 2: Run territory tests and verify failure**

Run: `npm run test:run -- src/features/territories/TerritoryEditor.test.tsx`

- [ ] **Step 3: Implement drawing, validation, assignment, and archive**

Persist GeoJSON-compatible coordinates, name, colour, assigned user IDs, office, audit actors, and timestamps. Hide editor controls from reps and reject unauthorised writes in rules.

- [ ] **Step 4: Render active territory boundaries and filters on the shared map**

Pins do not require a territory ID. Open Canvassing is a filter state, not a stored fake territory.

- [ ] **Step 5: Run tests and build**

Run: `npm run test:run && npm run typecheck && npm run build`

- [ ] **Step 6: Commit territories**

```bash
git add src/features/territories src/features/map package.json package-lock.json
git commit -m "feat: add optional drawn territories"
```

### Task 10: Build the Manager Dashboard and CSV Export

**Files:**
- Create: `src/features/dashboard/DashboardPage.tsx`
- Create: `src/features/dashboard/filters.ts`
- Create: `src/features/dashboard/metrics.ts`
- Create: `src/features/dashboard/ActivityList.tsx`
- Create: `src/features/dashboard/DashboardPage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/navigation.ts`

**Interfaces:**
- Produces: `DashboardFilters`, `calculateMetrics`, and filtered `exportCsv` action.
- Consumes: pins, leads, activity events, authorised office selection, `toCsv`.

- [ ] **Step 1: Write failing metric and filter tests**

Test filters for office, rep, outcome, territory, and inclusive AU date range; verify totals use the filtered set; verify managers cannot switch office and administrators can.

- [ ] **Step 2: Run dashboard tests and confirm failure**

Run: `npm run test:run -- src/features/dashboard`

- [ ] **Step 3: Implement query-backed filters and operational cards**

Cards show each approved outcome, total Leads, incomplete Leads, waiting for Jotform, Submitted, and Action Required. Do not add rankings, targets, or conversion scoring.

- [ ] **Step 4: Implement recent activity and filtered CSV export**

Export addresses, coordinates, outcome, rep, office, territory, lead completion/delivery state, created time, and updated time. Use Australian display dates and correct CSV quoting.

- [ ] **Step 5: Run tests, typecheck, and build**

Run: `npm run test:run && npm run typecheck && npm run build`

- [ ] **Step 6: Commit the dashboard**

```bash
git add src/features/dashboard src/app
git commit -m "feat: add manager operations dashboard"
```

### Task 11: Finish PWA, Themes, Accessibility, and Recovery

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/layout.css`
- Create: `src/features/settings/ThemeToggle.tsx`
- Create: `src/features/settings/useTheme.ts`
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/components/ConnectionBanner.tsx`
- Create: `public/icons/` PWA icon assets
- Modify: `vite.config.ts`
- Modify: `src/main.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/features/settings/useTheme.test.ts`

**Interfaces:**
- Produces: persisted `dark | light | outdoor` theme and installable PWA shell.
- Consumes: app routes and connectivity state.

- [ ] **Step 1: Install PWA tooling and write failing theme tests**

Run: `npm install -D vite-plugin-pwa`

Test dark default on desktop, stored manual selection, outdoor high contrast, and no status conveyed by colour alone.

- [ ] **Step 2: Run theme tests and verify failure**

Run: `npm run test:run -- src/features/settings/useTheme.test.ts`

- [ ] **Step 3: Implement ASG theme tokens and responsive shells**

Use navy/charcoal/white with restrained gold accents, 44 px minimum touch targets, mobile bottom navigation, desktop sidebar, safe-area insets, and one-handed mobile primary actions.

- [ ] **Step 4: Configure installability and safe caching**

Cache the application shell and static assets. Do not cache authenticated API responses or claim offline basemap support. Provide update-ready UI and a trusted-device notice before retaining lead data persistently.

- [ ] **Step 5: Add error boundary, clear-local-data sign-out, and accessibility checks**

Preserve drafts after recoverable failures. Provide keyboard labels, focus management for sheets/dialogs, text alternatives for map-status symbols, and reduced-motion support.

- [ ] **Step 6: Run all verification**

Run: `npm run test:run && npm run typecheck && npm run build`

- [ ] **Step 7: Commit PWA polish**

```bash
git add src/styles src/features/settings src/components public vite.config.ts src/main.tsx src/app
git commit -m "feat: finish installable accessible field pwa"
```

### Task 12: Seed, End-to-End Test, Document, and Prepare Deployment

**Files:**
- Create: `scripts/seed-emulator.ts`
- Create: `tests/e2e/auth-map-lead.spec.ts`
- Create: `tests/e2e/dashboard.spec.ts`
- Create: `playwright.config.ts`
- Create: `README.md`
- Create: `docs/DEPLOYMENT.md`
- Create: `docs/JOTFORM_MAPPING.md`
- Create: `docs/PHASE_2_OFFLINE_MAPS.md`
- Modify: `package.json`
- Modify: `vercel.json`

**Interfaces:**
- Produces: repeatable local demo, deployment guide, tested production build, and explicit handover report.
- Consumes: all Version 1 interfaces.

- [ ] **Step 1: Install Playwright and create deterministic emulator seed data**

Run: `npm install -D @playwright/test && npx playwright install chromium`

Seed one administrator, one manager and one rep per office; several pins covering every outcome; one incomplete lead; one pending job; one submitted job; and one optional territory per office. Use clearly fictional contact details.

- [ ] **Step 2: Write end-to-end tests before final fixes**

Cover login, current-office pin visibility, manual pin placement, Lead save-before-form, offline browser context followed by reconnect, Sync Centre states, manager dashboard filters, and CSV download. Include an assertion that a Perth rep cannot navigate to Brisbane records.

- [ ] **Step 3: Run end-to-end tests and fix only observed failures**

Run:

```bash
firebase emulators:exec --only auth,firestore "npm run test:e2e"
```

Expected: all Playwright tests pass.

- [ ] **Step 4: Write setup, mapping, deployment, and Phase 2 documentation**

Document Firebase project creation, Email/Password enablement, rule/index deployment, Vercel environment variables, authorised domains, Jotform form/question mapping, Vercel Cron, local emulator commands, iPhone Add to Home Screen, trusted-device behaviour, and the precise absence of downloadable offline maps in Version 1.

- [ ] **Step 5: Run the release verification suite**

Run:

```bash
npm ci
npm run test:run
firebase emulators:exec --only firestore "npm run test:rules"
npm run typecheck
npm run build
```

Expected: every command exits with code 0 and `dist/` contains the Vite production build.

- [ ] **Step 6: Perform manual mobile acceptance checks**

Verify at 375×667 and 430×932 viewports: map controls do not overlap safe areas, Add Pin is thumb-reachable, sheets scroll without hiding Save, outdoor theme is readable, offline changes survive reload, reconnect creates one pin, and Jotform state is distinct from Firestore sync.

- [ ] **Step 7: Commit the verified release candidate**

```bash
git add scripts tests playwright.config.ts README.md docs package.json package-lock.json vercel.json
git commit -m "test: verify field sales version one"
```

- [ ] **Step 8: Produce the agent handover report**

Report exact files changed, commits, checks executed with results, Firebase/Vercel configuration still required, Jotform fields still needing IDs, mocked services, known limitations, and the first recommended Codex/OpenCode hardening task.

## Final Acceptance Gate

Do not describe Version 1 as complete until all of the following are demonstrated:

- A rep can create each pin outcome from a phone-sized viewport.
- A Lead pin persists before optional details open.
- Offline pin and lead data survive reload and synchronise once.
- Same-office users see shared pins and full lead details.
- Cross-office reads are denied by emulator-tested rules.
- Managers can create/disable permitted staff accounts but reps cannot.
- Dashboard totals and CSV reflect active filters.
- Jotform state is separate from Firestore state and retries do not resubmit an already recorded submission.
- The PWA installs and launches standalone.
- Production secrets are absent from the browser bundle and repository.
