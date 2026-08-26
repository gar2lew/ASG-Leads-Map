# Hermes / Laguna S 2.1 Build Prompt

You are the lead full-stack engineer responsible for building the first working version of an ASG field-sales mapping application. Work directly in the current project directory and produce a coherent, runnable application rather than isolated snippets or a visual-only mock-up.

## Mission

Build an installable React PWA for ASG representatives in Perth and Brisbane. Representatives must be able to share door-knocking pins within their office, prevent duplicate visits, capture leads during poor connectivity, and send completed leads into the company's existing Jotform automation. Managers need operational oversight, optional drawn territories, staff management, filters, totals, and CSV export.

The first release must be quick to deploy and genuinely useful. It is an **online-first PWA with offline data capture**. It does not include complete downloadable offline map packages yet.

## How to Work

1. Inspect the existing directory before changing anything. If it is empty, scaffold the project there.
2. Use TypeScript throughout and keep files focused by feature.
3. Build in vertical slices so the app stays runnable after each phase.
4. Write tests before or alongside each important domain rule, security rule, and workflow.
5. Run tests, TypeScript checking, and the production build after each phase.
6. Commit each independently working phase if Git is available.
7. Never weaken security rules or expose secrets to make the demo work.
8. Do not stop after creating a plan. Implement the application.
9. Do not replace requested functionality with static cards or buttons that do nothing.
10. If external credentials are unavailable, complete the production adapter and provide an explicit, isolated demo adapter controlled by `VITE_DEMO_MODE=true`. Display a visible Demo Mode banner. Production mode must never silently fall back to demo data.

## Approved Version 1 Scope

### Offices and operating model

- One ASG organisation.
- Initial offices: Perth and Brisbane.
- Perth timezone: `Australia/Perth`.
- Brisbane timezone: `Australia/Brisbane`.
- Roles: `admin`, `manager`, and `rep`.
- No public registration page or registration button.
- Managers and administrators create staff accounts.
- All users within the same office can see every pin and every lead's contact details.
- Administrators can access both offices.
- Administrators can enable or disable organisation-wide cross-office visibility.

### Visit outcomes

Use exactly these five outcomes:

1. Knocked
2. Not Knocked
3. Not Interested
4. Did Not Qualify
5. Lead

Each outcome needs a distinct colour, short symbol, text label, map pin appearance, filter option, and dashboard count. Never communicate an outcome through colour alone.

