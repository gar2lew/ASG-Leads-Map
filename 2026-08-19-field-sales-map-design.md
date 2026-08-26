# ASG Field Sales Map — Version 1 Design

Date: 19 August 2026  
Status: Approved for implementation prompt  
Primary delivery path: Hermes agent using Laguna S 2.1, followed by Codex or OpenCode hardening

## 1. Purpose

Build an installable field-sales web application for ASG representatives in Perth and Brisbane. Representatives use a shared office map to record door-knocking outcomes, prevent duplicate visits, capture leads even when connectivity drops, and pass completed leads into the existing Jotform automation.

Version 1 prioritises quick deployment and dependable daily use. It is an online-first Progressive Web App (PWA) with offline data capture. Downloadable offline territory basemaps are deliberately deferred to Phase 2.

## 2. Approved Product Decisions

- Operating model: managed teams with configurable cross-office visibility.
- Offices: Perth and Brisbane initially.
- Staff accounts: created by authorised managers or administrators; no public registration.
- Rep visibility: all reps can see all pins and lead details belonging to their office.
- Territories: optional, manager-drawn polygons; reps may also use Open Canvassing without a territory.
- Pin creation: manual map placement only.
- Outcomes: `Knocked`, `Not Knocked`, `Not Interested`, `Did Not Qualify`, and `Lead`.
- Lead capture: save the Lead pin immediately, then prompt for optional details.
- Lead integration: save to Firestore first, then submit to the existing Jotform through a protected backend integration.
- Location use: centre the map and assist pin placement only. Session start/finish check-ins are a later goal; continuous tracking is excluded.
- Dashboard: map, filters, operational totals, lead counts, integration states, recent activity, and CSV export.
- Appearance: ASG dark theme and high-contrast light/outdoor theme with a manual toggle.
- Offline: locally persist pins and leads, show explicit sync states, and synchronise after reconnection.

## 3. Scope

### Version 1 includes

- Installable responsive PWA for iPhone, iPad, and desktop.
- Firebase email/password authentication.
- Role and office-aware navigation.
- Administrator, manager, and representative roles.
- Secure manager-created staff accounts.
- Office-wide shared pins and lead details.
- Current-location map centring.
- Manual pin placement with editable address.
- Five approved visit outcomes with distinct, accessible colours.
- Immediate pin saving followed by optional Lead details.
- Persistent offline Firestore data and clear delivery states.
- Jotform delivery queue, retry handling, and duplicate protection.
- Optional manager-drawn territories.
- Manager dashboard, filters, totals, activity list, and CSV export.
- Light, dark, and high-contrast outdoor presentation.
- Archive workflow instead of permanent rep deletion.
- Automated tests for core permissions and workflows.

### Explicitly deferred

- Complete offline Western Australia map.
- Downloadable PMTiles territory packages.
- Custom offline-region drawing and packaging.
- Session start and finish check-ins.
- Continuous/background representative location tracking.
- Route recording or route optimisation.
- Performance leaderboards, targets, and conversion scoring.
- Manager-configurable pin statuses.
- Automatic address/property population.

## 4. Technical Architecture

### Frontend

- React with Vite and TypeScript.
- React Router for protected application routes.
- MapLibre GL for interactive mapping.
- Firebase modular web SDK for Authentication and Firestore.
- Firestore persistent multi-tab local cache where supported.
- PWA manifest and service worker through `vite-plugin-pwa`.
- IndexedDB only for local application metadata not already owned by Firestore, such as theme, map preferences, and future offline-package manifests.
- Papa Parse for CSV generation if needed; native CSV generation is acceptable if correctly escaped.

### Secure server functions

Use Vercel serverless functions for the fastest single frontend deployment. Every privileged request must verify a Firebase ID token with Firebase Admin before executing.

Required server endpoints:

- Create or disable a staff account and set role/office claims.
- Submit a queued lead to Jotform.
- Retry or inspect an authorised integration job.
- Reverse-geocode coordinates with throttling and caching.

Firebase Admin credentials and the Jotform API key must exist only as server environment variables. They must never be included in Vite-prefixed environment variables or returned to the browser.

### Map delivery

Version 1 uses an authorised online vector basemap compatible with MapLibre. Do not implement bulk downloading from `tile.openstreetmap.org`.

Define an `OfflineMapProvider` interface now so Phase 2 can add PMTiles packages without rewriting the main map screen. A development sample may demonstrate PMTiles loading, but Version 1 must not claim that complete territory basemaps are available offline.

### Deployment

- Frontend and serverless API: Vercel.
- Authentication and database: Firebase.
- Deployment configuration uses environment variables with an `.env.example` containing names only.
- Include Vercel SPA rewrite configuration and Firebase index/rules files.

## 5. Roles and Access

### Representative

- View all active and historical pins for their own office.
- View all lead contact information for their own office.
- Create and update pins and leads for their own office.
- View office territories and filter to one.
- Work in Open Canvassing mode.
- View and retry their relevant pending actions.
- Cannot create accounts, change roles, access another office by default, or permanently delete activity.