Use this typed representation:

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
] as const;
```

### Location behaviour

- Use location only to centre the map and assist pin placement.
- Request permission only after a clear user action or explanation.
- Fall back to the user's assigned office centre.
- Do not continuously track users.
- Do not record routes.
- Structure the code so session start/finish check-ins can be added later.

### Territories

- Territories are optional.
- Managers can draw a polygon, name it, choose a colour, assign reps, activate/archive it, and filter the map to it.
- Reps can view territories but cannot edit them.
- Reps can always use **Open Canvassing** and create pins without selecting a territory.
- Do not require a territory ID on a pin.

## Required Technology

- React + Vite + TypeScript.
- React Router.
- MapLibre GL, not React Leaflet.
- A MapLibre-compatible drawing control for optional territory polygons.
- Firebase modular web SDK.
- Firebase Authentication with email/password.
- Cloud Firestore with explicit persistent multi-tab local cache where supported.
- Firebase Admin only inside Vercel serverless functions.
- Vercel for frontend and serverless API deployment.
- `vite-plugin-pwa` for the installable PWA.
- Vitest + React Testing Library.
- Firebase Emulator rule tests.
- Playwright for critical end-to-end flows.

Use the latest mutually compatible stable package versions resolved by npm. Do not introduce Next.js, a separate Express server, Redux, a UI framework, or a second database.

## Mapping Architecture

- Use MapLibre GL for the interactive map.
- Load the map style from `VITE_MAP_STYLE_URL`.
- In explicit Demo Mode only, a public MapLibre demonstration style may be used and must be labelled as non-production.
- Cluster office pins at wider zoom levels.
- Display only data the signed-in user is authorised to see.
- Filters: office where authorised, rep, outcome, territory, and date range.
- Use manual map pin placement. Do not attempt to preload every property.
- Let the user move a provisional marker and edit the detected address before saving.
- Reverse geocoding failure must never prevent saving.

Create this future-facing boundary now:

```ts
export interface OfflineMapProvider {
  isAvailable(): Promise<boolean>;
  listPackages(): Promise<Array<{ id: string; name: string; bytes: number }>>;
}
```

Version 1 returns no offline packages. Do not claim that the basemap works fully offline. Do not bulk-download tiles from `tile.openstreetmap.org`. Downloadable assigned-territory PMTiles packages are a later release.

## Primary Rep Workflow

The Field Map is the default rep screen.

1. Rep selects **Add Pin**.
2. Rep taps the property location.
3. Show a provisional marker.
4. Attempt reverse geocoding through the protected API.
5. Rep may move the marker or edit the address.
6. Rep chooses one of the five approved outcomes.
7. Generate document IDs on the client and save the pin immediately.
8. Add an append-only activity event in the same Firestore batch.
9. Display a small confirmation and return to the map without unnecessary navigation.

If the outcome is **Lead**:

1. Save the Lead pin first.
2. Open an optional lead details sheet.
3. Include first name, surname, Australian mobile, email, notes, preferred contact time, and follow-up date.
4. Provide **Complete Later**.
5. Save lead details to Firestore/local persistence.
6. When sufficiently complete for the configured Jotform mapping, create one stable integration job.
7. Show Firestore synchronisation separately from Jotform delivery.

## Required Screens

### Login

- Email and password.
- Forgotten-password action.
- No public sign-up.
- Helpful errors that do not reveal whether arbitrary accounts exist.

### Field Map

- Current-location centring.
- Office pins and clustering.
- Outcome, rep, territory, and date filters.
- Prominent Add Pin control.
- Connection and synchronisation indicator.
- Light, dark, and outdoor theme controls.

### Pin Details

- Address and coordinates.
- Current outcome.
- Creator and timestamps.
- Activity history.
- Outcome update.
- Linked Lead details where applicable.
- Archive control for managers/admins only.
- No hard-delete control.

### Lead Details

- All approved fields.
- Incomplete/complete state.
- Firestore sync state.
- Jotform delivery state.
- Manual retry for authorised failed jobs.
- Same-office team members can read and follow up the lead.

### Dashboard

- Available to managers and administrators.
- Filterable map.
- Count for each visit outcome.
- Total Leads, incomplete Leads, waiting for Jotform, Submitted, and Action Required.
- Recent activity list.
- CSV export matching the active filters.
- Managers remain locked to their office.
- Administrators can switch office.
- Do not add leaderboards, targets, or rep rankings.

### Staff Management

- Managers create and disable reps in their own office.
- Administrators create and disable managers or reps in either office.
- Fields: name, email, temporary password, office, role, active state.
- Disable accounts rather than deleting them so historical attribution remains.

### Territories

- List active and archived territories.
- Draw and edit valid polygons.
- Name, colour, office, assigned reps, active state.
- Open Canvassing remains available.

### Sync Centre

- Connection status.
- Last successful sync.
- Pending local changes.
- Firestore state.
- Jotform state.
- Manual retry.
- Clear, actionable error messages.

### Administrator Settings

- Cross-office visibility toggle with a clear explanation of its effect.
- Read-only audit log with actor, action, target, and Australian timestamp.

## Navigation and Responsive Design

- Mobile uses bottom navigation and thumb-reachable primary controls.
- Desktop uses a compact sidebar.
- Minimum touch target is 44 px.
- Respect iPhone safe-area insets.
- Sheets and dialogs must keep their Save action accessible when the keyboard is open.
- Use Australian date display such as `19/08/2026`.
- Normalise Australian mobile numbers to `0#########` where valid.

## Visual Direction

Create a premium ASG interface using navy, charcoal, white, and restrained gold accents.

- Dark is the default desktop theme.
- Light mode is clean and high contrast.
- Outdoor mode prioritises readability in direct sunlight and uses a suitable bright map style.
- Persist the selected theme per device.
- Avoid flat grey-on-black text, excessive glass effects, tiny controls, and decorative animation that interferes with field use.
- Provide visible focus states, keyboard accessibility, reduced-motion support, and accessible names.