### Manager

- All representative permissions for their office.
- View the office dashboard and exports.
- Create, disable, and manage users within their office, subject to administrator-configured role limits.
- Draw, edit, archive, and assign territories within their office.
- Archive erroneous pins while preserving their audit history.

### Administrator

- Access both offices.
- Create and manage managers and representatives.
- Configure cross-office visibility.
- Inspect integration failures and audit logs.
- Access organisation settings.

Firestore rules are the final enforcement boundary. Hiding controls in the interface is not sufficient security.

## 6. Screens and Navigation

### Login

- Email and password fields.
- Forgotten-password action.
- No public registration link.
- Helpful but non-revealing authentication errors.

### Field Map

- Default landing screen for representatives.
- Centre on current position after clear permission request; fall back to the assigned office.
- Display office pins with clustering at wider zoom levels.
- Filters for outcome, representative, territory, and date.
- Prominent Add Pin control.
- Connection and sync indicators.
- Theme/outdoor-mode control.
- Mobile bottom navigation and desktop sidebar.

### Pin Details

- Address, coordinates, current status, creator, timestamps, and activity history.
- Update outcome with confirmation where appropriate.
- Open linked lead details when the user is authorised.

### Lead Details

- First name.
- Surname.
- Australian mobile number.
- Email.
- Notes.
- Preferred contact time.
- Follow-up date.
- Integration state and retry action.
- `Complete Later` action when opened immediately after pin creation.

The Jotform mapping remains configuration-driven so exact question IDs can be added after the existing form is supplied.

### Dashboard

- Filterable map.
- Outcome total cards.
- Lead total and Jotform state counts.
- Recent activity list.
- CSV export for the active filters.
- Managers are locked to their office; administrators can switch office.

### Staff Management

- Name, email, temporary password, office, role, and active status.
- Force password reset flow where supported by the chosen account-creation implementation.
- Disable rather than delete accounts to preserve attribution.

### Territories

- List, draw, name, colour, assign, activate, and archive polygons.
- Territory selection is optional for pin creation.
- Open Canvassing remains available.

### Sync Centre

- Last successful synchronisation.
- Pending local changes.
- Firestore synchronisation state.
- Jotform delivery state.
- Manual retry and actionable error message.

## 7. Primary Workflows

### Create a standard pin

1. Representative selects Add Pin.
2. Representative taps a property location.
3. The app places a provisional marker and attempts reverse geocoding.
4. Representative moves the marker or edits the address if needed.
5. Representative chooses one of the five outcomes.
6. The app saves the pin immediately, including user, office, coordinates, address, outcome, client-generated ID, and timestamps.
7. The app adds an immutable activity event.
8. A non-blocking confirmation returns the representative to the map.

### Create a lead

1. Follow the standard pin flow and select Lead.
2. Save the Lead pin before opening the details form.
3. Allow the representative to add details or choose Complete Later.
4. Save the lead to Firestore/local persistence.
5. Create one integration job with a stable idempotency key.
6. The protected server function maps configured fields and submits them to Jotform.
7. Store Submitted or Failed state without deleting the internal lead.
8. Retry transient failures automatically with bounded backoff; provide a manual retry.

### Create staff account

1. Authorised manager or administrator completes the staff form.
2. Client sends a Firebase ID token to the protected server endpoint.
3. Server verifies the caller and ensures their office/role permits the action.
4. Firebase Admin creates the Authentication user, sets claims, and writes the user profile.
5. Return a safe result without exposing privileged credentials.

## 8. Data Model

Use organisation and office identifiers on all operational documents needed by security rules and queries.

### `organisations/{organisationId}`

- `name`
- `crossOfficeVisibilityEnabled`
- `createdAt`, `updatedAt`

### `offices/{officeId}`

- `organisationId`
- `name`
- `timezone`
- `centre` geographic point
- `active`

Initial office timezones are `Australia/Perth` and `Australia/Brisbane`.

### `users/{uid}`

- `organisationId`
- `officeId`
- `displayName`
- `email`
- `role`: `admin | manager | rep`
- `active`
- `createdAt`, `updatedAt`, `lastLoginAt`

### `pins/{pinId}`

- `organisationId`, `officeId`
- `createdBy`, `updatedBy`
- `location` geographic point
- `address`, `addressSource`
- `outcome`
- `territoryId` nullable
- `leadId` nullable
- `archived`, `archivedAt`, `archivedBy`
- `createdAt`, `updatedAt`

### `activityEvents/{eventId}`

- `organisationId`, `officeId`
- `pinId`, `actorId`
- `eventType`
- `before`, `after` limited snapshots
- `clientCreatedAt`, `serverCreatedAt`

Events are append-only for clients.

### `leads/{leadId}`