## Firestore Data Model

Create these collections and use organisation/office IDs consistently.

### `organisations/{organisationId}`

```ts
{
  name: string;
  crossOfficeVisibilityEnabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `offices/{officeId}`

```ts
{
  organisationId: string;
  name: 'Perth' | 'Brisbane';
  timezone: 'Australia/Perth' | 'Australia/Brisbane';
  centre: GeoPoint;
  active: boolean;
}
```

### `users/{uid}`

```ts
{
  organisationId: string;
  officeId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'manager' | 'rep';
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}
```

### `pins/{pinId}`

```ts
{
  organisationId: string;
  officeId: string;
  createdBy: string;
  updatedBy: string;
  location: GeoPoint;
  address: string;
  addressSource: 'geocoder' | 'manual' | 'unknown';
  outcome: PinOutcome;
  territoryId: string | null;
  leadId: string | null;
  archived: boolean;
  archivedAt?: Timestamp;
  archivedBy?: string;
  clientCreatedAt: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `activityEvents/{eventId}`

Store organisation, office, pin, actor, event type, limited before/after snapshots, client time, and server time. Client activity events are append-only.

### `leads/{leadId}`

Store organisation, office, linked pin, creator, contact fields, completion state, integration state, optional Jotform submission ID, and timestamps.

Use these integration states:

```ts
type LeadIntegrationState =
  | 'not_ready'
  | 'pending'
  | 'processing'
  | 'submitted'
  | 'failed';
```

### `territories/{territoryId}`

Store organisation, office, name, colour, GeoJSON-compatible polygon coordinates, assigned user IDs, active/archive state, actors, and timestamps.

### `integrationJobs/{leadId}`

Use the lead ID as the stable job document ID. Store organisation, office, type `jotform_lead`, lead ID, stable idempotency key, state, attempt count, lease/attempt timestamps, safe last error, and external submission ID.

### `auditLogs/{logId}`

Store organisation, office when relevant, actor, action, target, server timestamp, and limited safe metadata. Clients never create or modify audit logs directly.

## Firestore Security Rules

Security rules are a core deliverable, not documentation.

- Every request requires an authenticated, active `users/{uid}` profile.
- Same-office users can read pins, leads, activity, and territories for their office.
- Administrators can read both offices.
- If the administrator enables `crossOfficeVisibilityEnabled`, active organisation members can read both offices.
- Rep writes must remain within their office.
- Managers cannot manage another office.
- Reps cannot edit organisation settings, users, or audit logs.
- Clients cannot mark integration jobs Submitted or write external submission IDs.
- Activity events are append-only.
- No client role can hard-delete pins, leads, or activity history.
- Only administrators can change the cross-office setting.

Write Firebase Emulator tests for at least:

- Perth rep reads Perth pin and Lead details.
- Perth rep is denied Brisbane data with cross-office disabled.
- The authorised cross-office read succeeds after the setting is enabled.
- Rep cannot write another office.
- Rep cannot write users or audit logs.
- Perth manager cannot create a Brisbane user or territory.
- Administrator can access both offices.
- Client cannot forge Submitted Jotform state.
- Disabled profile cannot access protected collections.

## Offline and Synchronisation

Explicitly initialise Firestore using persistent multi-tab web caching where supported. Detect unsupported persistence and show a clear message while keeping online use available.

Use client-generated IDs so pins, activity events, linked leads, and integration jobs retain stable relationships while offline.

Show these user-facing states:

- Saved Locally
- Syncing
- Synced
- Waiting for Jotform
- Submitted
- Action Required

Rules:

- Firestore sync success does not mean Jotform success.
- A failed geocoder does not block pin save.
- A failed Jotform call never deletes or hides the Lead.
- Retain drafts after recoverable failures.
- Provide reconnect-triggered delivery and manual retry.
- Provide a trusted-device notice because lead details persist locally.
- Add a sign-out-and-clear-local-data action.

## Vercel Serverless Functions

Create focused TypeScript functions under `api/`.

### Shared server helpers

- Initialise Firebase Admin once.
- Parse `Authorization: Bearer <Firebase ID token>`.
- Verify the token.
- Fetch the current `users/{uid}` profile server-side.
- Require the profile to be active.
- Authorise using the server profile, never request-body claims.
- Return safe JSON errors without stack traces or secrets.

### Account endpoints

- `POST /api/accounts/create`
- `POST /api/accounts/disable`

Create Firebase Auth users, set role/office custom claims, write profiles, disable accounts, revoke refresh tokens, and append audit logs. If profile creation fails after Auth creation, disable the partially created Auth account and return a safe error.

### Reverse-geocoding endpoint

- `GET /api/geocode/reverse?lat=<number>&lng=<number>`
- Require authentication.
- Validate coordinate ranges.
- Round to five decimal places for the cache key.
- Cache successful normalised addresses in Firestore.
- Enforce a shared one-request-per-second throttle before calling the configured provider.
- Use an identifying server contact value.
- Return a safe 429 response when throttled.
- Abort stale client requests when the marker moves.

### Jotform endpoint

- `POST /api/integrations/jotform`
- Accept only a Lead ID, not trusted lead payload fields.
- Verify caller and office access.
- Load the canonical Lead and stable job from Firestore.
- Claim eligible work through a transaction and processing lease.
- Map fields using server-side configuration.
- Include the internal Lead ID in a dedicated Jotform field for reconciliation.
- Submit to Jotform using the server-only API key.
- Save the returned submission ID before showing Submitted.
- Return an existing submitted result without submitting again.
- Store only sanitised error summaries.

Add a bounded retry endpoint for Vercel Cron. Use attempt delays of 1, 5, 15, and 60 minutes, cap at five attempts, select only due jobs, and process a bounded batch. Protect the endpoint with the Vercel cron secret.

## Environment Variables

Create `.env.example` containing names only:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_MAP_STYLE_URL=
VITE_DEMO_MODE=false

FIREBASE_SERVICE_ACCOUNT_JSON=
GEOCODER_BASE_URL=
GEOCODER_CONTACT=
JOTFORM_API_KEY=
JOTFORM_FORM_ID=
JOTFORM_FIELD_MAP_JSON=
CRON_SECRET=
```

Do not prefix server secrets with `VITE_`. Do not commit `.env`, `.env.local`, Firebase service account files, tokens, or real lead data.

## Jotform Integration Detail

The exact existing Jotform question IDs are not available yet. Build a real server-side adapter whose mapping comes from `JOTFORM_FIELD_MAP_JSON`, validate the configuration, and document the expected shape in `docs/JOTFORM_MAPPING.md`.

In Demo Mode, use a clearly labelled fake adapter that returns a deterministic fake submission ID. In normal mode, missing Jotform configuration must produce Action Required, not fake success.

## Dashboard and CSV

Dashboard queries and totals must respect active filters. Export these columns:

- Office
- Rep
- Outcome
- Address
- Latitude
- Longitude
- Territory
- Lead completion state
- Jotform delivery state
- Created date/time
- Updated date/time

Escape commas, quotes, and line breaks correctly. Use Australian-readable dates. Do not export passwords, tokens, internal errors, or unnecessary audit data.

## PWA Requirements

- Installable manifest with ASG name, icons, theme colours, and standalone display.
- Cache application shell and static assets.
- Do not cache authenticated API responses.
- Do not claim offline basemap availability.
- Provide update-ready messaging.
- Verify Add to Home Screen behaviour and standalone launch on iPhone-sized layouts.

## Project Structure

Keep responsibilities separated approximately as follows:

```text
api/
  _lib/
  accounts/
  geocode/
  integrations/
src/
  app/
  components/
  features/auth/
  features/dashboard/
  features/leads/
  features/map/
  features/pins/
  features/settings/
  features/staff/
  features/sync/
  features/territories/
  firebase/
  shared/
  styles/
tests/
  rules/
  e2e/
docs/
```

Do not put the whole application into `App.tsx`. Keep repositories, domain models, map integration, server clients, and visual components separate.

## Implementation Order

Implement in this order and keep the app runnable:

1. Scaffold, TypeScript strictness, outcome model, AU mobile/date/CSV utilities, and tests.
2. Firebase client, persistent cache, login, profile loading, protected routes, and role-aware navigation.
3. Firestore rules, indexes, emulator tests, and fictional seed data.
4. MapLibre field map, office pin layers, filters, current location, and manual pin creation.
5. Atomic activity events, pin details, outcome updates, and manager archive.
6. Lead form, Complete Later, offline persistence, and explicit sync/delivery states.
7. Authenticated Vercel helpers and manager-created staff accounts.
8. Cached/throttled reverse geocoding.
9. Reliable Jotform delivery, manual retry, reconnect trigger, and scheduled retry.
10. Optional territory drawing, assignment, rendering, and filtering.
11. Dashboard, recent activity, totals, and filtered CSV export.
12. Themes, PWA configuration, accessibility, error recovery, documentation, and end-to-end tests.

## Required Tests and Verification

Add scripts for:

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:rules": "vitest run tests/rules",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit",
  "build": "vite build"
}
```

At minimum, verify:

- Exact outcome set and labels.
- AU mobile normalisation.
- CSV quoting.
- Auth and inactive-user behaviour.
- Every role and office security boundary through emulator tests.
- Pin saves before Lead details open.
- Geocoder failure leaves manual address entry.
- Complete Later works.
- Firestore and Jotform states remain separate.
- Already-submitted jobs are no-ops.
- Dashboard metrics match filters.
- Mobile layout works at 375×667 and 430×932.
- PWA builds and launches.

Before claiming completion, run:

```bash
npm ci
npm run test:run
firebase emulators:exec --only firestore "npm run test:rules"
npm run typecheck
npm run build
```

If a command cannot run because the environment lacks a required external tool, report the exact command, blocker, and remaining verification. Do not claim it passed.

## Documentation Deliverables

Create:

- `README.md` with setup, local development, Demo Mode, test, and build instructions.
- `docs/DEPLOYMENT.md` with Firebase and Vercel deployment steps.
- `docs/JOTFORM_MAPPING.md` with the mapping JSON format and connection steps.
- `docs/PHASE_2_OFFLINE_MAPS.md` explaining the `OfflineMapProvider`, assigned-territory PMTiles direction, browser quota risks, and why public OSM tiles cannot be bulk downloaded.
- `.env.example` with variable names only.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, and `vercel.json`.

## Version 1 Exclusions

Do not build these now:

- Complete offline Western Australia basemap.
- Territory map-package downloads.
- Automatic property/address population.
- Continuous or background rep tracking.
- Route history or route optimisation.
- Session check-ins.
- Leaderboards, targets, rankings, or performance scoring.
- Custom manager-created visit outcomes.
- A native mobile application.

## Definition of Done

Version 1 is done only when:

- A rep can log in and use a phone-sized map.
- The rep can create each approved visit outcome.
- The pin appears for same-office teammates.
- Lead pin saving occurs before the optional Lead form.
- Pin and Lead writes survive an offline/reconnect test without duplicate internal records.
- Same-office teammates can view the full Lead details.
- Cross-office access follows the administrator setting and is enforced by tested rules.
- Managers can create/disable permitted accounts and reps cannot.
- Optional territory drawing works without blocking Open Canvassing.
- Dashboard filters, totals, recent activity, and CSV work.
- Jotform delivery has Pending, Submitted, and Failed states and never fakes success.
- A recorded Submitted job is not submitted twice.
- The app installs as a PWA and both dark and outdoor themes remain readable.
- Tests, typecheck, and production build pass.
- No production secrets appear in Git history or the browser bundle.

## Final Response Required From You

When the build is complete, return a concise engineering report containing:

1. What was built.
2. Important architecture decisions.
3. Exact files created or changed.
4. Tests and commands run with their actual results.
5. Features working in Demo Mode.
6. Firebase, Vercel, map, geocoder, and Jotform configuration still required.
7. Any known limitation or incomplete acceptance item.
8. The recommended first task for Codex/OpenCode to audit or harden.

Begin by inspecting the workspace, then implement the application in the approved order.