- `organisationId`, `officeId`, `pinId`
- `createdBy`
- contact fields
- `completionState`: `incomplete | complete`
- `integrationState`: `not_ready | pending | submitting | submitted | failed`
- `jotformSubmissionId` nullable
- timestamps

### `territories/{territoryId}`

- `organisationId`, `officeId`
- `name`, `colour`
- GeoJSON-compatible polygon coordinates
- `assignedUserIds`
- `active`, `archived`
- timestamps and audit actors

### `integrationJobs/{jobId}`

- `organisationId`, `officeId`
- `type`: `jotform_lead`
- `leadId`
- stable `idempotencyKey`
- `state`: `pending | processing | submitted | failed`
- `attemptCount`, `lastAttemptAt`, `nextAttemptAt`
- sanitised `lastError`
- external submission identifier

### `auditLogs/{logId}`

- organisation, office, actor, action, target, timestamp, and limited metadata.
- Clients may read authorised logs but never create or modify them directly.

## 9. Offline and Synchronisation Behaviour

- Enable supported persistent Firestore web caching explicitly.
- Detect and communicate unsupported persistence without preventing online use.
- Save pins and leads using client-generated IDs so offline relationships remain stable.
- Show UI states: Saved Locally, Syncing, Synced, Waiting for Jotform, Submitted, and Action Required.
- Never infer that a Jotform submission succeeded merely because Firestore synchronised.
- Preserve append-only events to retain competing changes; the current pin summary may use the latest accepted update.
- Geocoding failure does not block saving.
- Map connectivity failure does not discard an already-started pin form.
- Do not store a Jotform API key, Firebase Admin credential, or full privileged error response locally.
- On shared or untrusted devices, warn users before enabling persistent storage of lead details and provide a sign-out/clear-local-data path.

## 10. Visual Design

- Premium ASG appearance using navy, charcoal, white, and restrained gold accents.
- Dark is the default desktop theme.
- Light/outdoor theme uses strong contrast and a readable basemap for direct sunlight.
- Theme toggle persists per device.
- Outcome colours remain distinct in both themes and are not communicated by colour alone.
- Minimum 44 px mobile touch targets.
- Primary field actions are reachable one-handed on modern iPhones.
- Avoid dense forms, tiny map controls, and decorative effects that reduce outdoor readability.

## 11. Error Handling

- Authentication errors are clear but do not expose whether arbitrary accounts exist.
- Permission failures show the user what role or office is required.
- Reverse-geocoding errors leave an editable manual address field.
- Firestore errors retain the local draft and expose retry guidance.
- Jotform failures preserve the lead, store a safe error summary, and expose retry.
- CSV export escapes commas, quotes, and new lines and uses Australian-readable dates.
- Global error boundary provides recovery without losing drafts.
- Logging excludes passwords, tokens, API keys, and unnecessary lead details.

## 12. Verification and Acceptance Criteria

### Automated

- Unit tests for outcome configuration, Australian mobile validation, date formatting, CSV escaping, permission helpers, and Jotform field mapping.
- Firestore emulator rule tests for every role and cross-office denial.
- Integration tests for create pin, create lead, queue job, retry, archive, and account creation authorisation.
- End-to-end smoke tests for login, mobile pin workflow, dashboard filtering, and CSV export.

### Manual

- Install and launch from an iPhone home screen.
- Verify mobile layout on small and large iPhone viewports and desktop.
- Create a pin online and offline, then reconnect and confirm it appears once.
- Create a Lead offline, complete details, reconnect, and confirm one Jotform delivery.
- Confirm Perth users cannot access Brisbane data unless cross-office access is enabled.
- Confirm all same-office representatives can see each other's pins and lead contact details.
- Confirm disabled accounts cannot continue accessing protected data after token refresh.
- Confirm dark and outdoor themes keep every outcome distinguishable.

Version 1 is accepted when a representative can reliably record a visit or lead from their phone, the same-office team sees the result, managers can review/export activity, and the Jotform automation receives completed leads without silent loss or duplication.

## 13. Phase 2 Direction

Implement assigned-territory offline basemaps with MapLibre and PMTiles through the existing `OfflineMapProvider` boundary. Territory packages should come from self-hosted or explicitly licensed vector data, not bulk downloads from the public OpenStreetMap tile service. Add storage estimates, download progress, versioning, package deletion, and safe handling of browser quota/eviction. A full Western Australia package should be reconsidered as a native-app feature if browser storage proves unreliable.

## 14. Implementation Handover

The initial coding agent must:

- Build a coherent working vertical slice rather than disconnected mock screens.
- Use mock/demo services only behind explicit interfaces and visible development labels.
- Never weaken security rules to make the demo work.
- Include `.env.example`, setup instructions, Firestore rules/indexes, sample seed data, and deployment documentation.
- Clearly report completed functionality, mocked functionality, configuration still required, tests run, and known limitations.

The follow-up Codex/OpenCode pass should prioritise security-rule testing, privileged endpoint review, real Jotform field mapping, offline conflict testing, iPhone PWA QA, and production deployment verification.
